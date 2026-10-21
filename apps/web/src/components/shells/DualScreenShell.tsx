"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RomCover } from "../RomCover";
import { AchievementChip } from "../achievements/Achievements";
import { useShellInput, type ShellDirection } from "./shell-input";
import type { Platform, Rom } from "@/lib/types";

/**
 * Dual-screen shell (DS / 3DS home menu): the top screen is a hero banner for
 * the focused game, the bottom screen is a touchable icon grid. Left/right
 * moves the grid cursor, up/down jumps rows, Enter opens, Escape exits.
 */
export function DualScreenShell({
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
  const columns = 6;
  const [focus, setFocus] = useState(0);
  const [clock, setClock] = useState("");

  const platformBySlug = useMemo(
    () => new Map(platforms.map((p) => [p.slug, p])),
    [platforms],
  );
  const current = roms[Math.min(focus, roms.length - 1)];

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useShellInput({
    onDirection: (direction: ShellDirection) => {
      setFocus((f) => {
        if (direction === "right") return Math.min(roms.length - 1, f + 1);
        if (direction === "left") return Math.max(0, f - 1);
        if (direction === "down") return Math.min(roms.length - 1, f + columns);
        if (direction === "up") return Math.max(0, f - columns);
        return f;
      });
    },
    onConfirm: () => current && onSelect(current),
    onBack: onExit,
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#101018] to-[#08080d] px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        {/* console hinge */}
        <div className="mx-auto mb-4 h-2 w-40 rounded-full bg-gradient-to-r from-white/5 via-white/25 to-white/5" />

        {/* TOP SCREEN — hero banner */}
        <div className="relative overflow-hidden rounded-[22px] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div className="relative aspect-[21/9] w-full">
            {current && (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <RomCover
                  rom={current}
                  platform={platformBySlug.get(current.platformSlug) ?? platforms[0]!}
                  className="h-full w-full"
                  rounded="rounded-none"
                  showBadge={false}
                  showTitle={false}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
                <div className="absolute inset-y-0 left-0 flex max-w-md flex-col justify-center gap-2 p-8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/60">
                    {platformBySlug.get(current.platformSlug)?.shortName} · {current.year}
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight drop-shadow-lg">
                    {current.title}
                  </h1>
                  <p className="line-clamp-2 text-sm text-white/70">{current.description}</p>
                  {current.achievements && (
                    <div className="mt-1">
                      <AchievementChip summary={current.achievements} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
          {/* top-screen status strip */}
          <div className="absolute right-5 top-4 flex items-center gap-3 text-[11px] text-white/70">
            <span className="tabular-nums">{clock}</span>
          </div>
        </div>

        {/* hinge */}
        <div className="mx-auto my-3 h-2 w-40 rounded-full bg-gradient-to-r from-white/5 via-white/25 to-white/5" />

        {/* BOTTOM SCREEN — icon grid */}
        <div className="relative rounded-[22px] border border-white/10 bg-black/35 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-3 flex items-center justify-between text-[11px] text-white/50">
            <span className="uppercase tracking-[0.22em]">Touch menu</span>
            <span>{focus + 1} / {roms.length}</span>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {roms.map((rom, index) => (
              <button
                key={rom.id}
                type="button"
                onClick={() => (index === focus ? onSelect(rom) : setFocus(index))}
                className="group focus:outline-none"
                aria-label={rom.title}
              >
                <motion.div
                  animate={{ scale: index === focus ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 340, damping: 26 }}
                  className={`relative overflow-hidden rounded-xl transition-all duration-200 ${
                    index === focus
                      ? "shadow-[0_0_0_3px_rgba(255,255,255,0.9)]"
                      : "opacity-75 group-hover:opacity-100"
                  }`}
                >
                  <RomCover
                    rom={rom}
                    platform={platformBySlug.get(rom.platformSlug) ?? platforms[0]!}
                    className="aspect-square w-full"
                    rounded="rounded-xl"
                    showBadge={false}
                  />
                </motion.div>
              </button>
            ))}
          </div>

          {/* focused name */}
          <div className="mt-4 h-6 text-center text-sm font-medium text-white/85">
            {current?.title}
          </div>
        </div>

        {/* bottom hint */}
        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-white/45">
          <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">Arrows</kbd> move</span>
          <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">Enter</kbd> open</span>
          <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">Esc</kbd> exit</span>
        </div>
      </div>
    </div>
  );
}
