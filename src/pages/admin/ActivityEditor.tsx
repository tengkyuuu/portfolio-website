import { ACTIVITY_PRESETS, BLUE_MEMES, PH_TIME_ZONE } from "../../lib/blue";
import { useEditableSection } from "./useEditableSection";
import { Card, Field, Input, Textarea } from "./ui";
import { ImageField } from "./ImageField";
import type { ActivityContent } from "../../lib/content";
import { SpotifySetup } from "./SpotifySetup";

export function ActivityEditor() {
  const { value, update } = useEditableSection("activity");
  const change = (patch: Partial<ActivityContent>) => update({ ...value, ...patch, updatedAt: new Date().toISOString() });
  return <>
    <Card title="What are you up to?" description="Visitors can open your profile button at the upper right to see this update and your Spotify. Changes save automatically.">
      <div className="flex flex-wrap gap-2 mb-4">{ACTIVITY_PRESETS.map(status => <button type="button" key={status} aria-pressed={value.status === status} onClick={() => change({ status })} className={`border border-rule rounded-full px-3 py-1.5 font-ui text-xs ${value.status === status ? "bg-word-blue text-paper" : "text-ink hover:bg-row-alt"}`}>{status}</button>)}</div>
      <Field label="Status (or write your own)"><Input value={value.status} onChange={status => change({ status: status.slice(0, 80) })} placeholder="Working on something new" /></Field>
      <div className="mt-4"><Field label="A little context"><Textarea value={value.note} onChange={note => change({ note: note.slice(0, 400) })} placeholder="What is keeping you busy?" /></Field></div>
      <p className="font-ui text-xs text-ink-muted mt-4">Local clock: Philippines · UTC+8 · {PH_TIME_ZONE}</p>
    </Card>
    <Card title="Pick a Blue mood" description="Your meme appears inside the profile popover, after a visitor clicks.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Object.entries(BLUE_MEMES).map(([mood, meme]) => <button type="button" key={mood} onClick={() => change({ meme: mood, memeAlt: "" })} aria-pressed={value.meme === mood} className={`rounded-lg border-2 p-2 font-ui text-xs ${value.meme === mood ? "border-word-blue bg-word-blue-light" : "border-rule"}`}>
        <img src={meme.src} alt={meme.alt} className="h-24 w-full object-contain rounded bg-white mb-2" />{meme.label}
      </button>)}</div>
      <div className="mt-5"><ImageField image={Object.hasOwn(BLUE_MEMES, value.meme) ? undefined : value.meme} alt={value.memeAlt} onChange={({ image, alt }) => change({ meme: image || "coffee", memeAlt: alt || "" })} uploadLabel="Upload your own meme" altPlaceholder="Describe your meme" /></div>
    </Card>
    <SpotifySetup />
  </>;
}
