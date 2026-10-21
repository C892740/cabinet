"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloseIcon, SparklesIcon } from "../Icons";
import type { Platform, Rom } from "@/lib/types";

/**
 * Add a game to the library. The server resolves cover art and
 * RetroAchievements matching automatically on insert — no extra clicks.
 */
export function AddGameModal({
  open,
  platforms,
  onClose,
  onAdded,
}: {
  open: boolean;
  platforms: Platform[];
  onClose: () => void;
  onAdded: (rom: Rom) => void;
}) {
  const [title, setTitle] = useState("");
  const [platformSlug, setPlatformSlug] = useState(platforms[0]?.slug ?? "nes");
  const [year, setYear] = useState("1994");
  const [genre, setGenre] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !genre.trim()) {
      setError("Title and genre are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/roms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, platformSlug, year: Number(year), genre }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not add the game.");
        return;
      }
      onAdded(json.rom);
      setTitle("");
      setGenre("");
      onClose();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="glass-strong relative z-10 w-full max-w-md rounded-3xl p-7"
          >
            <button
              type="button"
              onClick={onClose}
              className="focus-ring absolute right-4 top-4 rounded-full border border-white/15 bg-black/30 p-2 text-white/80"
              aria-label="Close dialog"
            >
              <CloseIcon size={16} />
            </button>

            <h2 className="text-xl font-semibold text-white">Add a game</h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/50">
              <SparklesIcon size={13} />
              Cover art and achievements resolve automatically.
            </p>

            <div className="mt-5 space-y-3.5">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.12em] text-white/40">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Super Metroid"
                  className="glass mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-white/40">Platform</span>
                  <select
                    value={platformSlug}
                    onChange={(e) => setPlatformSlug(e.target.value)}
                    className="glass mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {platforms.map((p) => (
                      <option key={p.slug} value={p.slug} className="bg-ink-800">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-white/40">Year</span>
                  <input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    inputMode="numeric"
                    className="glass mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.12em] text-white/40">Genre</span>
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Action-Adventure"
                  className="glass mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

            <div className="mt-6 flex justify-end gap-2.5">
              <button type="button" onClick={onClose} className="btn-glass !px-5 !py-2.5 text-xs">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={busy} className="btn-primary !px-5 !py-2.5 text-xs disabled:opacity-60">
                {busy ? "Adding…" : "Add game"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
