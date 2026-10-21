/**
 * Cabinet identity.
 *
 * The mark hides its idea in the first letter: the "C" of Cabinet is the
 * universal power symbol — a circle open at the top with a stem through the
 * gap. Read it as a letter, or read it as the button that powers on your
 * library. It scales from a 16px favicon to a wall-sized poster because it is
 * one continuous gesture.
 */

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="accent-gradient inline-flex items-center justify-center rounded-[26%] shadow-glow"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.68}
        height={size * 0.68}
        viewBox="0 0 512 512"
        role="img"
        aria-label="Cabinet"
      >
        <g
          stroke="currentColor"
          strokeWidth="52"
          strokeLinecap="round"
          fill="none"
          className="text-white"
        >
          <path d="M 324.8 173.7 A 120 120 0 1 1 187.2 173.7" />
          <path d="M 256 132 L 256 258" />
        </g>
      </svg>
    </span>
  );
}

export function Logo({ size = 34, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {withWordmark && (
        <span
          className="font-semibold tracking-tight text-white"
          style={{ fontSize: size * 0.55 }}
        >
          Cabinet
        </span>
      )}
    </span>
  );
}
