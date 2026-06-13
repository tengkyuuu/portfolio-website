import type { ContactChannel } from "../../lib/content";
import { Button, Card, Field, IconButton, Input, Row, Textarea } from "./ui";
import { useEditableSection } from "./useEditableSection";

const ICON_PRESETS = [
  "mail",
  "code",
  "link",
  "location_on",
  "phone",
  "chat",
  "language",
  "alternate_email",
];

export function ContactEditor() {
  const { value, update, reset } = useEditableSection("contact");

  function moveChannel(i: number, dir: -1 | 1) {
    const next = [...value.channels];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update({ ...value, channels: next });
  }

  function setChannel(i: number, partial: Partial<ContactChannel>) {
    const next = value.channels.map((c, idx) =>
      idx === i ? { ...c, ...partial } : c
    );
    update({ ...value, channels: next });
  }

  function addChannel() {
    update({
      ...value,
      channels: [
        ...value.channels,
        { label: "", value: "", href: "", icon: "link" },
      ],
    });
  }

  function removeChannel(i: number) {
    update({ ...value, channels: value.channels.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <Card
        title="Intro"
        description="The paragraph at the top of the Contact tab."
        actions={
          <Button variant="ghost" icon="restart_alt" onClick={reset}>
            Reset section
          </Button>
        }
      >
        <Field
          label="Intro paragraph"
          hint="Markdown-lite: **bold**, *italic*, [link](url)."
        >
          <Textarea
            value={value.intro}
            onChange={(v) => update({ ...value, intro: v })}
            rows={4}
            serif
          />
        </Field>
      </Card>

      <Card
        title="Channels"
        description="The contact channel grid (Email, GitHub, LinkedIn, etc.)"
        actions={
          <Button variant="secondary" icon="add" onClick={addChannel}>
            Add channel
          </Button>
        }
      >
        {value.channels.length === 0 ? (
          <p className="font-ui text-[13px] text-ink-subtle italic">
            No channels yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {value.channels.map((channel, i) => (
              <li
                key={i}
                className="border border-rule rounded-sm bg-row-alt p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col">
                    <IconButton
                      icon="keyboard_arrow_up"
                      label="Move up"
                      onClick={() => moveChannel(i, -1)}
                      disabled={i === 0}
                    />
                    <IconButton
                      icon="keyboard_arrow_down"
                      label="Move down"
                      onClick={() => moveChannel(i, 1)}
                      disabled={i === value.channels.length - 1}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <Row>
                      <Field label="Label">
                        <Input
                          value={channel.label}
                          onChange={(v) => setChannel(i, { label: v })}
                          placeholder="Email"
                        />
                      </Field>
                      <Field
                        label="Icon"
                        hint="Material Symbol name"
                      >
                        <div className="flex gap-2">
                          <Input
                            value={channel.icon}
                            onChange={(v) => setChannel(i, { icon: v })}
                            placeholder="mail"
                            className="flex-1"
                          />
                          <span
                            className="material-symbols-outlined text-ink-muted grid place-items-center w-9 h-9 bg-paper border border-rule rounded-sm"
                            style={{ fontSize: 18 }}
                          >
                            {channel.icon || "link"}
                          </span>
                        </div>
                      </Field>
                    </Row>
                    <div className="flex flex-wrap gap-1">
                      {ICON_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setChannel(i, { icon: p })}
                          className={
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border font-ui text-[11px] transition-colors " +
                            (channel.icon === p
                              ? "border-word-blue text-word-blue bg-word-blue-light"
                              : "border-rule text-ink-subtle hover:bg-ribbon-hover")
                          }
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 12 }}
                          >
                            {p}
                          </span>
                          {p}
                        </button>
                      ))}
                    </div>
                    <Row>
                      <Field label="Display value">
                        <Input
                          value={channel.value}
                          onChange={(v) => setChannel(i, { value: v })}
                          placeholder="you@example.com"
                        />
                      </Field>
                      <Field label="Link (href)">
                        <Input
                          value={channel.href}
                          onChange={(v) => setChannel(i, { href: v })}
                          placeholder="mailto:you@example.com"
                        />
                      </Field>
                    </Row>
                  </div>
                  <IconButton
                    icon="delete"
                    label="Remove channel"
                    onClick={() => removeChannel(i)}
                    danger
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
