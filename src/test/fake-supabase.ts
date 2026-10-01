/**
 * An in-memory stand-in for the slice of supabase-js the API handlers use,
 * so a handler can be driven end to end in a test without a database.
 *
 * Deliberately small: select / insert / update / delete, eq filters,
 * order, limit, range, maybeSingle / single, plus the unique-violation
 * error (23505) the team endpoint turns into a 409. Anything else a
 * handler calls will throw, which is the point — a test should fail
 * loudly when a handler starts depending on something this doesn't model.
 *
 * It lives under src/test rather than api/ because every non-test file in
 * api/ is deployed as a Serverless Function (see api/limits.test.ts).
 */

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number };

export type FakeDb = Record<string, Row[]>;

const UNIQUE: Record<string, string[]> = { admin_users: ["username"] };

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

export function createFakeSupabase(db: FakeDb) {
  function from(table: string) {
    db[table] ??= [];
    let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    let payload: Row | Row[] | undefined;
    const filters: [string, unknown][] = [];
    const after: [string, string][] = [];
    let order: { col: string; asc: boolean } | null = null;
    let window: [number, number] | null = null;
    let returning = true;
    let columns = "*";

    const matching = () =>
      db[table].filter((r) => filters.every(([c, v]) => r[c] === v) && after.every(([c, v]) => String(r[c]) > v));

    /** Honour the column list, so a test can prove a column is never sent. */
    const project = (rows: Row[]): Row[] => {
      if (columns.trim() === "*") return rows.map((r) => ({ ...r }));
      const cols = columns.split(",").map((c) => c.trim()).filter(Boolean);
      return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
    };

    async function exec(): Promise<Result> {
      const rows = db[table];
      if (op === "upsert") {
        // Keyed on id, which is how every handler here upserts.
        const p = payload as Row;
        const existing = rows.find((r) => r.id === p.id);
        if (existing) Object.assign(existing, p);
        else rows.push({ ...p });
        return { data: null, error: null };
      }
      if (op === "insert") {
        const incoming = (Array.isArray(payload) ? payload : [payload]) as Row[];
        const made: Row[] = [];
        for (const p of incoming) {
          for (const col of UNIQUE[table] ?? []) {
            if (rows.some((r) => r[col] === p[col])) {
              return { data: null, error: { code: "23505", message: "duplicate key" } };
            }
          }
          const row = { ...(table === "admin_users" ? { disabled: false } : {}), id: uuid(), created_at: new Date().toISOString(), ...p };
          rows.push(row);
          made.push(row);
        }
        return { data: returning ? project(made) : null, error: null };
      }
      if (op === "update") {
        const hit = matching();
        hit.forEach((r) => Object.assign(r, payload));
        return { data: returning ? project(hit) : null, error: null };
      }
      if (op === "delete") {
        const hit = matching();
        db[table] = rows.filter((r) => !hit.includes(r));
        return { data: returning ? project(hit) : null, error: null, count: hit.length };
      }
      let out = matching();
      if (order) {
        const { col, asc } = order;
        out = [...out].sort((a, b) =>
          String(a[col]) < String(b[col]) ? (asc ? -1 : 1) : String(a[col]) > String(b[col]) ? (asc ? 1 : -1) : 0
        );
      }
      if (window) out = out.slice(window[0], window[1] + 1);
      return { data: project(out), error: null };
    }

    const builder = {
      select(cols = "*") {
        returning = true;
        columns = cols;
        return builder;
      },
      insert(p: Row | Row[]) {
        op = "insert";
        payload = p;
        returning = false;
        return builder;
      },
      upsert(p: Row) {
        op = "upsert";
        payload = p;
        returning = false;
        return builder;
      },
      update(p: Row) {
        op = "update";
        payload = p;
        returning = false;
        return builder;
      },
      delete() {
        op = "delete";
        returning = false;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return builder;
      },
      gt(col: string, val: string) { after.push([col, val]); return builder; },
      order(col: string, opts?: { ascending?: boolean }) {
        order = { col, asc: opts?.ascending !== false };
        return builder;
      },
      limit(n: number) {
        window = [0, n - 1];
        return builder;
      },
      range(a: number, b: number) {
        window = [a, b];
        return builder;
      },
      async maybeSingle(): Promise<Result> {
        const r = await exec();
        return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
      },
      async single(): Promise<Result> {
        const r = await exec();
        const row = Array.isArray(r.data) ? r.data[0] : r.data;
        return row || r.error ? { ...r, data: row ?? null } : { data: null, error: { message: "no rows" } };
      },
      then<T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) {
        return exec().then(resolve, reject);
      },
    };
    return builder;
  }

  /** Storage: buckets listed in db.__buckets exist; signed paths are
   *  recorded in db.__signed so a test can see what was issued. */
  const storage = {
    from(bucket: string) {
      return {
        async createSignedUploadUrl(path: string) {
          const buckets = (db.__buckets ?? []) as unknown as string[];
          if (!buckets.includes(bucket)) {
            return { data: null, error: { message: "Bucket not found" } };
          }
          (db.__signed ??= []).push({ bucket, path });
          return {
            data: { signedUrl: `http://storage.test/upload/sign/${bucket}/${path}?token=t`, path, token: "t" },
            error: null,
          };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `http://storage.test/object/public/${bucket}/${path}` } };
        },
      };
    },
  };

  return { from, storage, rpc: async () => ({ data: true, error: null }) };
}

/* ---------------- request / response doubles ---------------- */

export type FakeResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
  setHeader(name: string, value: string): FakeResponse;
  end(): FakeResponse;
};

export function fakeRes(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

export function fakeReq(init: {
  method: string;
  query?: Record<string, string>;
  body?: unknown;
  token?: string;
  ip?: string;
}) {
  return {
    method: init.method,
    query: init.query ?? {},
    body: init.body ?? {},
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      "x-forwarded-for": init.ip ?? "203.0.113.1",
    },
    socket: { remoteAddress: init.ip ?? "203.0.113.1" },
  };
}
