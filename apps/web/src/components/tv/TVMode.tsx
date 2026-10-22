"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CoverArt } from "../CoverArt";
import { GamepadIcon, Logo, PlayIcon, SearchIcon, TvIcon } from "./tv-exports";
import { GamepadNavMap, PadGlyph } from "./GamepadNavMap";
import { PhoneLinkBadge, PhonePairPanel } from "./PhonePairPanel";
import type { Platform, Rom } from "@/lib/types";

/**
 * TV Mode — the living-room interface.
 *
 * Navigation uses the standard Gamepad API: the d-pad/left stick moves focus
 * between tiles, A confirms and B goes back. Works with up to four controllers
 * (Samsung TV apps support gamepads since 2016).
 */

const BUTTON = { A: 0, B: 1, DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15 } as const;

function useGamepadCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => {
      const pads = navigator.getGamepads?.() ?? [];
      setCount(pads.filter((pad) => pad?.connected).length);
    };
    update();
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    const timer = window.setInterval(update, 2000);
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
      window.clearInterval(timer);
    };
  }, []);
  return count;
}

function useGamepadNavigation(onBack: () => void) {
  const pressed = useRef<Set<number>>(new Set());

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      for (const pad of pads) {
        if (!pad) continue;
        const buttons = pad.buttons.map((button) => button.pressed);

        const fire = (index: number, action: () => void) => {
          const isDown = buttons[index] ?? false;
          if (isDown && !pressed.current.has(index)) {
            pressed.current.add(index);
            action();
          } else if (!isDown) {
            pressed.current.delete(index);
          }
        };

        const focusables = Array.from(
          document.querySelectorAll<HTMLElement>("[data-tv-focusable]"),
        );
        const currentIndex = focusables.findIndex((el) => el === document.activeElement);
        const move = (delta: number) => {
          const next = focusables[Math.min(Math.max(currentIndex + delta, 0), focusables.length - 1)];
          next?.focus();
          next?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        };

        fire(BUTTON.DPAD_LEFT, () => move(-1));
        fire(BUTTON.DPAD_RIGHT, () => move(1));
        fire(BUTTON.DPAD_UP, () => move(-3));
        fire(BUTTON.DPAD_DOWN, () => move(3));
        fire(BUTTON.A, () => (document.activeElement as HTMLElement | null)?.click());
        fire(BUTTON.B, onBack);

        // left stick with deadzone (indices 100-103 are synthetic "buttons")
        const x = pad.axes[0] ?? 0;
        const y = pad.axes[1] ?? 0;
        const stick = [
          { id: 100, active: x > 0.6, action: () => move(1) },
          { id: 101, active: x < -0.6, action: () => move(-1) },
          { id: 102, active: y > 0.6, action: () => move(3) },
          { id: 103, active: y < -0.6, action: () => move(-3) },
        ];
        for (const direction of stick) {
          if (direction.active) {
            if (!pressed.current.has(direction.id)) {
              pressed.current.add(direction.id);
              direction.action();
            }
          } else {
            pressed.current.delete(direction.id);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onBack]);
}

export function TVMode({
  roms,
  platforms,
}: {
  roms: Rom[];
  platforms: Platform[];
}) {
  const padCount = useGamepadCount();
  const [selected, setSelected] = useState<Rom | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const onBack = useMemo(() => () => {
    setPairOpen(false);
    setSelected(null);
  }, []);
  useGamepadNavigation(onBack);

  // Put the panel's Play button under the gamepad cursor when a game opens:
  // tile → A → A plays, B backs out.
  useEffect(() => {
    if (!selected) return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>("[data-tv-autofocus]")?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [selected]);

  const platformBySlug = useMemo(
    () => new Map(platforms.map((p) => [p.slug, p])),
    [platforms],
  );
  const rows = useMemo(
    () =>
      platforms
        .map((platform) => ({
          platform,
          games: roms.filter((rom) => rom.platformSlug === platform.slug).slice(0, 10),
        }))
        .filter((row) => row.games.length > 0),
    [platforms, roms],
  );

  return (
    <div className="min-h-screen pb-20">
      {/* top bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-8 pb-8 pt-8 sm:px-12">
        <Link href="/library" className="rounded-2xl">
          <Logo size={36} />
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/75">
            <SearchIcon size={16} />
            Press / to search
          </span>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              padCount > 0
                ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "glass text-white/60"
            }`}
          >
            <GamepadIcon size={16} />
            {padCount > 0
              ? `${padCount} controller${padCount > 1 ? "s" : ""} connected`
              : "Press a button on your controller"}
          </span>
          <PhoneLinkBadge onOpen={() => setPairOpen(true)} />
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/75">
            <TvIcon size={16} />
            TV Mode
          </span>
        </div>
      </header>

      {/* rows */}
      <div className="space-y-12 px-8 sm:px-12">
        {rows.map((row, rowIndex) => (
          <section key={row.platform.slug}>
            <div className="mb-5 flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: row.platform.colorA }}
              />
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                {row.platform.name}
              </h2>
              <span className="text-sm text-white/40">
                {row.games.length} games
              </span>
            </div>

            <div className="-mx-2 flex gap-6 overflow-x-auto px-2 pb-4">
              {row.games.map((rom, index) => (
                <motion.button
                  key={rom.id}
                  data-tv-focusable
                  type="button"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: Math.min(rowIndex * 0.05 + index * 0.03, 0.5) }}
                  onClick={() => setSelected(rom)}
                  className="group w-[220px] shrink-0 rounded-3xl outline-none transition-transform duration-300 focus-visible:scale-[1.05] sm:w-[240px]"
                >
                  <CoverArt
                    rom={rom}
                    platform={row.platform}
                    className="aspect-[3/4] border-2 border-transparent shadow-card transition-all duration-300 group-focus-visible:border-white group-hover:shadow-glow"
                    rounded="rounded-3xl"
                  />
                  <div className="mt-3 px-1 text-left">
                    <p className="truncate text-base font-medium text-white/90">{rom.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/45">
                      <PlayIcon size={12} />
                      Ready to play · {rom.players > 1 ? "2 players" : "1 player"}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* selected game panel */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-x-6 bottom-6 z-50 sm:inset-x-12"
        >
          <div className="glass-strong flex flex-wrap items-center gap-5 rounded-4xl p-6">
            <CoverArt
              rom={selected}
              platform={platformBySlug.get(selected.platformSlug) ?? platforms[0]!}
              className="h-24 w-[72px] shrink-0"
              rounded="rounded-2xl"
              showBadge={false}
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-semibold text-white">{selected.title}</h3>
              <p className="mt-1 truncate text-sm text-white/55">
                {selected.genre} · {selected.year} · ★ {selected.rating.toFixed(1)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/play?rom=${selected.id}&source=tv`}
                data-tv-focusable
                data-tv-autofocus
                className="accent-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-glow outline-none transition-transform duration-200 focus-visible:scale-[1.05]"
              >
                <PlayIcon size={16} />
                Play
                <PadGlyph kind="cross" size={15} />
              </Link>
              <button
                type="button"
                onClick={() => setSelected(null)}
                data-tv-focusable
                className="glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white/80 outline-none transition-transform duration-200 focus-visible:scale-[1.05]"
              >
                Back
                <PadGlyph kind="circle" size={15} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {pairOpen && <PhonePairPanel onClose={() => setPairOpen(false)} />}

      <footer className="mt-16 px-8 pb-6 sm:px-12">
        <GamepadNavMap />
      </footer>
    </div>
  );
}
