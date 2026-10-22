"use client";

/**
 * ROM library scanner.
 *
 * Pick files (or a folder) → hashes computed in the browser (bytes stay local)
 * → the server matches the manifest against ScreenScraper / IGDB → matches
 * import straight into the library with their cover art.
 */

import { useState } from "react";
import { hashFile, type FileHashes } from "@/lib/hash";
import { CORE_BY_PLATFORM, DESKTOP_ONLY_PLATFORMS } from "@/lib/emulator-cores";
import type { MetadataMatch, ProvidersStatus } from "@/lib/types";

const EXT_TO_PLATFORM: Record<string, string> = {};
for (const [slug, info] of Object.entries(CORE_BY_PLATFORM)) {
  for (const ext of info.extensions) EXT_TO_PLATFORM[ext] ??= slug;
}
EXT_TO_PLATFORM.nes = "nes";
EXT_TO_PLATFORM.sfc = "snes";
EXT_TO_PLATFORM.smc = "snes";
EXT_TO_PLATFORM.gen = "genesis";
EXT_TO_PLATFORM.md = "genesis";

function platformForFile(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_PLATFORM[ext] ?? "snes";
}

export function ScanPanel() {
  const [busy, setBusy] = useState("");
  const [matches, setMatches] = useState<MetadataMatch[]>([]);
  const [providers, setProviders] = useState<ProvidersStatus | null>(null);
  const [error, setError] = useState("");
  const [imported, setImported] = useState<Set<string>>(new Set());

  const scanFiles = async (files: File[]) => {
    if (!files.length) return;
    setError("");
    setBusy(`Hashing ${files.length} file(s) locally…`);
    try {
      const manifest: (FileHashes & { platformSlug: string })[] = [];
      for (const file of files.slice(0, 40)) {
        setBusy(`Hashing ${file.name}…`);
        const hashes = await hashFile(file);
        manifest.push({ ...hashes, platformSlug: platformForFile(file.name) });
      }
      setBusy("Matching on the server…");
      const response = await fetch("/api/metadata/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: manifest.map((m) => ({
            fileName: m.fileName,
            sizeBytes: m.sizeBytes,
            crc32: m.crc32,
            sha1: m.sha1,
            platformSlug: m.platformSlug,
          })),
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "scan failed");
      setMatches(data.matches);
      setProviders(data.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "scan failed");
    } finally {
      setBusy("");
    }
  };

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    void scanFiles([...(event.target.files ?? [])]);
    event.target.value = "";
  };

  const importMatch = async (match: MetadataMatch) => {
    const platformSlug = platformForFile(match.fileName);
    setBusy(`Importing ${match.title ?? match.fileName}…`);
    try {
      const response = await fetch("/api/roms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: match.title ?? match.fileName,
          platformSlug,
          year: match.year ?? 0,
          genre: match.genre ?? "Unknown",
          players: match.players ?? 1,
          description: match.description ?? "",
          filePath: `/${platformSlug}/${match.fileName}`,
          sizeMb: 1,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "import failed");
      if (match.coverUrl) {
        await fetch(`/api/roms/${data.rom.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coverUrl: match.coverUrl,
            coverProvider: match.provider === "none" ? "generated" : match.provider,
          }),
        });
      }
      setImported((prev) => new Set(prev).add(match.fileName));
    } catch (err) {
      setError(err instanceof Error ? err.message : "import failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-primary cursor-pointer !px-5 !py-2.5 text-xs">
          Choose ROM files
          <input type="file" multiple className="hidden" onChange={onPick} />
        </label>
        <label className="btn-glass cursor-pointer !px-5 !py-2.5 text-xs">
          Scan a folder
          <input
            type="file"
            multiple
            // @ts-expect-error non-standard but widely supported
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={onPick}
          />
        </label>
        {providers && (
          <span className="flex items-center gap-2 text-[11px] text-white/50">
            <ProviderChip name="ScreenScraper" on={providers.screenscraper} />
            <ProviderChip name="IGDB" on={providers.igdb} />
          </span>
        )}
      </div>

      {busy && <p className="mt-3 text-xs text-violet-300">{busy}</p>}
      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      {providers && !providers.igdb && !providers.screenscraper && (
        <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs text-amber-200/90">
          No metadata provider is configured — files will import with their filenames and
          generated covers. Set <code>TWITCH_CLIENT_ID</code>/<code>TWITCH_CLIENT_SECRET</code> (IGDB)
          or <code>SCREENSCRAPER_DEV_ID</code>/<code>SCREENSCRAPER_DEV_PASSWORD</code> for full matches.
        </p>
      )}

      {matches.length > 0 && (
        <div className="mt-4 space-y-2">
          {matches.map((match) => (
            <div
              key={match.fileName}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"
            >
              {match.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={match.coverUrl} alt="" className="h-14 w-10 rounded-md object-cover" />
              ) : (
                <div className="h-14 w-10 rounded-md bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {match.title ?? match.fileName}
                </p>
                <p className="truncate text-[11px] text-white/50">
                  {match.fileName} · {match.year ?? "year ?"} · {match.genre ?? "genre ?"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  match.matchMethod === "hash"
                    ? "bg-emerald-400/15 text-emerald-200"
                    : match.matchMethod === "name"
                      ? "bg-sky-400/15 text-sky-200"
                      : "bg-white/10 text-white/60"
                }`}
              >
                {match.matchMethod === "hash" ? "hash match" : match.matchMethod === "name" ? "name match" : "no match"}
                {match.provider !== "none" ? ` · ${match.provider}` : ""}
              </span>
              {imported.has(match.fileName) ? (
                <span className="text-xs text-emerald-300">✓ imported</span>
              ) : (
                <button
                  className="rounded-full bg-white/10 px-4 py-1.5 text-xs hover:bg-white/20"
                  onClick={() => importMatch(match)}
                >
                  Import
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-white/45">
        ROM bytes never leave your device — only names, sizes and hashes are matched, on the
        server, against {["ScreenScraper", "IGDB"].join(" and ")}.
        {Object.keys(DESKTOP_ONLY_PLATFORMS).length > 0 &&
          " Platforms without a browser core still import — play them via desktop launch."}
      </p>
    </div>
  );
}

function ProviderChip({ name, on }: { name: string; on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
        on ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/50"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-300" : "bg-white/30"}`} />
      {name} {on ? "on" : "off"}
    </span>
  );
}
