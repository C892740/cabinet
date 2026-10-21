"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RomModal } from "../app/RomModal";
import { CloseIcon } from "../Icons";
import { PS5Shell } from "./PS5Shell";
import { Ps2Shell } from "./Ps2Shell";
import { NintendoShell } from "./NintendoShell";
import { DualScreenShell } from "./DualScreenShell";
import { XmbShell } from "./XmbShell";
import {
  DEFAULT_SHELL,
  SHELLS,
  readShellChoice,
  writeShellChoice,
  type ShellId,
} from "./shell-registry";
import type { Platform, Rom } from "@/lib/types";

/**
 * Hosts the optional console-style layouts (the Zorin-style familiarity
 * switch). The choice persists per browser; all shells share the same data,
 * rom dialog and favourite toggle.
 */
export function ShellStage({
  initialRoms,
  platforms,
}: {
  initialRoms: Rom[];
  platforms: Platform[];
}) {
  const [shell, setShell] = useState<ShellId>(DEFAULT_SHELL);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [roms, setRoms] = useState<Rom[]>(initialRoms);
  const [selected, setSelected] = useState<Rom | null>(null);

  useEffect(() => {
    setShell(readShellChoice());
  }, []);

  function choose(id: ShellId) {
    setShell(id);
    writeShellChoice(id);
    setPickerOpen(false);
  }

  function toggleFavorite(target: Rom) {
    setRoms((current) =>
      current.map((rom) => (rom.id === target.id ? { ...rom, favorite: !rom.favorite } : rom)),
    );
    setSelected((current) =>
      current && current.id === target.id ? { ...current, favorite: !current.favorite } : current,
    );
  }

  const platformBySlug = new Map(platforms.map((p) => [p.slug, p]));
  const shared = {
    roms,
    platforms,
    onSelect: setSelected,
    onExit: () => setPickerOpen(true),
  };

  return (
    <div>
      {shell === "ps5" && <PS5Shell {...shared} />}
      {shell === "ps2" && <Ps2Shell {...shared} />}
      {shell === "nintendo" && <NintendoShell {...shared} />}
      {shell === "dual" && <DualScreenShell {...shared} />}
      {shell === "xmb" && <XmbShell {...shared} />}

      {/* floating shell controls */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <a
          href="/library"
          className="glass rounded-full px-4 py-2.5 text-xs font-medium text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.12]"
        >
          ← Library
        </a>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="accent-gradient rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-glow transition-transform hover:scale-[1.04]"
        >
          Change layout
        </button>
      </div>

      {/* layout picker */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPickerOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="glass-strong relative z-10 w-full max-w-3xl rounded-3xl p-8"
            >
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="focus-ring absolute right-4 top-4 rounded-full border border-white/15 bg-black/30 p-2 text-white/80"
                aria-label="Close picker"
              >
                <CloseIcon size={16} />
              </button>

              <h2 className="text-2xl font-semibold tracking-tight text-white">Choose your layout</h2>
              <p className="mt-1.5 text-sm text-white/55">
                Same library, different muscle memory — like Zorin's Windows- and macOS-style desktops.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {SHELLS.map((descriptor) => {
                  const active = descriptor.id === shell;
                  return (
                    <button
                      key={descriptor.id}
                      type="button"
                      onClick={() => choose(descriptor.id)}
                      className={`focus-ring group rounded-2xl border p-5 text-left transition-all duration-300 ${
                        active
                          ? "border-white/35 bg-white/[0.12]"
                          : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="inline-flex items-center gap-2 text-sm font-semibold text-white"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: descriptor.accent }}
                          />
                          {descriptor.name}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                          {descriptor.inspiration}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/55">{descriptor.blurb}</p>
                      {active && (
                        <span className="mt-3 inline-block rounded-full accent-gradient px-3 py-1 text-[10px] font-semibold text-white">
                          Currently active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RomModal
        rom={selected}
        platform={selected ? (platformBySlug.get(selected.platformSlug) ?? null) : null}
        onClose={() => setSelected(null)}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
