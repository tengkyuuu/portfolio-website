import { useRef, useState } from "react";
import type { ProjectImage } from "../../lib/content";
import { compressImage, dataUrlBytes, formatBytes } from "../../lib/image";
import { Button, IconButton, Input } from "./ui";

type Props = {
  images: ProjectImage[];
  onChange: (next: ProjectImage[]) => void;
};

/**
 * Editor for a project's image gallery. Upload one or many screenshots
 * (compressed to data URLs) or add a URL/path entry. Two or more images
 * render as a carousel on the site; reorder with ▲▼.
 */
export function GalleryField({ images, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setWorking(true);
    try {
      const added: ProjectImage[] = [];
      for (const file of Array.from(files)) {
        added.push({ src: await compressImage(file) });
      }
      onChange([...images, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process image.");
    } finally {
      setWorking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setImage(i: number, partial: Partial<ProjectImage>) {
    onChange(images.map((im, idx) => (idx === i ? { ...im, ...partial } : im)));
  }
  function remove(i: number) {
    onChange(images.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {images.length === 0 ? (
        <div className="w-full max-w-md aspect-[16/9] border border-dashed border-rule rounded-sm bg-row-alt grid place-items-center text-ink-subtle font-ui text-[12px] text-center px-4">
          No images — a gradient placeholder is shown on the site. Add 2+ to get
          a carousel with arrows.
        </div>
      ) : (
        <ul className="space-y-2">
          {images.map((im, i) => {
            const isUrl = im.src && !im.src.startsWith("data:");
            const size = im.src.startsWith("data:") ? dataUrlBytes(im.src) : 0;
            return (
              <li
                key={i}
                className="flex items-start gap-3 border border-rule rounded-sm p-2 bg-paper"
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
                    disabled={i === images.length - 1}
                  />
                </div>

                <div className="relative w-32 shrink-0 aspect-[16/9] overflow-hidden border border-rule rounded-sm bg-row-alt">
                  {im.src ? (
                    <img
                      src={im.src}
                      alt={im.alt || ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-ink-subtle font-ui text-[10px]">
                      no source
                    </div>
                  )}
                  <span className="absolute top-1 left-1 font-ui text-[10px] tabular-nums bg-paper/90 text-ink-muted px-1 rounded-sm border border-rule">
                    {i + 1}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <Input
                    value={isUrl ? im.src : ""}
                    onChange={(v) => setImage(i, { src: v })}
                    placeholder={
                      im.src.startsWith("data:")
                        ? `Uploaded · ${formatBytes(size)}`
                        : "/projects/foo.jpg  or  https://…"
                    }
                    disabled={im.src.startsWith("data:")}
                  />
                  <Input
                    value={im.alt ?? ""}
                    onChange={(v) => setImage(i, { alt: v || undefined })}
                    placeholder="Alt text (accessibility)"
                  />
                </div>

                <IconButton
                  icon="delete"
                  label="Remove image"
                  onClick={() => remove(i)}
                  danger
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          className="sr-only"
        />
        <Button
          variant="primary"
          icon={working ? "hourglass_top" : "add_photo_alternate"}
          onClick={() => fileRef.current?.click()}
          disabled={working}
        >
          {working ? "Compressing…" : "Upload images"}
        </Button>
        <Button
          variant="secondary"
          icon="link"
          onClick={() => onChange([...images, { src: "" }])}
        >
          Add URL
        </Button>
      </div>

      {error && (
        <p className="font-ui text-[12px] text-red-600 dark:text-red-400">{error}</p>
      )}

      <p className="font-ui text-[11px] text-ink-subtle">
        Uploads are resized to fit 1600 px and saved as JPEG, stored with your
        content. Two or more images become a swipeable carousel on the site.
      </p>
    </div>
  );
}
