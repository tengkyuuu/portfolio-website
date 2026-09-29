import { useRef, useState } from "react";
import type { Design } from "../../lib/content";
import {
  designProblem,
  galleryCategories,
  newDesign,
  titleFromFilename,
} from "../../lib/gallery";
import { uploadImage } from "../../lib/upload";
import { ImageField } from "./ImageField";
import { Button, Card, Field, IconButton, Input, Row, Textarea, Toggle } from "./ui";
import { useEditableSection } from "./useEditableSection";

/**
 * Gallery — the graphic-design pieces on the Gallery tab.
 *
 * Upload several at once; each lands as its own entry, titled from its
 * file name. Nothing reaches the site until it has a title and alt text
 * (see publicDesigns) — a bulk upload would otherwise go live as a row of
 * untitled images the moment autosave ran.
 */
export function GalleryEditor() {
  const { value: designs, update } = useEditableSection("designs");
  const [open, setOpen] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const categories = galleryCategories(designs);

  function patch(id: string, next: Partial<Design>) {
    update(designs.map((d) => (d.id === id ? { ...d, ...next } : d)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= designs.length) return;
    const next = [...designs];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setNote(null);
    const list = Array.from(files);
    const added: Design[] = [];
    setProgress({ done: 0, total: list.length });
    try {
      for (const file of list) {
        const result = await uploadImage(file, "designs");
        added.push(newDesign(result.url, titleFromFilename(file.name)));
        if (result.note) setNote(result.note);
        setProgress({ done: added.length, total: list.length });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that image.");
    } finally {
      // Keep whatever finished, even if a later file failed.
      if (added.length > 0) {
        update([...designs, ...added]);
        setOpen(added[0].id);
      }
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const live = designs.filter((d) => !d.hidden && !designProblem(d)).length;

  return (
    <>
      <Card
        title="Designs"
        description={
          designs.length === 0
            ? "The Gallery tab appears on the site once one piece is complete."
            : `${live} of ${designs.length} on the site. A piece goes live once it has a title and alt text.`
        }
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="sr-only"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <Button
              variant="primary"
              icon={progress ? "hourglass_top" : "add_photo_alternate"}
              onClick={() => fileRef.current?.click()}
              disabled={progress !== null}
            >
              {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : "Upload designs"}
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="mb-3 font-ui text-[12px] text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        {note && (
          <p className="mb-3 font-ui text-[12px] text-ink-muted">
            Saved inline instead of to storage — {note} Inline images are
            downloaded by every visitor on every visit; set up storage before
            adding many.
          </p>
        )}

        {designs.length === 0 ? (
          <p className="font-ui text-[13px] text-ink-subtle">
            No designs yet. Upload a few — select several files at once.
          </p>
        ) : (
          <ul className="divide-y divide-rule border border-rule rounded-sm">
            {designs.map((d, i) => (
              <DesignRow
                key={d.id}
                design={d}
                index={i}
                count={designs.length}
                expanded={open === d.id}
                categories={categories}
                onToggle={() => setOpen(open === d.id ? null : d.id)}
                onMove={(dir) => move(i, dir)}
                onChange={(next) => patch(d.id, next)}
                onDelete={() => {
                  update(designs.filter((x) => x.id !== d.id));
                  if (open === d.id) setOpen(null);
                }}
              />
            ))}
          </ul>
        )}
      </Card>
      <p className="font-ui text-[11px] text-ink-subtle -mt-3">
        Order here is the order on the site. Uploads keep their original file
        when it's already web-sized, and are resized to 2400 px otherwise.
      </p>
    </>
  );
}

function DesignRow({
  design,
  index,
  count,
  expanded,
  categories,
  onToggle,
  onMove,
  onChange,
  onDelete,
}: {
  design: Design;
  index: number;
  count: number;
  expanded: boolean;
  categories: string[];
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onChange: (next: Partial<Design>) => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const problem = designProblem(design);
  const status = design.hidden ? "Hidden" : problem ? "Not on site" : "Live";
  const listId = `design-categories-${design.id}`;

  return (
    <li className="px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <IconButton icon="keyboard_arrow_up" label="Move up" onClick={() => onMove(-1)} disabled={index === 0} />
          <IconButton icon="keyboard_arrow_down" label="Move down" onClick={() => onMove(1)} disabled={index === count - 1} />
        </div>
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-sm border border-rule bg-row-alt p-1">
          {design.image ? (
            <img src={design.image} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="font-ui text-[10px] text-ink-subtle">No image</span>
          )}
        </span>
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-doc text-[15px] font-semibold text-ink">
            {design.title || "Untitled"}
          </span>
          <span className="block font-ui text-[11px] text-ink-subtle">
            {problem && !design.hidden ? problem : [design.category, design.year].filter(Boolean).join(" · ") || "—"}
          </span>
        </button>
        <span
          className={
            "shrink-0 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm " +
            (status === "Live"
              ? "bg-word-blue-light text-word-blue"
              : "bg-ribbon text-ink-muted")
          }
        >
          {status}
        </span>
        <IconButton icon={expanded ? "expand_less" : "edit"} label={expanded ? "Collapse" : `Edit ${design.title}`} onClick={onToggle} />
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 pl-2 sm:pl-12">
          <Row>
            <Field label="Title" required>
              <Input value={design.title} onChange={(v) => onChange({ title: v })} placeholder="Summer Fest 2026 poster" />
            </Field>
            <Field label="Category" hint="Drives the filter chips">
              <input
                list={listId}
                value={design.category ?? ""}
                onChange={(e) => onChange({ category: e.target.value || undefined })}
                placeholder="Poster, Logo, Social…"
                className="w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none transition-colors focus:border-word-blue focus:ring-2 focus:ring-word-blue/20"
              />
              <datalist id={listId}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </Row>
          <Field label="Alt text" required hint="What's visibly in it, not what it's for">
            <Input
              value={design.alt}
              onChange={(v) => onChange({ alt: v })}
              placeholder="Poster with a large orange sun over a blue wave and the words Summer Fest in bold white type"
            />
          </Field>
          <Field label="Caption" hint="The brief, the idea, the outcome">
            <Textarea
              value={design.caption ?? ""}
              onChange={(v) => onChange({ caption: v || undefined })}
              rows={3}
            />
          </Field>
          <Row>
            <Field label="Year">
              <Input value={design.year ?? ""} onChange={(v) => onChange({ year: v || undefined })} placeholder="2026" />
            </Field>
            <Field label="Made with" hint="Comma-separated">
              <Input
                value={(design.tools ?? []).join(", ")}
                onChange={(v) => {
                  const tools = v.split(",").map((t) => t.trim()).filter(Boolean);
                  onChange({ tools: tools.length ? tools : undefined });
                }}
                placeholder="Illustrator, Photoshop"
              />
            </Field>
          </Row>
          <Field label="Project link" hint="Behance, Dribbble, or the live piece">
            <Input type="url" value={design.link ?? ""} onChange={(v) => onChange({ link: v || undefined })} placeholder="https://www.behance.net/…" />
          </Field>

          <details className="group">
            <summary className="cursor-pointer font-ui text-[12px] font-medium text-word-blue">
              Replace the image
            </summary>
            <div className="mt-3">
              <ImageField
                image={design.image}
                alt={design.alt}
                folder="designs"
                uploadLabel="Upload replacement"
                altPlaceholder="What's visibly in it"
                onChange={({ image, alt }) => onChange({ image: image ?? "", alt: alt ?? "" })}
              />
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
            <Toggle
              checked={Boolean(design.hidden)}
              onChange={(hidden) => onChange({ hidden: hidden || undefined })}
              label="Hidden"
              hint="Keep it here, off the site"
            />
            {confirm ? (
              <div className="flex items-center gap-2">
                <span className="font-ui text-[12px] text-ink">Delete this piece?</span>
                <Button variant="danger" icon="delete" onClick={onDelete}>
                  Delete
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button variant="danger" icon="delete" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
