import { Button, Card, Field, IconButton, Input, Row, Textarea } from "./ui";
import { useEditableSection } from "./useEditableSection";

export function AboutEditor() {
  const { value, update, reset } = useEditableSection("about");

  function moveSpec(i: number, dir: -1 | 1) {
    const next = [...value.specs];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update({ ...value, specs: next });
  }

  function updateSpec(i: number, field: "label" | "value", v: string) {
    const next = value.specs.map((s, idx) => (idx === i ? { ...s, [field]: v } : s));
    update({ ...value, specs: next });
  }

  function addSpec() {
    update({ ...value, specs: [...value.specs, { label: "", value: "" }] });
  }

  function removeSpec(i: number) {
    update({ ...value, specs: value.specs.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <Card
        title="Executive Summary"
        description="The main body paragraphs of the About tab."
        actions={
          <Button variant="ghost" icon="restart_alt" onClick={reset}>
            Reset section
          </Button>
        }
      >
        <Field
          label="Lead paragraph(s)"
          hint="Keep it short. Markdown-lite: **bold**, *italic*, [link](url). Blank line = new paragraph."
        >
          <Textarea
            value={value.paragraphs}
            onChange={(v) => update({ ...value, paragraphs: v })}
            rows={5}
            serif
          />
        </Field>

        <Field
          label="Highlights"
          hint="One per line. Shown as a scannable bullet strip."
        >
          <Textarea
            value={(value.highlights ?? []).join("\n")}
            onChange={(v) =>
              update({
                ...value,
                highlights: v
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={4}
            placeholder={"Embedded systems — firmware, sensors, PCB design\nFrontend engineering — React, TypeScript, responsive UI"}
          />
        </Field>
      </Card>

      <Card
        title="Spec Sheet"
        description="The two-column key/value block under the summary."
        actions={
          <Button variant="secondary" icon="add" onClick={addSpec}>
            Add row
          </Button>
        }
      >
        {value.specs.length === 0 ? (
          <p className="font-ui text-[13px] text-ink-subtle italic">
            No spec rows. Click <b>Add row</b> to start.
          </p>
        ) : (
          <ul className="space-y-2">
            {value.specs.map((spec, i) => (
              <li
                key={i}
                className="flex items-center gap-2 bg-row-alt border border-rule rounded-sm px-2 py-2"
              >
                <div className="flex flex-col">
                  <IconButton
                    icon="keyboard_arrow_up"
                    label="Move up"
                    onClick={() => moveSpec(i, -1)}
                    disabled={i === 0}
                  />
                  <IconButton
                    icon="keyboard_arrow_down"
                    label="Move down"
                    onClick={() => moveSpec(i, 1)}
                    disabled={i === value.specs.length - 1}
                  />
                </div>
                <Row className="flex-1">
                  <Input
                    value={spec.label}
                    onChange={(v) => updateSpec(i, "label", v)}
                    placeholder="Label (e.g. Role)"
                  />
                  <Input
                    value={spec.value}
                    onChange={(v) => updateSpec(i, "value", v)}
                    placeholder="Value (e.g. Computer Engineer)"
                  />
                </Row>
                <IconButton
                  icon="delete"
                  label="Remove"
                  onClick={() => removeSpec(i)}
                  danger
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
