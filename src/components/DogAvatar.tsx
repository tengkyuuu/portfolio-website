import { useId } from "react";
import type { BreedId } from "../lib/presence";

/**
 * A cartoon dog face for the presence stack — one per breed.
 *
 * One parametric head rather than ten drawings: every breed shares the
 * face (head, muzzle, nose, eyes, mouth) and differs in ears, markings
 * and the odd extra (a tongue, a top-knot, spots). Colours come from
 * `.dog-<breed>` custom properties in presence.css, never from here.
 */

type Ears = "pointy" | "big" | "floppy" | "long" | "fold" | "puff";
type Marking = "none" | "blaze" | "cheeks" | "mask" | "spots" | "wrinkle";

type Spec = {
  ears: Ears;
  marking: Marking;
  tongue?: boolean;
  /** Head radii — a pug is broad, a dachshund narrow. */
  head?: [number, number];
  /** Longer snout for the hounds. */
  snout?: boolean;
};

const SPECS: Record<BreedId, Spec> = {
  corgi: { ears: "big", marking: "blaze", tongue: true },
  shiba: { ears: "pointy", marking: "cheeks" },
  husky: { ears: "pointy", marking: "mask" },
  beagle: { ears: "floppy", marking: "blaze" },
  dachshund: { ears: "long", marking: "none", head: [15, 16], snout: true },
  pug: { ears: "fold", marking: "wrinkle", head: [18.5, 15.5] },
  dalmatian: { ears: "floppy", marking: "spots" },
  golden: { ears: "floppy", marking: "none", tongue: true },
  poodle: { ears: "puff", marking: "none" },
  collie: { ears: "pointy", marking: "blaze" },
};

function EarsShape({ kind }: { kind: Ears }) {
  const round = { strokeLinejoin: "round" as const, strokeWidth: 3 };
  switch (kind) {
    case "pointy":
      return (
        <g>
          <path d="M14 31 L17.5 9 L30 21 Z" fill="var(--dog-fur)" stroke="var(--dog-fur)" {...round} />
          <path d="M50 31 L46.5 9 L34 21 Z" fill="var(--dog-fur)" stroke="var(--dog-fur)" {...round} />
          <path d="M18 25.5 L19.5 14.5 L26 21 Z" fill="var(--dog-ear-inner)" />
          <path d="M46 25.5 L44.5 14.5 L38 21 Z" fill="var(--dog-ear-inner)" />
        </g>
      );
    case "big":
      return (
        <g>
          <path d="M12.5 32 L14.5 8 L30.5 20.5 Z" fill="var(--dog-fur)" stroke="var(--dog-fur)" {...round} />
          <path d="M51.5 32 L49.5 8 L33.5 20.5 Z" fill="var(--dog-fur)" stroke="var(--dog-fur)" {...round} />
          <path d="M16.5 26 L17.5 13.5 L26 20.5 Z" fill="var(--dog-ear-inner)" />
          <path d="M47.5 26 L46.5 13.5 L38 20.5 Z" fill="var(--dog-ear-inner)" />
        </g>
      );
    case "floppy":
      return (
        <g fill="var(--dog-ear)">
          <ellipse cx="16" cy="36" rx="7" ry="13" transform="rotate(16 16 36)" />
          <ellipse cx="48" cy="36" rx="7" ry="13" transform="rotate(-16 48 36)" />
        </g>
      );
    case "long":
      return (
        <g fill="var(--dog-ear)">
          <ellipse cx="17" cy="40" rx="6.5" ry="15.5" transform="rotate(12 17 40)" />
          <ellipse cx="47" cy="40" rx="6.5" ry="15.5" transform="rotate(-12 47 40)" />
        </g>
      );
    case "fold":
      return (
        <g fill="var(--dog-ear)" stroke="var(--dog-ear)" strokeLinejoin="round" strokeWidth={2.5}>
          <path d="M18 22 L8.5 25.5 L15.5 32 Z" />
          <path d="M46 22 L55.5 25.5 L48.5 32 Z" />
        </g>
      );
    case "puff":
      return (
        <g fill="var(--dog-ear)">
          <circle cx="15" cy="32" r="6.5" />
          <circle cx="13.5" cy="40" r="6.5" />
          <circle cx="16" cy="47" r="5.5" />
          <circle cx="49" cy="32" r="6.5" />
          <circle cx="50.5" cy="40" r="6.5" />
          <circle cx="48" cy="47" r="5.5" />
        </g>
      );
  }
}

