import type { CSSProperties } from "react";
import type { Platform, Rom } from "@/lib/types";

/**
 * Generated cover art.
 *
 * Cabinet ships zero copyrighted artwork: every cover is rendered from the
 * platform's palette plus a deterministic seed, so the library looks rich and
 * consistent while remaining 100% original.
 */

const MOTIFS = ["orbit", "stripes", "arcs", "dots"] as const;

function motifStyle(motif: (typeof MOTIFS)[number], seed: number): CSSProperties {
  const rotation = (seed % 40) - 20;
  switch (motif) {
    case "stripes":
      return {
        backgroundImage: `repeating-linear-gradient(${115 + rotation}deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 10px, transparent 10px, transparent 26px)`,
      };
    case "dots":
      return {
        backgroundImage: `radial-gradient(rgba(255,255,255,0.22) 1.5px, transparent 1.6px)`,
        backgroundSize: "16px 16px",
        transform: `rotate(${rotation}deg) scale(1.4)`,
      };
    case "arcs":
      return {
        backgroundImage: `repeating-radial-gradient(circle at 78% 18%, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 2px, transparent 2px, transparent 22px)`,
      };
    default:
      return {
        backgroundImage: `radial-gradient(circle at 22% 78%, rgba(255,255,255,0.22) 0%, transparent 45%), radial-gradient(circle at 82% 22%, rgba(255,255,255,0.18) 0%, transparent 40%)`,
      };
  }
}

export function CoverArt({
  rom,
  platform,
  className = "",
  rounded = "rounded-2xl",
  showBadge = true,
}: {
  rom: Rom;
  platform: Platform;
  className?: string;
  rounded?: string;
  showBadge?: boolean;
}) {
  const motif = MOTIFS[rom.coverSeed % MOTIFS.length];
  const long = rom.title.length > 26;
  const titleSize = long
    ? "clamp(11px, 5.6cqw, 17px)"
    : rom.title.length > 16
      ? "clamp(12px, 6.6cqw, 20px)"
      : "clamp(13px, 7.6cqw, 23px)";

  return (
    <div
      className={`relative isolate overflow-hidden ${rounded} ${className}`}
      style={{
        containerType: "inline-size",
        backgroundImage: `linear-gradient(155deg, ${platform.colorA} 0%, ${platform.colorB} 82%)`,
      }}
    >
      {/* soft light source */}
      <div className="absolute -left-[18%] -top-[22%] h-[70%] w-[70%] rounded-full bg-white/25 blur-2xl" />
      {/* deterministic motif */}
      <div className="absolute inset-[-25%]" style={motifStyle(motif, rom.coverSeed)} />
      {/* fine grain */}
      <div className="absolute inset-0 noise opacity-[0.07] mix-blend-overlay" />
      {/* vignette so text stays readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/25" />

      {showBadge && (
        <span className="absolute left-[6%] top-[5%] rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
          {platform.shortName}
        </span>
      )}

      {/* star rating chip */}
      <span className="absolute right-[6%] top-[5%] rounded-full border border-white/20 bg-black/25 px-2 py-1 text-[9px] font-semibold text-white/90 backdrop-blur-md">
        ★ {rom.rating.toFixed(1)}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-[7%]">
        <h3
          className="font-semibold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
          style={{ fontSize: titleSize }}
        >
          {rom.title}
        </h3>
        <p className="mt-[3%] text-white/70" style={{ fontSize: "clamp(8px, 3.4cqw, 12px)" }}>
          {rom.year} · {rom.genre}
        </p>
      </div>
    </div>
  );
}
