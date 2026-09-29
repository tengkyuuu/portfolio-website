export const BLUE_MEMES = {
  coffee: { src: "/blue/coffee-blue.jpg", alt: "Blue holding a cup of coffee", label: "Coffee break" },
  working: { src: "/blue/working-blue.jpg", alt: "Blue wearing glasses and working at a laptop", label: "Working" },
  searching: { src: "/blue/searching-blue.jpg", alt: "Blue studying a sheet of paper", label: "Investigating" },
  needmoney: { src: "/blue/needmoney-blue.jpg", alt: "Blue in ragged clothes beside an empty bowl", label: "Need a little funding" },
  like: { src: "/blue/like-blue.jpg", alt: "Blue smiling and giving a thumbs-up", label: "Love that" },
  cry: { src: "/blue/cry-blue.jpg", alt: "Blue crying", label: "Feeling it" },
  corporate: { src: "/blue/corporate-blue.jpg", alt: "Blue wearing a tie and carrying a shoulder bag", label: "Business mode" },
} as const;

export type BlueMood = keyof typeof BLUE_MEMES;
export function blueMood(value: unknown): BlueMood {
  return typeof value === "string" && Object.hasOwn(BLUE_MEMES, value) ? value as BlueMood : "coffee";
}

export const ACTIVITY_PRESETS = ["Working", "On Vacation", "Sleeping", "Studying", "Taking a break"];
export const PH_TIME_ZONE = "Asia/Manila";
export function philippineTime(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: PH_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(date);
}
