"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RomCover } from "../RomCover";
import { AchievementChip } from "../achievements/Achievements";
import { useShellInput, type ShellDirection } from "./shell-input";
import type { Platform, Rom } from "@/lib/types";

/**
 * PS5-style home screen: a games rail over full-bleed hero art of the focused
 * game, Games/Media tabs top-left, clock top-right. Arrow keys or a gamepad
 * move along the rail, Enter opens the game, Escape returns to the app.
 */
export function PS5Shell({
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
  const [tab, setTab] = useState<"games" | "media">("games");
  const [clock, setClock] = useState("");
  const railRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-index="${focus}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
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
    <div className="relative min-h-screen overflow-hidden bg-[#07070c] text-white">
      {/* hero art */}
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <RomCover rom={current} platform={platformBySlug.get(current.platformSlug) ?? platforms[0]!} className="h-full w-full" rounded="rounded-none" showBadge={false} showTitle={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07070c] via-[#07070c]/55 to-[#07070c]/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07070c]/85 via-transparent to-transparent" />
        </motion.div>
      )}

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-8">
        <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/25 p-1 backdrop-blur-md">
          {(["games", "media"] as const).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`rounded-md px-5 py-1.5 text-sm font-semibold capitalize transition-colors ${
                tab === name ? "bg-white/[0.14] text-white" : "text-white/55 hover:text-white/85"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6 text-white/85">
          <span className="text-sm font-medium tabular-nums">{clock}</span>
        </div>
      </div>

      {/* hero copy */}
      {current && (
        <div className="relative z-10 max-w-2xl px-10 pt-24">
          <motion.div key={current.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/55">
              {platformBySlug.get(current.platformSlug)?.name}
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.04] tracking-[-0.03em] drop-shadow-[0_4px_30px_rgba(0,0,0,0.55)]">
              {current.title}
            </h1>
            <p className="mt-4 line-clamp-2 max-w-xl text-white/70">{current.description}</p>
            <div className="mt-7 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelect(current)}
                className="rounded-full bg-white px-9 py-3 text-sm font-bold text-[#0a0a12] transition-transform hover:scale-[1.04]"
              >
                Play
              </button>
              <button
                type="button"
                onClick={() => onSelect(current)}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-lg backdrop-blur-md transition-transform hover:scale-[1.06]"
                aria-label="More"
              >
                …
              </button>
              {current.achievements && <AchievementChip summary={current.achievements} />}
            </div>
          </motion.div>
        </div>
      )}

      {/* games rail */}
      <div className="absolute inset-x-0 bottom-0 z-10 pb-14">
        <div ref={railRef} className="mask-fade-x flex items-end gap-4 overflow-x-auto px-10 pb-2 pt-24">
          {roms.map((rom, index) => (
            <button
              key={rom.id}
              type="button"
              data-index={index}
              onClick={() => (index === focus ? onSelect(rom) : setFocus(index))}
              className="group relative shrink-0 focus:outline-none"
              aria-label={rom.title}
            >
              <motion.div
                animate={{
                  scale: index === focus ? 1.08 : 1,
                  y: index === focus ? -10 : 0,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
                  index === focus
                    ? "shadow-[0_0_0_3px_rgba(255,255,255,0.9),0_18px_50px_rgba(0,0,0,0.55)]"
                    : "shadow-[0_10px_30px_rgba(0,0,0,0.45)] brightness-[0.72]"
                }`}
              >
                <RomCover
                  rom={rom}
                  platform={platformBySlug.get(rom.platformSlug) ?? platforms[0]!}
                  className="h-[128px] w-[96px]"
                  rounded="rounded-2xl"
                  showBadge={false}
                />
              </motion.div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
