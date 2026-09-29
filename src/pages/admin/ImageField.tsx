import { useRef, useState } from "react";
import { dataUrlBytes, formatBytes } from "../../lib/image";
import { isInlineImage, uploadImage, type UploadFolder } from "../../lib/upload";
import { Button, Field, Input } from "./ui";

type Props = {
  image?: string;
  alt?: string;
  onChange: (next: { image?: string; alt?: string }) => void;
  /** Where uploads are filed in the media bucket. */
  folder?: UploadFolder;
  /** Alt-text placeholder — describe what's visibly in the picture. */
  altPlaceholder?: string;
  uploadLabel?: string;
};

export function ImageField({
  image,
  alt,
  onChange,
  folder = "projects",
  altPlaceholder = "Smart Fan captive-portal control panel screenshot",
  uploadLabel = "Upload screenshot",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNote(null);
    setStatus("working");
    try {
      const result = await uploadImage(file, folder);
      onChange({ image: result.url, alt });
      if (result.note) setNote(result.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process image.");
    } finally {
      setStatus("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const inlineImage = isInlineImage(image);
  const size = image && inlineImage ? dataUrlBytes(image) : 0;
  const isUrl = image && !inlineImage;

  return (
    <div className="space-y-3">
      {/* Preview */}
      {image ? (
        <div className="relative w-full max-w-md aspect-[16/9] overflow-hidden border border-rule rounded-sm bg-row-alt">
          <img
            src={image}
            alt={alt || ""}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange({ image: undefined, alt })}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-sm font-ui text-[11px] font-medium bg-paper/95 border border-rule text-ink hover:bg-paper hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              close
            </span>
            Remove
          </button>
          <div className="absolute bottom-2 left-2 font-ui text-[10px] uppercase tracking-[0.15em] bg-paper/85 text-ink-muted px-1.5 py-0.5 rounded-sm border border-rule">
            {isUrl ? "Linked image" : `Inline · ${formatBytes(size)}`}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md aspect-[16/9] border border-dashed border-rule rounded-sm bg-row-alt grid place-items-center text-ink-subtle font-ui text-[12px]">
          No image — fallback gradient placeholder is shown on the site.
        </div>
      )}

      {/* Upload / URL input */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="sr-only"
        />
        <Button
          variant="primary"
          icon={status === "working" ? "hourglass_top" : "upload"}
          onClick={() => fileRef.current?.click()}
          disabled={status === "working"}
        >
          {status === "working" ? "Uploading…" : uploadLabel}
        </Button>
        <span className="font-ui text-[11px] text-ink-subtle">or paste URL</span>
        <div className="flex-1 min-w-[12rem]">
          <Input
            value={isUrl ? image ?? "" : ""}
            onChange={(v) => onChange({ image: v || undefined, alt })}
            placeholder="/projects/foo.jpg  or  https://…"
          />
        </div>
      </div>

      {error && (
        <p className="font-ui text-[12px] text-red-600 dark:text-red-400">{error}</p>
      )}
      {note && (
        <p className="font-ui text-[12px] text-ink-muted">
          Saved inline instead of to storage — {note}
        </p>
      )}

      {/* Alt text */}
      <Field
        label="Alt text"
        hint="Describe what's visibly in the picture"
      >
        <Input
          value={alt ?? ""}
          onChange={(v) => onChange({ image, alt: v || undefined })}
          placeholder={altPlaceholder}
        />
      </Field>

      <p className="font-ui text-[11px] text-ink-subtle">
        Uploads go to the site's image storage and are linked from the page.
        Without storage they're compressed and saved inside the content
        itself, which every visitor downloads — fine for one or two, heavy
        for a gallery.
      </p>
    </div>
  );
}
