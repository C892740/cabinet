"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloseIcon, SparklesIcon } from "../Icons";
import { prepareRomFile, saveRomToVault, type PreparedRom } from "@/lib/rom-vault";
import { uploadRomBlob } from "@/lib/rom-sync";
import type { Platform, Rom, RomRegion } from "@/lib/types";

/**
 * Add a game to the library. The server resolves cover art and
 * RetroAchievements matching automatically on insert — no extra clicks.
 *
 * A ROM file can be attached at the same time (zipped archives included):
 * bytes land in this device's ROM vault and sync to the account in the
 * background, so the game is playable from the library on every device —
 * the TV included — without re-attaching anything.
 */

/** Unambiguous ROM extensions → Cabinet platform slugs. */
const EXT_TO_PLATFORM: Record<string, string> = {
  gba: "gba",
  agb: "gba",
  nds: "nds",
  nes: "nes",
  fds: "nes",
  unf: "nes",
  unif: "nes",
  sfc: "snes",
  smc: "snes",
  fig: "snes",
  swc: "snes",
  bs: "snes",
  gb: "gb",
  dmg: "gb",
  gbc: "gb",
  n64: "n64",
  z64: "n64",
  v64: "n64",
  u64: "n64",
  gen: "genesis",
  md: "genesis",
  smd: "genesis",
  gg: "gamegear",
  sms: "sms",
  a26: "atari2600",
};

function platformFromFileName(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_PLATFORM[ext] ?? null;
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[._]+/g, " ")
    .replace(
      /\s*\((USA|Europe|Japan|World|En[^)]*|Fr[^)]*|De[^)]*|Es[^)]*|It[^)]*|Rev[^)]*|v[^)]*|Beta|Proto[^)]*|Disc[^)]*|Track[^)]*)\)/gi,
      "",
    )
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function regionFromFileName(fileName: string): RomRegion | null {
  const match = fileName.match(/\((USA|Europe|Japan|World)\)/i);
  if (!match) return null;
  const found = match[1]!.toLowerCase();
  if (found === "usa") return "USA";
  if (found === "europe") return "Europe";
  if (found === "japan") return "Japan";
  return "World";
}

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
  const [busyLabel, setBusyLabel] = useState("Adding…");
  const [error, setError] = useState<string | null>(null);

  const [prepared, setPrepared] = useState<PreparedRom | null>(null);
  const [region, setRegion] = useState<RomRegion | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setGenre("");
    setPrepared(null);
    setRegion(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    setFileError(null);
    setPrepared(null);
    try {
      const rom = await prepareRomFile(picked);
      setPrepared(rom);
      setRegion(regionFromFileName(rom.fileName));
      if (!title.trim()) setTitle(titleFromFileName(rom.fileName));
      const detected = platformFromFileName(rom.fileName);
      if (detected && platforms.some((p) => p.slug === detected)) setPlatformSlug(detected);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "could not read that file");
    }
  }

  async function submit() {
    const finalTitle = title.trim() || (prepared ? titleFromFileName(prepared.fileName) : "");
    const finalGenre = genre.trim() || (prepared ? "Uncategorized" : "");
    if (!finalTitle || !finalGenre) {
      setError("Title and genre are required — or attach a ROM file to fill them in.");
      return;
    }
    setBusy(true);
    setBusyLabel("Adding…");
    setError(null);
    try {
      const res = await fetch("/api/roms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          platformSlug,
          year: Number(year) || 1994,
          genre: finalGenre,
          region: region ?? undefined,
          sizeMb: prepared ? Number((prepared.bytes.length / 1048576).toFixed(2)) : undefined,
          filePath: prepared?.fileName,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not add the game.");
        return;
      }
      const rom = json.rom as Rom;

      if (prepared) {
        // Local vault first: instant replay on this device…
        setBusyLabel("Saving ROM…");
        try {
          await saveRomToVault(rom.id, prepared.fileName, prepared.bytes);
        } catch {
          // Quota exceeded — the account copy below is the fallback.
        }
        // …then a background sync so the TV and every device can stream it.
        void uploadRomBlob(rom.id, prepared.fileName, prepared.bytes).catch(() => undefined);
      }

      onAdded(rom);
      reset();
      onClose();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
      setBusyLabel("Adding…");
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
            className="glass-strong relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl p-7"
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
              <div>
                <span className="text-[11px] uppercase tracking-[0.12em] text-white/40">ROM file</span>
                <div className="glass mt-1.5 flex items-center gap-3 rounded-xl px-3.5 py-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={onFilePick}
                    accept=".zip,.gba,.agb,.nds,.nes,.fds,.sfc,.smc,.gb,.gbc,.n64,.z64,.v64,.gen,.md,.gg,.sms,.bin,.cue,.iso,.chd,.a26"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-glass !px-3 !py-1.5 text-xs"
                  >
                    Choose file
                  </button>
                  <span className={`truncate text-xs ${prepared ? "text-emerald-200" : "text-white/55"}`}>
                    {prepared
                      ? `${prepared.fileName} — ready${prepared.fromZip ? " (unpacked from zip)" : ""}`
                      : "Optional — .zip archives work too"}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] text-white/40">
                  Attach once and it plays from your library on every device — the TV included.
                </p>
                {fileError && <p className="mt-1.5 text-xs text-rose-300">{fileError}</p>}
              </div>

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
                {busy ? busyLabel : "Add game"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
