/**
 * Browser-side image processing for admin uploads.
 *
 * Reads a File, decodes it via <img>, downscales to fit inside a max-dimension
 * box via <canvas>, and re-encodes as JPEG. Output is a data URL suitable for
 * persisting in localStorage (typically 50–400 KB per screenshot).
 *
 * Keeps the bundle dependency-free — no third-party image lib needed.
 */

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;

export type CompressOptions = {
  /** Longest-edge cap, in pixels. */
  maxDimension?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
};

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const maxDim = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image file.");
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { width, height } = fitInside(
      img.naturalWidth,
      img.naturalHeight,
      maxDim
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);
    // GIF/PNG with transparency would lose alpha here; that's acceptable for
    // screenshot use, and JPEG is much smaller than PNG for photos.
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Types the media bucket accepts (migration 007). */
const STORABLE = new Set(["image/webp", "image/jpeg", "image/png", "image/gif", "image/avif"]);
/** An original under this size and box is uploaded untouched. */
const KEEP_ORIGINAL_BYTES = 3 * 1024 * 1024;

/**
 * Prepare an image for Storage, as a Blob rather than a data URL.
 *
 * A designer's own export is usually better than anything a canvas will
 * re-encode, so an original that already fits the box and weighs under
 * 3 MB is sent as-is. So is any GIF — a canvas keeps only its first
 * frame. Everything else is downscaled and encoded as WebP, which keeps
 * transparency (a logo on a transparent PNG would come out of JPEG with a
 * black background); a browser that can't encode WebP falls back to PNG
 * for a PNG source and JPEG for the rest.
 */
export async function encodeImage(
  file: File,
  options: CompressOptions = {}
): Promise<Blob> {
  const maxDim = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;
  if (!file.type.startsWith("image/")) throw new Error("Not an image file.");
  if (file.type === "image/gif") return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const fits = img.naturalWidth <= maxDim && img.naturalHeight <= maxDim;
    if (fits && STORABLE.has(file.type) && file.size <= KEEP_ORIGINAL_BYTES) {
      return file;
    }
    const { width, height } = fitInside(img.naturalWidth, img.naturalHeight, maxDim);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);
    const webp = await toBlob(canvas, "image/webp", quality);
    if (webp?.type === "image/webp") return webp;
    const fallbackType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await toBlob(canvas, fallbackType, quality);
    if (!blob) throw new Error("Couldn't encode that image.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't decode that image."));
    img.src = src;
  });
}

function fitInside(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = Math.min(max / w, max / h);
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

/** Rough byte size of a base64 data URL string. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const payload = comma < 0 ? dataUrl : dataUrl.slice(comma + 1);
  // base64: every 4 chars → 3 bytes, minus padding
  return Math.floor((payload.length * 3) / 4);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
