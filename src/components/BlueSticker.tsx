import { useState } from "react";
import { BLUE_MEMES, blueMood } from "../lib/blue";
import "./blue.css";

export function BlueSticker({ mood = "coffee", caption }: { mood?: string; caption?: string }) {
  const [bounce, setBounce] = useState(0);
  const meme = BLUE_MEMES[blueMood(mood)];
  return <button type="button" className="blue-sticker" onClick={() => setBounce(n => n + 1)} aria-label={`Give Blue a boop. ${caption || meme.label}`}>
    <img key={bounce} src={meme.src} alt={meme.alt} className="blue-sticker-image" draggable={false} />
    <span>{caption || meme.label} <span aria-hidden="true">✦</span></span>
  </button>;
}
