import { cn } from "../lib/utils";

type Props = {
  items: string[];
  speed?: "normal" | "slow";
  className?: string;
};

export function Marquee({ items, speed = "normal", className }: Props) {
  const doubled = [...items, ...items];
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        className={cn(
          "flex w-max gap-12 whitespace-nowrap",
          speed === "slow" ? "animate-marquee-slow" : "animate-marquee"
        )}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-12 font-mono text-sm uppercase tracking-widest text-fg-muted"
          >
            {item}
            <span className="text-fg-subtle">/</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg to-transparent" />
    </div>
  );
}
