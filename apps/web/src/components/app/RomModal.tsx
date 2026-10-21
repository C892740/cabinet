"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RomCover } from "../RomCover";
import { AchievementsPanel } from "../achievements/Achievements";
import { coverProviderLabel } from "@/lib/covers";
import {
  ClockIcon,
  CloseIcon,
  DownloadIcon,
  GamepadIcon,
  HeartIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
} from "../Icons";
import { formatPlaytime, formatSize, timeAgo } from "@/lib/format";
import type { Platform, Rom } from "@/lib/types";

export function RomModal({
  rom,
  platform,
  onClose,
  onToggleFavorite,
}: {
  rom: Rom | null;
  platform: Platform | null;
  onClose: () => void;
  onToggleFavorite: (rom: Rom) => void;
}) {
  return (
    <AnimatePresence>
      {rom && platform && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 22 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="glass-strong relative z-10 w-full max-w-4xl overflow-hidden rounded-4xl shadow-card"
          >
            <button
              type="button"
              onClick={onClose}
              className="focus-ring absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/30 p-2 text-white/80 backdrop-blur-md transition-all hover:rotate-90 hover:bg-black/50"
              aria-label="Close dialog"
            >
              <CloseIcon size={18} />
            </button>

            <div className="grid gap-0 md:grid-cols-[300px_1fr]">
              <div className="p-6 md:p-7">
                <RomCover
                  rom={rom}
                  platform={platform}
                  className="aspect-[3/4] shadow-card"
                  rounded="rounded-3xl"
                />
                <p className="mt-2 text-center text-[10px] text-white/35">
                  {coverProviderLabel(rom.coverProvider)}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <button type="button" className="btn-primary !px-4 !py-2.5 text-xs">
                    <PlayIcon size={14} />
                    Play
                  </button>
                  <button type="button" className="btn-glass !px-4 !py-2.5 text-xs">
                    <DownloadIcon size={14} />
                    Download
                  </button>
                </div>
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-white/40">
                  <SparklesIcon size={11} />
                  In-browser emulation arrives in the Emulators update
                </p>
              </div>

              <div className="border-t border-white/[0.08] bg-white/[0.02] p-6 md:border-l md:border-t-0 md:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${platform.colorA}, ${platform.colorB})`,
                    }}
                  >
                    {platform.name}
                  </span>
                  <span className="chip !py-1 text-[11px]">{rom.region}</span>
                  <span className="chip !py-1 text-[11px]">
                    <StarIcon size={11} filled className="text-amber-300" />
                    {rom.rating.toFixed(1)} / 10
                  </span>
                </div>

                <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.025em] text-white">
                  {rom.title}
                </h2>

                <p className="mt-4 leading-relaxed text-white/65">{rom.description}</p>

                <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  {[
                    ["Released", String(rom.year)],
                    ["Genre", rom.genre],
                    ["Players", rom.players > 1 ? `1–${rom.players}` : "1"],
                    ["File size", formatSize(rom.sizeMb)],
                    ["Playtime", formatPlaytime(rom.playtimeHours)],
                    ["Last played", timeAgo(rom.lastPlayedAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-white/35">
                        {label}
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-white/85">{value}</dd>
                    </div>
                  ))}
                </dl>

                <AchievementsPanel rom={rom} />

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(rom)}
                    className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:scale-[1.03] ${
                      rom.favorite
                        ? "border-rose-400/40 bg-rose-400/15 text-rose-200"
                        : "border-white/12 bg-white/[0.06] text-white/80 hover:bg-white/[0.12]"
                    }`}
                  >
                    <HeartIcon size={16} filled={rom.favorite} />
                    {rom.favorite ? "In favourites" : "Add to favourites"}
                  </button>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-white/55">
                    <GamepadIcon size={16} />
                    {rom.players > 1 ? "Multiplayer" : "Single player"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-white/55">
                    <ClockIcon size={16} />
                    {rom.filePath}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
