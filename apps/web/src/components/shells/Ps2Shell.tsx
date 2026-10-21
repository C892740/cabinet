"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RomCover } from "../RomCover";
import { useShellInput, type ShellDirection } from "./shell-input";
import type { Platform, Rom } from "@/lib/types";

/**
 * PS2-style system menu: rows of icons stacked vertically over the hazy blue
 * light-shaft backdrop. Up/down walks the rows, left/right walks the icons in
 * a row, Enter selects, Escape exits — the PS2 browser's exact grammar.
 */

interface Ps2Row {
  id: string;
  label: string;
  items: Array<{ id: string; label: string; rom?: Rom; platform?: Platform }>;
}

export function Ps2Shell({
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
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);

  const platformBySlug = useMemo(
    () => new Map(platforms.map((p) => [p.slug, p])),
    [platforms],
  );

  const rows = useMemo<Ps2Row[]>(() => {
    const games = roms.slice(0, 12).map((rom) => ({ id: rom.id, label: rom.title, rom }));
    const favourites = roms
      .filter((rom) => rom.favorite)
      .slice(0, 12)
      .map((rom) => ({ id: rom.id, label: rom.title, rom }));
    return [
      { id: "games", label: "PlayStation 2", items: games },
      { id: "favourites", label: "Favourites", items: favourites },
      {
        id: "browser",
        label: "Browser",
        items: platforms.map((platform) => ({
          id: platform.slug,
          label: platform.name,
          platform,
        })),
      },
      { id: "config", label: "Configuration", items: [{ id: "exit", label: "Exit to Cabinet" }] },
    ];
  }, [roms, platforms]);

  const currentRow = rows[Math.min(row, rows.length - 1)];
  const safeCol = Math.min(col, Math.max(0, currentRow.items.length - 1));
  const currentItem = currentRow.items[safeCol];

  useShellInput({
    onDirection: (direction: ShellDirection) => {
      if (direction === "down") {
        setRow((r) => Math.min(rows.length - 1, r + 1));
        setCol(0);
      }
      if (direction === "up") {
        setRow((r) => Math.max(0, r - 1));
        setCol(0);
      }
      if (direction === "right") {
        setCol((c) => Math.min(Math.max(0, (rows[row]?.items.length ?? 1) - 1), c + 1));
      }
      if (direction === "left") setCol((c) => Math.max(0, c - 1));
    },
    onConfirm: () => {
      if (!currentItem) return;
      if (currentItem.rom) onSelect(currentItem.rom);
      else if (currentItem.id === "exit") onExit();
    },
    onBack: onExit,
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0a1430] via-[#0b1a3e] to-[#060d22] text-white">
      {/* PS2 light shafts */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: 7 }).map((_, index) => (
          <motion.div
            key={index}
            className="h-full flex-1"
            animate={{ opacity: [0.16, 0.3, 0.16] }}
            transition={{ duration: 10 + index * 1.3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(120,170,255,0.22), rgba(80,120,220,0.05) 55%, transparent)",
            }}
          />
        ))}
      </div>

      {/* selected item name, PS2-style, centered at the top */}
      <div className="relative z-10 pt-14 text-center">
        <motion.p
          key={`${currentRow.id}-${currentItem?.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-light tracking-wide text-white/95 drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)]"
        >
          {currentItem?.label}
        </motion.p>
        <p className="mt-1.5 text-xs uppercase tracking-[0.32em] text-white/45">{currentRow.label}</p>
      </div>

      {/* rows of icons */}
      <div className="relative z-10 mx-auto flex min-h-[62vh] max-w-5xl flex-col justify-center gap-7 px-10 py-12">
        {rows.map((r, rowIndex) => {
          const activeRow = rowIndex === row;
          return (
            <div key={r.id} className="flex items-center gap-4">
              <span
                className={`w-36 shrink-0 text-right text-[11px] uppercase tracking-[0.22em] transition-colors ${
                  activeRow ? "text-white/85" : "text-white/25"
                }`}
              >
                {r.label}
              </span>
              <div
                className={`flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 transition-all duration-300 ${
                  activeRow
                    ? "border-white/20 bg-white/[0.07]"
                    : "border-transparent bg-white/[0.02] opacity-55"
                }`}
              >
                {r.items.length === 0 && (
                  <span className="px-2 py-1 text-xs text-white/40">Nothing here yet</span>
                )}
                {r.items.map((item, itemIndex) => {
                  const focused = activeRow && itemIndex === safeCol;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setRow(rowIndex);
                        setCol(itemIndex);
                      }}
                      className="shrink-0 focus:outline-none"
                      aria-label={item.label}
                    >
                      <motion.div
                        animate={{ scale: focused ? 1.12 : 1 }}
                        transition={{ type: "spring", stiffness: 320, damping: 26 }}
                        className={`relative overflow-hidden rounded-xl transition-all duration-200 ${
                          focused
                            ? "shadow-[0_0_0_3px_rgba(160,200,255,0.9),0_14px_36px_rgba(0,0,0,0.5)]"
                            : "brightness-[0.82]"
                        }`}
                      >
                        {item.rom ? (
                          <RomCover
                            rom={item.rom}
                            platform={platformBySlug.get(item.rom.platformSlug) ?? platforms[0]!}
                            className="h-[64px] w-[64px]"
                            rounded="rounded-xl"
                            showBadge={false}
                            showTitle={false}
                          />
                        ) : item.platform ? (
                          <div
                            className="grid h-[64px] w-[64px] place-items-center rounded-xl text-[11px] font-bold text-white"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${item.platform.colorA}, ${item.platform.colorB})`,
                            }}
                          >
                            {item.platform.shortName}
                          </div>
                        ) : (
                          <div className="grid h-[64px] w-[64px] place-items-center rounded-xl border border-white/15 bg-white/[0.08] text-xl">
                            ⚙
                          </div>
                        )}
                      </motion.div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* footer hints */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-5 pb-6 text-[11px] text-white/45">
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">↑↓</kbd> row</span>
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">←→</kbd> item</span>
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">Enter</kbd> select</span>
        <span><kbd className="rounded border border-white/20 px-1.5 py-0.5">Esc</kbd> exit</span>
      </div>
    </div>
  );
}
