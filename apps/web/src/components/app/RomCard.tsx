"use client";

import { motion } from "framer-motion";
import { CoverArt } from "../CoverArt";
import { DownloadIcon, HeartIcon, PlayIcon } from "../Icons";
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
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="group"
    >
      <button
        type="button"
        onClick={() => onSelect(rom)}
        className="focus-ring block w-full rounded-3xl text-left"
        aria-label={`Open ${rom.title}`}
      >
        <div className="relative">
          <CoverArt
            rom={rom}
            platform={platform}
            className="aspect-[3/4] shadow-card transition-all duration-500 group-hover:shadow-card-hover"
          />
          {/* hover shine */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

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