function MarkingShape({ kind }: { kind: Marking }) {
  switch (kind) {
    case "blaze":
      return (
        <path
          d="M32 21.5 C30 21.5 29.4 25 29.6 29 C26.5 32.5 25 37.5 25.4 42 C26 48 29 51 32 51 C35 51 38 48 38.6 42 C39 37.5 37.5 32.5 34.4 29 C34.6 25 34 21.5 32 21.5 Z"
          fill="var(--dog-fur2)"
        />
      );
    case "cheeks":
      return (
        <g fill="var(--dog-fur2)">
          <ellipse cx="23.5" cy="42" rx="7.5" ry="5.5" />
          <ellipse cx="40.5" cy="42" rx="7.5" ry="5.5" />
          <circle cx="26.5" cy="29.3" r="1.7" />
          <circle cx="37.5" cy="29.3" r="1.7" />
        </g>
      );
    case "mask":
      return (
        <g fill="var(--dog-fur2)">
          <path d="M15.2 37 C18 31 24 31 27 35.5 C29 31.5 35 31.5 37 35.5 C40 31 46 31 48.8 37 C48.8 45.5 42 51 32 51 C22 51 15.2 45.5 15.2 37 Z" />
          <path d="M32 20 L29.8 31 L34.2 31 Z" />
          <circle cx="25.5" cy="29" r="1.8" />
          <circle cx="38.5" cy="29" r="1.8" />
        </g>
      );
    case "spots":
      return (
        <g fill="var(--dog-spot)">
          <circle cx="22" cy="27" r="2.6" />
          <circle cx="41.5" cy="25" r="1.9" />
          <circle cx="44.5" cy="38" r="2.3" />
          <circle cx="19.8" cy="39.5" r="1.6" />
          <circle cx="36.5" cy="22" r="1.4" />
          <circle cx="27" cy="48" r="1.3" />
        </g>
      );
    case "wrinkle":
      return (
        <path
          d="M27 25.5 Q32 22.8 37 25.5 M28.5 28.3 Q32 26.6 35.5 28.3"
          fill="none"
          stroke="var(--dog-ear)"
          strokeWidth={1.3}
          strokeLinecap="round"
          opacity={0.55}
        />
      );
    case "none":
      return null;
  }
}

export function DogAvatar({
  breed,
  size = 26,
  className = "",
}: {
  breed: BreedId;
  size?: number;
  className?: string;
}) {
  const clip = useId();
  const spec = SPECS[breed];
  const [rx, ry] = spec.head ?? [17, 16];

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`dog-avatar dog-${breed} ${className}`}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <circle cx="32" cy="32" r="32" fill="var(--dog-bg)" />
        {spec.ears === "puff" && (
          <g fill="var(--dog-ear)">
            <circle cx="25.5" cy="18" r="7" />
            <circle cx="32" cy="14.5" r="8" />
            <circle cx="38.5" cy="18" r="7" />
          </g>
        )}
        <EarsShape kind={spec.ears} />
        <ellipse cx="32" cy="36" rx={rx} ry={ry} fill="var(--dog-fur)" />
        <MarkingShape kind={spec.marking} />
        <ellipse
          cx="32"
          cy={spec.snout ? 44.5 : 43.5}
          rx={spec.snout ? 7 : 8.5}
          ry={spec.snout ? 7.5 : 6.5}
          fill="var(--dog-muzzle)"
        />
        <ellipse cx="21.5" cy="40.5" rx="2.6" ry="1.6" fill="var(--dog-blush)" />
        <ellipse cx="42.5" cy="40.5" rx="2.6" ry="1.6" fill="var(--dog-blush)" />
        {/* Transparent except on a dark face, where a dark eye would vanish. */}
        <circle cx="25" cy="34" r="3.4" fill="var(--dog-eye-ring)" />
        <circle cx="39" cy="34" r="3.4" fill="var(--dog-eye-ring)" />
        <circle cx="25" cy="34" r="2.3" fill="var(--dog-eye)" />
        <circle cx="39" cy="34" r="2.3" fill="var(--dog-eye)" />
        <circle cx="25.8" cy="33.2" r="0.75" fill="var(--dog-glint)" />
        <circle cx="39.8" cy="33.2" r="0.75" fill="var(--dog-glint)" />
        <ellipse cx="32" cy="40.2" rx="3.7" ry="2.6" fill="var(--dog-nose)" />
        <ellipse cx="31" cy="39.4" rx="1.1" ry="0.6" fill="var(--dog-glint)" opacity={0.6} />
        {spec.tongue && <path d="M30.4 45.4 Q32 51 33.6 45.4 Z" fill="var(--dog-tongue)" />}
        <path
          d="M32 42.8 V44.8 M28.6 45.2 Q30.3 46.8 32 44.8 Q33.7 46.8 35.4 45.2"
          fill="none"
          stroke="var(--dog-nose)"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
