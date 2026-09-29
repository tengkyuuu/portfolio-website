import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The uploader has one job that fails quietly when it goes wrong: pick
 * the right destination. Inlining when storage was available bloats every
 * visitor's download; failing when it wasn't loses the admin's edit. The
 * canvas work is stubbed — jsdom can't decode images — so these pin only
 * the decisions.
 */

vi.mock("./image", () => ({
  encodeImage: async () => new Blob(["webp-bytes"], { type: "image/webp" }),
  compressImage: async () => "data:image/jpeg;base64,AAAA",
  dataUrlBytes: () => 3,
}));

const { uploadImage } = await import("./upload");
const { AUTH_LOST_EVENT } = await import("./api");

const file = new File(["png"], "poster.png", { type: "image/png" });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  sessionStorage.setItem("jvc_admin_token_v1", "token");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("uploadImage", () => {
  it("PUTs to the signed URL and returns the public URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, {
          signedUrl: "https://x.supabase.co/storage/v1/object/upload/sign/media/designs/a.webp?token=t",
          publicUrl: "https://x.supabase.co/storage/v1/object/public/media/designs/a.webp",
        })
      )
      .mockResolvedValueOnce(json(200, { Key: "media/designs/a.webp" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadImage(file, "designs");
    expect(result).toMatchObject({
      stored: "storage",
      url: "https://x.supabase.co/storage/v1/object/public/media/designs/a.webp",
    });
    const [signCall, putCall] = fetchMock.mock.calls;
    expect(JSON.parse(signCall[1].body)).toEqual({ contentType: "image/webp", folder: "designs" });
    expect(putCall[1]).toMatchObject({ method: "PUT", headers: expect.objectContaining({ "content-type": "image/webp" }) });
  });

  it("inlines, and says why, when the bucket isn't set up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(503, { error: "Image storage isn't set up." })));
    const result = await uploadImage(file, "designs");
    expect(result).toMatchObject({
      stored: "inline",
      url: "data:image/jpeg;base64,AAAA",
      note: "Image storage isn't set up.",
    });
  });

  it("inlines without asking when there is no server session", async () => {
    sessionStorage.clear();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await uploadImage(file, "blog");
    expect(result.stored).toBe("inline");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops, and drops the session, when the server refuses it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { error: "Unauthorized" })));
    const lost = vi.fn();
    window.addEventListener(AUTH_LOST_EVENT, lost);
    await expect(uploadImage(file, "designs")).rejects.toThrow(/sign in again/);
    expect(lost).toHaveBeenCalled();
    expect(sessionStorage.getItem("jvc_admin_token_v1")).toBeNull();
    window.removeEventListener(AUTH_LOST_EVENT, lost);
  });

  it("reports a failed PUT instead of saving a URL to nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { signedUrl: "https://s/sign", publicUrl: "https://s/public" }))
        .mockResolvedValueOnce(json(400, { message: "mime type text/html is not supported" }))
    );
    await expect(uploadImage(file, "designs")).rejects.toThrow(/mime type/);
  });

  it("refuses a non-image before touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadImage(new File(["x"], "a.pdf", { type: "application/pdf" }), "designs")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
