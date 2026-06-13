import { useState } from "react";
import type { Metric, Project } from "../../lib/content";
import { GalleryField } from "./GalleryField";
import { Button, Card, Field, IconButton, Input, Row, Textarea } from "./ui";
import { useEditableSection } from "./useEditableSection";

const KIND_OPTIONS = [
  { value: "embedded", label: "Embedded" },
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
  { value: "design", label: "Design" },
] as const;

function blankProject(index: number): Project {
  const idx = String(index).padStart(2, "0");
  return {
    id: `custom-${Date.now()}`,
    index: idx,
    title: "New project",
    blurb: "",
    tags: [],
    stack: [],
    kind: "web",
    links: [],
    ref: `REF: JVC-${new Date().getFullYear()}-${idx}`,
    year: String(new Date().getFullYear()),
    page: idx,
    figCaption: "",
    challenge: "",
    solution: "",
    gallery: [],
  };
}

export function ProjectsEditor() {
  const { value, update, reset } = useEditableSection("projects");
  const [openId, setOpenId] = useState<string | null>(value[0]?.id ?? null);

  function moveProject(i: number, dir: -1 | 1) {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    // Renumber indices so they stay sequential (01, 02, ...)
    update(
      next.map((p, idx) => ({
        ...p,
        index: String(idx + 1).padStart(2, "0"),
      }))
    );
  }

  function setProject(id: string, partial: Partial<Project>) {
    update(value.map((p) => (p.id === id ? { ...p, ...partial } : p)));
  }

  function addProject() {
    const next = blankProject(value.length + 1);
    update([...value, next]);
    setOpenId(next.id);
  }

  function removeProject(id: string) {
    const remaining = value.filter((p) => p.id !== id);
    update(
      remaining.map((p, idx) => ({ ...p, index: String(idx + 1).padStart(2, "0") }))
    );
    if (openId === id) setOpenId(remaining[0]?.id ?? null);
  }

  return (
    <Card
      title="Projects"
      description={`${value.length} project${value.length === 1 ? "" : "s"}. Drag-equivalent: use ▲▼ to reorder.`}
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" icon="add" onClick={addProject}>
            New project
          </Button>
          <Button variant="ghost" icon="restart_alt" onClick={reset}>
            Reset
          </Button>
        </div>
      }
    >
      {value.length === 0 ? (
        <p className="font-ui text-[13px] text-ink-subtle italic">
          No projects yet. Click <b>New project</b>.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((p, i) => (
            <li
              key={p.id}
              className="border border-rule rounded-sm bg-paper overflow-hidden"
            >
              <ProjectRow
                project={p}
                open={openId === p.id}
                first={i === 0}
                last={i === value.length - 1}
                onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                onMoveUp={() => moveProject(i, -1)}
                onMoveDown={() => moveProject(i, 1)}
                onChange={(partial) => setProject(p.id, partial)}
                onRemove={() => removeProject(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type RowProps = {
  project: Project;
  open: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChange: (partial: Partial<Project>) => void;
  onRemove: () => void;
};

function ProjectRow({
  project,
  open,
  first,
  last,
  onToggle,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
}: RowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={open ? "bg-row-alt" : ""}>
      {/* Compact header — always visible */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col">
          <IconButton
            icon="keyboard_arrow_up"
            label="Move up"
            onClick={onMoveUp}
            disabled={first}
          />
          <IconButton
            icon="keyboard_arrow_down"
            label="Move down"
            onClick={onMoveDown}
            disabled={last}
          />
        </div>
        <span className="font-ui text-[11px] font-semibold text-ink-subtle tabular-nums w-8 shrink-0">
          {project.index}
        </span>
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 text-left flex items-center gap-2"
        >
          <span className="font-doc text-[15px] font-semibold text-ink truncate">
            {project.title || "(untitled)"}
          </span>
          <span className="hidden sm:inline font-ui text-[11px] uppercase tracking-wider text-ink-subtle">
            {project.kind}
          </span>
        </button>
        <IconButton
          icon={open ? "expand_less" : "expand_more"}
          label={open ? "Collapse" : "Expand"}
          onClick={onToggle}
        />
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <span className="font-ui text-[11px] text-red-600 dark:text-red-400 italic">
              Delete?
            </span>
            <Button variant="danger" onClick={onRemove}>
              Yes
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              No
            </Button>
          </div>
        ) : (
          <IconButton
            icon="delete"
            label="Delete project"
            onClick={() => setConfirmDelete(true)}
            danger
          />
        )}
      </div>

      {open && (
        <div className="border-t border-rule px-5 py-5">
          <ProjectForm project={project} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function ProjectForm({
  project,
  onChange,
}: {
  project: Project;
  onChange: (partial: Partial<Project>) => void;
}) {
  function setMetric(i: number, partial: Partial<Metric>) {
    const next = (project.metrics ?? []).map((m, idx) =>
      idx === i ? { ...m, ...partial } : m
    );
    onChange({ metrics: next });
  }
  function addMetric() {
    onChange({
      metrics: [
        ...(project.metrics ?? []),
        { label: "", pre: "", post: "", delta: "" },
      ],
    });
  }
  function removeMetric(i: number) {
    onChange({ metrics: (project.metrics ?? []).filter((_, idx) => idx !== i) });
  }

  function setLink(i: number, partial: Partial<{ label: string; href: string }>) {
    onChange({
      links: project.links.map((l, idx) => (idx === i ? { ...l, ...partial } : l)),
    });
  }
  function addLink() {
    onChange({ links: [...project.links, { label: "", href: "" }] });
  }
  function removeLink(i: number) {
    onChange({ links: project.links.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-5">
      <Row>
        <Field label="Title" required>
          <Input
            value={project.title}
            onChange={(v) => onChange({ title: v })}
          />
        </Field>
        <Field label="Kind">
          <select
            value={project.kind}
            onChange={(e) => onChange({ kind: e.target.value as Project["kind"] })}
            className="w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <Row>
        <Field label="Reference code">
          <Input
            value={project.ref ?? ""}
            onChange={(v) => onChange({ ref: v })}
            placeholder="REF: JVC-2025-01"
          />
        </Field>
        <Row>
          <Field label="Year">
            <Input
              value={project.year ?? ""}
              onChange={(v) => onChange({ year: v })}
              placeholder="2025"
            />
          </Field>
          <Field label="TOC page">
            <Input
              value={project.page ?? ""}
              onChange={(v) => onChange({ page: v })}
              placeholder="02"
            />
          </Field>
        </Row>
      </Row>

      <Field label="One-line blurb" hint="Used when Challenge/Solution are blank">
        <Textarea
          value={project.blurb}
          onChange={(v) => onChange({ blurb: v })}
          rows={2}
        />
      </Field>

      <Row>
        <Field
          label="Tags"
          hint="Pills inside the figure"
        >
          <Input
            value={project.tags.join(", ")}
            onChange={(v) =>
              onChange({
                tags: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Flutter, BLE, Firebase"
          />
        </Field>
        <Field
          label="Tech stack"
          hint="Chips under the write-up"
        >
          <Input
            value={(project.stack ?? []).join(", ")}
            onChange={(v) =>
              onChange({
                stack: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Flutter, Dart, Firebase, Riverpod"
          />
        </Field>
      </Row>

      <Field label="Figure caption" hint='Defaults to "FIG N.1: {title}."'>
        <Input
          value={project.figCaption ?? ""}
          onChange={(v) => onChange({ figCaption: v })}
          placeholder="FIG 1.1: Sensor fusion stack…"
        />
      </Field>

      <Field
        label="Figure images"
        hint="One screenshot, or 2+ for a carousel with arrows"
      >
        <GalleryField
          images={project.gallery ?? []}
          onChange={(gallery) => onChange({ gallery })}
        />
      </Field>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Field
          label="Challenge"
          hint="The problem you set out to solve"
        >
          <Textarea
            value={project.challenge ?? ""}
            onChange={(v) => onChange({ challenge: v })}
            rows={6}
            serif
          />
        </Field>
        <Field
          label="Solution"
          hint="What you built and the outcome"
        >
          <Textarea
            value={project.solution ?? ""}
            onChange={(v) => onChange({ solution: v })}
            rows={6}
            serif
          />
        </Field>
      </div>

      {/* Metrics */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Metrics{" "}
            <span className="font-normal text-ink-subtle normal-case tracking-normal">
              · optional, shown as a small table
            </span>
          </span>
          <Button variant="secondary" icon="add" onClick={addMetric}>
            Add metric
          </Button>
        </div>
        {(project.metrics ?? []).length === 0 ? (
          <p className="font-ui text-[12px] text-ink-subtle italic">
            No metrics. Add one to render the Pre / Post / Δ table for this project.
          </p>
        ) : (
          <ul className="space-y-2">
            {(project.metrics ?? []).map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Input
                    value={m.label}
                    onChange={(v) => setMetric(i, { label: v })}
                    placeholder="Metric"
                  />
                  <Input
                    value={m.pre}
                    onChange={(v) => setMetric(i, { pre: v })}
                    placeholder="Pre"
                  />
                  <Input
                    value={m.post}
                    onChange={(v) => setMetric(i, { post: v })}
                    placeholder="Post"
                  />
                  <Input
                    value={m.delta}
                    onChange={(v) => setMetric(i, { delta: v })}
                    placeholder="Δ (e.g. +85%)"
                  />
                </div>
                <IconButton
                  icon="delete"
                  label="Remove metric"
                  onClick={() => removeMetric(i)}
                  danger
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Links */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Links
          </span>
          <Button variant="secondary" icon="add" onClick={addLink}>
            Add link
          </Button>
        </div>
        {project.links.length === 0 ? (
          <p className="font-ui text-[12px] text-ink-subtle italic">
            No links yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {project.links.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    value={l.label}
                    onChange={(v) => setLink(i, { label: v })}
                    placeholder="Label (Repo, Case study…)"
                  />
                  <Input
                    value={l.href}
                    onChange={(v) => setLink(i, { href: v })}
                    placeholder="https://…"
                    className="sm:col-span-2"
                  />
                </div>
                <IconButton
                  icon="delete"
                  label="Remove link"
                  onClick={() => removeLink(i)}
                  danger
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
