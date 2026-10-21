"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RomCover } from "../RomCover";
import { useShellInput, type ShellDirection } from "./shell-input";
import type { Platform, Rom } from "@/lib/types";

/**
 * PS3-style Cross Media Bar: categories across the top axis, items down the
 * vertical axis, a quiet wave-like backdrop and a clock in the corner.
 * Left/right switches category column, up/down walks the column.
 */

interface XmbCategory {
  id: string;
  label: string;
  items: Array<{ id: string; label: string; rom?: Rom; platform?: Platform }>;
}

export function XmbShell({
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
  const [col, setCol] = useState(0);
  const [row, setRow] = useState(0);
  const [clock, setClock] = useState("");

  const platformBySlug = useMemo(
    () => new Map(platforms.map((p) => [p.slug, p])),
    [platforms],
  );

  const categories = useMemo<XmbCategory[]>(
    () => [
      {
        id: "games",
        label: "Games",
        items: roms.map((rom) => ({ id: rom.id, label: rom.title, rom })),
      },
      {
        id: "favourites",
        label: "Favourites",
        items: roms
          .filter((rom) => rom.favorite)
          .map((rom) => ({ id: rom.id, label: rom.title, rom })),
      },
      {
        id: "platforms",
        label: "Platforms",
        items: platforms.map((platform) => ({
          id: platform.slug,
          label: platform.name,
          platform,
        })),
      },
      {
        id: "settings",
        label: "Settings",
        items: [
          { id: "exit", label: "Exit to Cabinet" },
        ],
      },
    ],
    [roms, platforms],
  );

  const currentCategory = categories[Math.min(col, categories.length - 1)];
  const currentItem = currentCategory?.items[Math.min(row, Math.max(0, currentCategory.items.length - 1))];

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleString([], {
          hour: "numeric",
          minute: "2-digit",
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useShellInput({
    onDirection: (direction: ShellDirection) => {
      if (direction === "right") {
        setCol((c) => Math.min(categories.length - 1, c + 1));
        setRow(0);
      }
      if (direction === "left") {
        setCol((c) => Math.max(0, c - 1));
        setRow(0);
      }
      if (direction === "down") {
        setRow((r) => Math.min(Math.max(0, (categories[col]?.items.length ?? 1) - 1), r + 1));
      }
      if (direction === "up") setRow((r) => Math.max(0, r - 1));
    },
    onConfirm: () => {
      if (!currentItem) return;
      if (currentItem.rom) onSelect(currentItem.rom);
      else if (currentItem.id === "exit") onExit();
    },
    onBack: onExit,
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e14] text-white">
      {/* wave backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(1200px 500px at 20% 110%, rgba(90,140,180,0.28), transparent 60%), radial-gradient(1000px 420px at 85% -10%, rgba(70,110,150,0.22), transparent 60%)",
        }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[45%]"
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        style={{
          backgroundImage:
            "radial-gradient(800px 240px at 30% 100%, rgba(120,170,210,0.25), transparent 70%), radial-gradient(700px 200px at 75% 100%, rgba(80,130,170,0.2), transparent 70%)",
        }}
      />

      {/* clock */}
      <div className="absolute right-10 top-8 text-right">
        <div className="text-lg font-light tabular-nums text-white/90">{clock}</div>
      </div>

      {/* the bar */}
      <div className="relative z-10 flex min-h-screen items-center px-14">
        <div className="flex items-start gap-16">
          {categories.map((category, c) => {
            const active = c === col;
            return (
              <div
                key={category.id}
                className={`flex flex-col items-center gap-3 transition-all duration-300 ${
                  active ? "opacity-100" : "opacity-35"
                }`}
              >
                <span className={`text-xs font-medium tracking-[0.18em] uppercase ${active ? "text-white" : "text-white/70"}`}>
                  {category.label}
                </span>

                <div className="flex flex-col items-center gap-3">
                  {category.items.length === 0 && (
                    <span className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/40">
                      Nothing here
                    </span>
                  )}
                  {category.items.slice(0, 8).map((item, r) => {
                    const focused = active && r === row;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCol(c);
                          setRow(r);
                        }}
                        className="focus:outline-none"
                        aria-label={item.label}
                      >
                        <motion.div
                          animate={{ scale: focused ? 1.14 : 1 }}
                          transition={{ type: "spring", stiffness: 320, damping: 26 }}
                          className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
                            focused
                              ? "shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_18px_40px_rgba(0,0,0,0.5)]"
                              : "brightness-[0.8]"
                          }`}
                        >
                          {item.rom ? (
                            <RomCover
                              rom={item.rom}
                              platform={platformBySlug.get(item.rom.platformSlug) ?? platforms[0]!}
                              className="h-[72px] w-[72px]"
                              rounded="rounded-2xl"
                              showBadge={false}
                              showTitle={false}
                            />
                          ) : item.platform ? (
                            <div
                              className="grid h-[72px] w-[72px] place-items-center rounded-2xl text-xs font-bold text-white"
                              style={{
                                backgroundImage: `linear-gradient(135deg, ${item.platform.colorA}, ${item.platform.colorB})`,
                              }}
                            >
                              {item.platform.shortName}
                            </div>
                          ) : (
                            <div className="grid h-[72px] w-[72px] place-items-center rounded-2xl border border-white/15 bg-white/[0.08] text-2xl">
                              ⚙
                            </div>
                          )}
                        </motion.div>
                        {focused && (
                          <motion.span
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 block max-w-[120px] truncate text-center text-[11px] text-white/85"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* footer hints */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-5 pb-6 text-[11px] text-white/45">
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">←→</kbd> category</span>
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">↑↓</kbd> item</span>
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">Enter</kbd> select</span>
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">Esc</kbd> exit</span>
      </div>
    </div>
  );
}
