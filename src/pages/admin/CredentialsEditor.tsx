import type { Cert, TimelineEntry } from "../../lib/content";
import { Button, Card, Field, IconButton, Input, Row, Textarea } from "./ui";
import { useEditableSection } from "./useEditableSection";

export function CredentialsEditor() {
  return (
    <>
      <TimelineCard />
      <CertsCard />
    </>
  );
}

function TimelineCard() {
  const { value, update, reset } = useEditableSection("timeline");

  function move(i: number, dir: -1 | 1) {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  function set(i: number, partial: Partial<TimelineEntry>) {
    update(value.map((e, idx) => (idx === i ? { ...e, ...partial } : e)));
  }

  function add() {
    update([
      ...value,
      { range: "", title: "", org: "", blurb: "" } as TimelineEntry,
    ]);
  }

  function remove(i: number) {
    update(value.filter((_, idx) => idx !== i));
  }

  return (
    <Card
      title="Education & Experience"
      description="Timeline entries on the Credentials tab."
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" icon="add" onClick={add}>
            Add entry
          </Button>
          <Button variant="ghost" icon="restart_alt" onClick={reset}>
            Reset
          </Button>
        </div>
      }
    >
      {value.length === 0 ? (
        <p className="font-ui text-[13px] text-ink-subtle italic">
          No entries yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {value.map((entry, i) => (
            <li key={i} className="border border-rule rounded-sm bg-row-alt p-4">
              <div className="flex items-start gap-2 mb-3">
                <div className="flex flex-col">
                  <IconButton
                    icon="keyboard_arrow_up"
                    label="Move up"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  />
                  <IconButton
                    icon="keyboard_arrow_down"
                    label="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === value.length - 1}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <Row>
                    <Field label="Title">
                      <Input
                        value={entry.title}
                        onChange={(v) => set(i, { title: v })}
                        placeholder="BS Computer Engineering"
                      />
                    </Field>
                    <Field label="Range">
                      <Input
                        value={entry.range}
                        onChange={(v) => set(i, { range: v })}
                        placeholder="2021 — Present"
                      />
                    </Field>
                  </Row>
                  <Field label="Organization">
                    <Input
                      value={entry.org}
                      onChange={(v) => set(i, { org: v })}
                      placeholder="Jose Rizal Memorial State University, Dapitan"
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      value={entry.blurb}
                      onChange={(v) => set(i, { blurb: v })}
                      rows={3}
                    />
                  </Field>
                </div>
                <IconButton
                  icon="delete"
                  label="Remove entry"
                  onClick={() => remove(i)}
                  danger
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CertsCard() {
  const { value, update, reset } = useEditableSection("certs");

  function move(i: number, dir: -1 | 1) {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  function set(i: number, partial: Partial<Cert>) {
    update(value.map((c, idx) => (idx === i ? { ...c, ...partial } : c)));
  }

  function add() {
    update([...value, { title: "", issuer: "", date: "", href: "" }]);
  }

  function remove(i: number) {
    update(value.filter((_, idx) => idx !== i));
  }

  return (
    <Card
      title="Certifications & Awards"
      description="The credentials list under the timeline."
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" icon="add" onClick={add}>
            Add certification
          </Button>
          <Button variant="ghost" icon="restart_alt" onClick={reset}>
            Reset
          </Button>
        </div>
      }
    >
      {value.length === 0 ? (
        <p className="font-ui text-[13px] text-ink-subtle italic">
          No certifications yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {value.map((c, i) => (
            <li
              key={i}
              className="flex items-center gap-2 border border-rule rounded-sm bg-row-alt p-3"
            >
              <div className="flex flex-col">
                <IconButton
                  icon="keyboard_arrow_up"
                  label="Move up"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                />
                <IconButton
                  icon="keyboard_arrow_down"
                  label="Move down"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                />
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <Input
                    value={c.title}
                    onChange={(v) => set(i, { title: v })}
                    placeholder="Title"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    value={c.issuer}
                    onChange={(v) => set(i, { issuer: v })}
                    placeholder="Issuer"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    value={c.date}
                    onChange={(v) => set(i, { date: v })}
                    placeholder="Date"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    value={c.href ?? ""}
                    onChange={(v) => set(i, { href: v })}
                    placeholder="URL (optional)"
                  />
                </div>
              </div>
              <IconButton
                icon="delete"
                label="Remove"
                onClick={() => remove(i)}
                danger
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
