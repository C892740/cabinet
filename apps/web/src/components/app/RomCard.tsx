"use client";

import { motion } from "framer-motion";
import { RomCover } from "../RomCover";
import { DownloadIcon, HeartIcon, PlayIcon } from "../Icons";
import { AchievementChip, TierIcon } from "../achievements/Achievements";
import type { Platform, Rom } from "@/lib/types";

export function RomCard({
  rom,
  platform,
  onSelect,
  onToggleFavorite,
}: {
  rom: Rom;
  platform: Platform;
  onSelect: (rom: Rom) => void;
  onToggleFavorite: (rom: Rom) => void;
}) {
  const summary = rom.achievements ?? null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="group relative"
    >
      <button
        type="button"
        onClick={() => onSelect(rom)}
        className="focus-ring block w-full rounded-3xl text-left"
        aria-label={`Open ${rom.title}`}
      >
        <div className="relative">
          <RomCover
            rom={rom}
            platform={platform}
            className="aspect-[3/4] shadow-card transition-all duration-500 group-hover:shadow-card-hover"
          />
          {/* hover shine */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* achievements pop-up */}
          {summary && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
              <div className="glass-strong flex items-center gap-2.5 rounded-2xl px-3 py-2 shadow-card">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold leading-none text-white">
                    {summary.completionPct}%
                  </span>
                  <span className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50">
                    {summary.unlocked}/{summary.total}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(["gold", "silver", "bronze"] as const).map((tier) => (
                    <TierIcon key={tier} tier={tier} size={13} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* hover actions */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
            <span className="accent-gradient inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-glow">
              <PlayIcon size={16} />
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/90 backdrop-blur-md">
                <DownloadIcon size={15} />
              </span>
            </span>
          </div>
        </div>
      </button>

      <div className="mt-3 flex items-start gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium tracking-tight text-white/90">
            {rom.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-white/45">
            {platform.shortName} · {rom.genre} · ★ {rom.rating.toFixed(1)}
          </p>
          {summary && (
            <div className="mt-1.5">
              <AchievementChip summary={summary} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(rom)}
          aria-label={rom.favorite ? "Remove from favourites" : "Add to favourites"}
          className={`focus-ring mt-0.5 rounded-full p-1.5 transition-all duration-300 hover:scale-110 ${
            rom.favorite ? "text-rose-400" : "text-white/35 hover:text-white/80"
          }`}
        >
          <HeartIcon size={17} filled={rom.favorite} />
        </button>
      </div>
    </motion.article>
  );
}
