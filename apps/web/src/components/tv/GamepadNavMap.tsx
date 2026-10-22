/**
 * PS5-style gamepad button icons + the TV Mode navigation map.
 *
 * Cabinet's TV navigation speaks the standard Gamepad API (see TVMode), so the
 * legend shows DualSense-style glyphs — cross/circle/square/triangle in the
 * classic PlayStation colors, plus d-pad and stick — instead of raw
 * "button 0 / button 1" labels.
 */

export type PadGlyphKind = "cross" | "circle" | "square" | "triangle" | "dpad" | "stick";

/** Classic PlayStation face-button colours: ✕ blue, ○ red, □ pink, △ green. */
const GLYPH_COLORS: Record<PadGlyphKind, string> = {
  cross: "#5aa7f0",
  circle: "#ef5c6e",
  square: "#e072c8",
  triangle: "#4fc98e",
  dpad: "currentColor",
  stick: "currentColor",
};

/** The bare glyph, drawn like a DualSense button legend. */
export function PadGlyph({ kind, size = 16 }: { kind: PadGlyphKind; size?: number }) {
  const color = GLYPH_COLORS[kind];
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    fill: "none",
    stroke: color,
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  switch (kind) {
    case "cross":
      return (
        <svg {...common}>
          <path d="M7.6 7.6 16.4 16.4M16.4 7.6 7.6 16.4" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6.2" />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="5.9" y="5.9" width="12.2" height="12.2" rx="2.4" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M12 5.7 18.9 18.3H5.1z" />
        </svg>
      );
    case "dpad":
      return (
        <svg {...common} stroke="none" fill={color}>
          <rect x="9.7" y="3.4" width="4.6" height="17.2" rx="2" />
          <rect x="3.4" y="9.7" width="17.2" height="4.6" rx="2" />
        </svg>
      );
    case "stick":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.3" />
          <circle cx="12" cy="12" r="2.7" fill={color} stroke="none" />
        </svg>
      );
  }
}

/** Glyph inside a round button cap — the way prompts appear on the PS5 UI. */
export function PadButton({
  kind,
  size = 18,
  title,
}: {
  kind: PadGlyphKind;
  size?: number;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.07]"
    >
      <PadGlyph kind={kind} size={size} />
    </span>
  );
}

/**
 * The gamepad navigation map: which controller input does what in TV Mode.
 * Reusable anywhere Cabinet shows gamepad hints.
 */
export function GamepadNavMap({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/55 ${className}`}
    >
      <span className="inline-flex items-center gap-2">
        <PadButton kind="dpad" size={15} title="D-pad" />
        <PadButton kind="stick" size={15} title="Left stick" />
        Navigate
      </span>
      <span className="inline-flex items-center gap-2">
        <PadButton kind="cross" title="Cross" />
        Select
      </span>
      <span className="inline-flex items-center gap-2">
        <PadButton kind="circle" title="Circle" />
        Back
      </span>
      <span className="hidden text-white/35 sm:inline">Up to four controllers</span>
    </div>
  );
}
