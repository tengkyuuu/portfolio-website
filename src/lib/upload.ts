/**
 * Admin image uploads.
 *
 * Primary path: ask POST /api/content?op=upload for a signed URL, then PUT
 * the file straight to Supabase Storage. What gets saved in the content is
 * a short public URL instead of hundreds of kilobytes of base64 that every
 * visitor would download on every load.
 *
 * Fallback: when there is no storage — a static deploy, the local dev
 * server, or a project where migration 007 hasn't been run — the image is
 * compressed into a data URL, which is how every upload worked before.
 * The edit still succeeds; the result says which path it took and why, so
 * the editor can tell the admin.
 */

import { clearStaleAdminAuth } from "./api";
import { getAdminToken } from "./auth";
import { compressImage, dataUrlBytes, encodeImage } from "./image";

export type UploadFolder = "designs" | "blog" | "projects";

export type UploadResult = {
  url: string;
  stored: "storage" | "inline";
  bytes: number;
  /** Why an upload fell back to inline, when it did. */
  note?: string;
};

/** Designs are the point of the gallery, so they keep the most pixels. */
const PRESETS: Record<UploadFolder, { maxDimension: number; quality: number }> = {
  designs: { maxDimension: 2400, quality: 0.9 },
  blog: { maxDimension: 1800, quality: 0.86 },
  projects: { maxDimension: 1600, quality: 0.86 },
};

type Signed =
  | { ok: true; signedUrl: string; publicUrl: string }
  | { ok: false; fallback: boolean; message: string };

async function requestUpload(
  token: string,
  contentType: string,
  folder: UploadFolder
): Promise<Signed> {
  try {
    const res = await fetch("/api/content?op=upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ contentType, folder }),
    });
    const body = (await res.json().catch(() => null)) as {
      signedUrl?: string;
      publicUrl?: string;
      error?: string;
    } | null;
    if (res.ok && body?.signedUrl && body.publicUrl) {
      return { ok: true, signedUrl: body.signedUrl, publicUrl: body.publicUrl };
    }
    if (res.status === 401) {
      clearStaleAdminAuth();
      return { ok: false, fallback: false, message: "Your session ended — sign in again." };
    }
    if (res.status === 400) {
      return { ok: false, fallback: false, message: body?.error ?? "That file can't be uploaded." };
    }
    // 503: no bucket yet. 404/405/501: a server without uploads.
    return {
      ok: false,
      fallback: true,
      message: body?.error ?? "Image storage isn't available here.",
    };
  } catch {
    return { ok: false, fallback: true, message: "No connection to the server." };
  }
}

async function inline(file: File, note?: string): Promise<UploadResult> {
  const url = await compressImage(file);
  return { url, stored: "inline", bytes: dataUrlBytes(url), note };
}

export async function uploadImage(file: File, folder: UploadFolder): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image file.");
  const token = getAdminToken();
  if (!token) return inline(file);

  const blob = await encodeImage(file, PRESETS[folder]);
  const signed = await requestUpload(token, blob.type, folder);
  if (!signed.ok) {
    if (!signed.fallback) throw new Error(signed.message);
    return inline(file, signed.message);
  }

  const put = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: {
      "content-type": blob.type,
      // Paths are unique per upload, so a year of caching is safe.
      "cache-control": "max-age=31536000",
      "x-upsert": "false",
    },
    body: blob,
  });
  if (!put.ok) {
    const detail = (await put.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      detail?.message
        ? `Upload failed: ${detail.message}`
        : `Upload failed (${put.status}). Try again.`
    );
  }
  return { url: signed.publicUrl, stored: "storage", bytes: blob.size };
}

/** True for an image that lives in the content JSON itself. */
export function isInlineImage(src: string | undefined): boolean {
  return Boolean(src?.startsWith("data:"));
}
