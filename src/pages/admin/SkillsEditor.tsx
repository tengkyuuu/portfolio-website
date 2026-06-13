import type { SkillGroup } from "../../lib/content";
import { Button, Card, Field, IconButton, Input } from "./ui";
import { useEditableSection } from "./useEditableSection";

export function SkillsEditor() {
  const { value, update, reset } = useEditableSection("skills");

  function moveGroup(i: number, dir: -1 | 1) {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  function setGroup(i: number, partial: Partial<SkillGroup>) {
    const next = value.map((g, idx) => (idx === i ? { ...g, ...partial } : g));
    update(next);
  }

  function addGroup() {
    update([...value, { label: "New group", items: [] }]);
  }

  function removeGroup(i: number) {
    update(value.filter((_, idx) => idx !== i));
  }

  function updateItems(i: number, raw: string) {
    const items = raw
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    setGroup(i, { items });
  }

  return (
    <Card
      title="Core Competencies"
      description="Each group becomes a bulleted column on the Skills tab."
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" icon="add" onClick={addGroup}>
            Add group
          </Button>
          <Button variant="ghost" icon="restart_alt" onClick={reset}>
            Reset
          </Button>
        </div>
      }
    >
      {value.length === 0 ? (
        <p className="font-ui text-[13px] text-ink-subtle italic">
          No skill groups. Click <b>Add group</b> to start.
        </p>
      ) : (
        <ul className="space-y-4">
          {value.map((group, i) => (
            <li
              key={i}
              className="border border-rule rounded-sm bg-row-alt p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex flex-col">
                  <IconButton
                    icon="keyboard_arrow_up"
                    label="Move up"
                    onClick={() => moveGroup(i, -1)}
                    disabled={i === 0}
                  />
                  <IconButton
                    icon="keyboard_arrow_down"
                    label="Move down"
                    onClick={() => moveGroup(i, 1)}
                    disabled={i === value.length - 1}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Field label="Group label">
                    <Input
                      value={group.label}
                      onChange={(v) => setGroup(i, { label: v })}
                      placeholder="e.g. Embedded"
                    />
                  </Field>
                </div>
                <IconButton
                  icon="delete"
                  label="Remove group"
                  onClick={() => removeGroup(i)}
                  danger
                />
              </div>

              <Field
                label="Items"
                hint="One per line or comma-separated"
              >
                <textarea
                  value={group.items.join("\n")}
                  onChange={(e) => updateItems(i, e.target.value)}
                  rows={Math.max(4, group.items.length)}
                  className="w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 font-ui leading-[1.6] resize-y"
                />
              </Field>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="font-ui text-[11px] uppercase tracking-wider text-ink-muted border border-rule rounded-sm px-2 py-0.5 bg-paper"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
