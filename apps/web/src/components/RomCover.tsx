"use client";

import { useEffect, useMemo, useState } from "react";
import { CoverArt } from "./CoverArt";
import { coverCandidates } from "@/lib/covers";
import type { Platform, Rom } from "@/lib/types";

/**
 * A rom's cover, resolved automatically.
 *
 * Tries the stored cover URL, then the Libretro thumbnail candidates for the
 * title, and finally falls back to the generated CoverArt — so a cover always
 * appears, and it is real box art whenever a source has it.
 */
export function RomCover({
  rom,
  platform,
  className = "",
  rounded = "rounded-2xl",
  showBadge = true,
  showTitle = true,
}: {
  rom: Rom;
  platform: Platform;
  className?: string;
  rounded?: string;
  showBadge?: boolean;
  showTitle?: boolean;
}) {
  const candidates = useMemo(() => coverCandidates(rom), [rom]);
  const [index, setIndex] = useState(0);
  const [imageOk, setImageOk] = useState(false);

  useEffect(() => {
    setIndex(0);
    setImageOk(false);
  }, [rom.id, rom.coverUrl]);

  const url = candidates[index];

  if (!url) {
    return (
      <CoverArt
        rom={rom}
        platform={platform}
        className={className}
        rounded={rounded}
        showBadge={showBadge}
        showTitle={showTitle}
      />
    );
  }

  return (
    <div
      className={`relative isolate overflow-hidden bg-ink-900 ${rounded} ${className}`}
      style={{ containerType: "inline-size" }}
    >
      <img
        key={url}
        src={url}
        alt=""
        loading="lazy"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${imageOk ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setImageOk(true)}
        onError={() => {
          setImageOk(false);
          setIndex((i) => i + 1);
        }}
      />
      {/* legibility gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

      {!imageOk && (
        <div className="absolute inset-0">
          <CoverArt
            rom={rom}
            platform={platform}
            className="h-full w-full"
            rounded="rounded-none"
            showBadge={showBadge}
            showTitle={showTitle}
          />
        </div>
      )}

      {showBadge && imageOk && (
        <span className="absolute left-[6%] top-[5%] rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
          {platform.shortName}
        </span>
      )}
    </div>
  );
}
