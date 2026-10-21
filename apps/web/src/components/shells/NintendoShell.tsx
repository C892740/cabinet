"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LogoMark } from "../Logo";
import { RomCover } from "../RomCover";
import { AchievementChip } from "../achievements/Achievements";
import { useShellInput, type ShellDirection } from "./shell-input";
import type { Platform, Rom } from "@/lib/types";

/**
 * Nintendo-style shell (Switch / 3DS home menu flavour): a friendly top bar,
 * big bright tiles in a row, the focused game's name above them and the
 * platform's colour washing the background.
 */
export function NintendoShell({
  roms,
  platforms,
  onSelect,
  onExit,
}: {
  roms: Rom[];
  platforms: Platform[];
  onSelect: (rom: Rom) => void;
  onExit: () => void;
}) {
  const [focus, setFocus] = useState(0);
  const [clock, setClock] = useState("");

  const platformBySlug = useMemo(
    () => new Map(platforms.map((p) => [p.slug, p])),
    [platforms],
  );
  const current = roms[Math.min(focus, roms.length - 1)];
  const accent = platformBySlug.get(current?.platformSlug ?? "")?.colorA ?? "#e60012";

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rowRef.current
      ?.querySelector<HTMLElement>(`[data-index="${focus}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focus]);

  useShellInput({
    onDirection: (direction: ShellDirection) => {
      if (direction === "right") setFocus((f) => Math.min(roms.length - 1, f + 1));
      if (direction === "left") setFocus((f) => Math.max(0, f - 1));
    },
    onConfirm: () => current && onSelect(current),
    onBack: onExit,
  });

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d0d14] text-white">
      {/* platform colour wash */}
      <motion.div
        key={accent}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(1100px 560px at 50% -10%, ${accent}38, transparent 65%), linear-gradient(180deg, ${accent}14, transparent 45%)`,
        }}
      />

      {/* top status bar */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-6">
        <div className="flex items-center gap-3">
          <LogoMark size={34} />
          <span className="text-sm font-semibold text-white/85">Cabinet</span>
        </div>
        <div className="flex items-center gap-5 text-white/80">
          <span className="text-sm font-medium tabular-nums">{clock}</span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Player 1
          </span>
          {/* battery */}
          <svg width="26" height="14" viewBox="0 0 26 14" aria-label="Battery">
            <rect x="0.5" y="0.5" width="22" height="13" rx="3" fill="none" stroke="rgba(255,255,255,0.5)" />
            <rect x="2.5" y="2.5" width="14" height="9" rx="1.5" fill="#5ee681" />
            <rect x="24" y="4" width="2" height="6" rx="1" fill="rgba(255,255,255,0.5)" />
          </svg>
        </div>
      </div>

      {/* focused title */}
      <div className="relative z-10 mt-24 text-center">
        <motion.h1
          key={current?.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-semibold tracking-tight drop-shadow-[0_3px_18px_rgba(0,0,0,0.5)]"
        >
          {current?.title}
        </motion.h1>
        <p className="mt-2 flex items-center justify-center gap-3 text-sm text-white/60">
          {platformBySlug.get(current?.platformSlug ?? "")?.name}
          {current?.achievements && <AchievementChip summary={current.achievements} />}
        </p>
      </div>

      {/* tile row — never justify-center inside a scroll container: the
          overflow spills both ways and the first tiles become unreachable. */}
      <div ref={rowRef} className="relative z-10 mt-14 flex flex-1 items-center gap-6 overflow-x-auto px-8 pb-24 pt-6">
        {roms.map((rom, index) => (
          <button
            key={rom.id}
            type="button"
            onClick={() => (index === focus ? onSelect(rom) : setFocus(index))}
            data-index={index}
            className="group shrink-0 focus:outline-none"
            aria-label={rom.title}
          >
            <motion.div
              animate={{ scale: index === focus ? 1.06 : 0.94 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className={`relative overflow-hidden rounded-[18px] transition-all duration-300 ${
                index === focus
                  ? "shadow-[0_0_0_4px_rgba(255,255,255,0.92),0_22px_60px_rgba(0,0,0,0.5)]"
                  : "shadow-[0_12px_32px_rgba(0,0,0,0.4)] brightness-[0.78]"
              }`}
            >
              <RomCover
                rom={rom}
                platform={platformBySlug.get(rom.platformSlug) ?? platforms[0]!}
                className="h-[172px] w-[172px]"
                rounded="rounded-[18px]"
                showBadge={false}
              />
            </motion.div>
          </button>
        ))}
      </div>

      {/* bottom hint bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-8 py-5 text-xs text-white/55">
        <span className="rounded-full border border-white/15 bg-white/[0.07] px-4 py-1.5">All Games</span>
        <span className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-[10px]">←→</kbd> browse
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-[10px]">Enter</kbd> open
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-[10px]">Esc</kbd> exit
          </span>
        </span>
      </div>
    </div>
  );
}
