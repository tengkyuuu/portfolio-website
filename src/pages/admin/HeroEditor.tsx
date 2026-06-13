import { Button, Card, Field, Input, Row, Textarea, Toggle } from "./ui";
import { useEditableSection } from "./useEditableSection";

export function HeroEditor() {
  const { value, update, reset } = useEditableSection("hero");

  return (
    <>
      <Card
        title="Document Header"
        description="Name, role, contact line, and the eyebrow above the title."
        actions={
          <Button variant="ghost" icon="restart_alt" onClick={reset}>
            Reset section
          </Button>
        }
      >
        <Field label="Eyebrow" hint="Small label above the name">
          <Input
            value={value.eyebrow}
            onChange={(v) => update({ ...value, eyebrow: v })}
            placeholder="Portfolio · 2026 Edition"
          />
        </Field>

        <div className="mt-4">
          <Field label="Full name" required>
            <Input
              value={value.name}
              onChange={(v) => update({ ...value, name: v })}
              placeholder="James Vincent Calunsag"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Role / one-liner">
            <Input
              value={value.role}
              onChange={(v) => update({ ...value, role: v })}
              placeholder="Computer Engineer · Embedded · Frontend · Design"
            />
          </Field>
        </div>

        <Row className="mt-4">
          <Field label="Email">
            <Input
              type="email"
              value={value.email}
              onChange={(v) => update({ ...value, email: v })}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Website">
            <Input
              value={value.website}
              onChange={(v) => update({ ...value, website: v })}
              placeholder="jvc.dev"
            />
          </Field>
        </Row>

        <div className="mt-4">
          <Field label="Location">
            <Input
              value={value.location}
              onChange={(v) => update({ ...value, location: v })}
              placeholder="Dapitan City, PH"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <Toggle
            checked={value.available}
            onChange={(v) => update({ ...value, available: v })}
            label="Show availability pill"
            hint="The pulsing blue dot + status text"
          />
          <div className="flex-1 sm:max-w-xs">
            <Input
              value={value.availableText}
              onChange={(v) => update({ ...value, availableText: v })}
              placeholder="Available for work"
            />
          </div>
        </div>
      </Card>

      <Card
        title="Body Copy"
        description="Pull-quote tagline, abstract paragraphs, and the contents list."
      >
        <Field
          label="Tagline (pull quote)"
          hint="Inline HTML allowed: <em>, <strong>"
        >
          <Textarea
            value={value.tagline}
            onChange={(v) => update({ ...value, tagline: v })}
            rows={2}
            serif
            placeholder="Hardware up, pixel out…"
          />
        </Field>

        <div className="mt-4">
          <Field
            label="Abstract"
            hint="Markdown-lite: **bold**, *italic*, [link](url). Blank line = new paragraph."
          >
            <Textarea
              value={value.abstract}
              onChange={(v) => update({ ...value, abstract: v })}
              rows={8}
              serif
              placeholder="This document is a working portfolio…"
            />
          </Field>
        </div>

        <div className="mt-5">
          <Toggle
            checked={value.showContents}
            onChange={(v) => update({ ...value, showContents: v })}
            label="Show Table of Contents"
            hint="Auto-generated from the other tabs"
          />
        </div>
      </Card>
    </>
  );
}
