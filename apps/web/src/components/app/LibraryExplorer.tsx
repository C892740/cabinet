"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RomCard } from "./RomCard";
import { RomModal } from "./RomModal";
import { FilterIcon, HeartIcon, SearchIcon, SparklesIcon } from "../Icons";
import type { Platform, Rom } from "@/lib/types";

type SortKey = "title" | "rating" | "recent" | "played";

const sorts: { key: SortKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "rating", label: "Top rated" },
  { key: "recent", label: "Recently added" },
  { key: "played", label: "Recently played" },
];

export function LibraryExplorer({
  initialRoms,
  platforms,
}: {
  initialRoms: Rom[];
  platforms: Platform[];
}) {
  const [roms, setRoms] = useState<Rom[]>(initialRoms);
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("title");
  const [selected, setSelected] = useState<Rom | null>(null);

  const platformBySlug = useMemo(
    () => new Map(platforms.map((p) => [p.slug, p])),
    [platforms],
  );

  const visible = useMemo(() => {
    let list = roms;
    if (platformFilter) list = list.filter((r) => r.platformSlug === platformFilter);
    if (favoritesOnly) list = list.filter((r) => r.favorite);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.genre.toLowerCase().includes(q) ||
          String(r.year).includes(q),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "recent":
        sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
        break;
      case "played":
        sorted.sort((a, b) => (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? ""));
        break;
      default:
        sorted.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));
    }
    return sorted;
  }, [roms, query, platformFilter, favoritesOnly, sort]);

  function toggleFavorite(target: Rom) {
    setRoms((current) =>
      current.map((rom) => (rom.id === target.id ? { ...rom, favorite: !rom.favorite } : rom)),
    );
    setSelected((current) =>
      current && current.id === target.id ? { ...current, favorite: !current.favorite } : current,
    );
  }

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
            Library
          </h1>
          <p className="mt-2 text-white/50">
            {roms.length} games across {platforms.length} platforms
          </p>
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="glass flex flex-1 items-center gap-2.5 rounded-full px-4 py-2.5 transition-colors focus-within:border-white/25 sm:w-72">
            <SearchIcon size={17} className="text-white/45" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, genres, years…"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-white/45 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <div className="relative">
            <FilterIcon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="glass focus-ring appearance-none rounded-full py-2.5 pl-10 pr-9 text-sm text-white/85"
              aria-label="Sort library"
            >
              {sorts.map((option) => (
                <option key={option.key} value={option.key} className="bg-ink-800">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* filter chips */}
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setPlatformFilter(null)}
          className={`chip ${platformFilter === null ? "chip-active" : ""}`}
        >
          All platforms
        </button>
        <button
          type="button"
          onClick={() => setFavoritesOnly((value) => !value)}
          className={`chip ${favoritesOnly ? "chip-active" : ""}`}
        >
          <HeartIcon size={13} filled={favoritesOnly} />
          Favourites
        </button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        {platforms.map((platform) => (
          <button
            key={platform.slug}
            type="button"
            onClick={() =>
              setPlatformFilter((current) => (current === platform.slug ? null : platform.slug))
            }
            className={`chip ${platformFilter === platform.slug ? "chip-active" : ""}`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: platform.colorA }}
            />
            {platform.shortName}
            <span className="text-white/35">{platform.romCount ?? 0}</span>
          </button>
        ))}
      </div>

      {/* grid */}
      {visible.length > 0 ? (
        <motion.div
          layout
          className="mt-9 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((rom) => (
              <RomCard
                key={rom.id}
                rom={rom}
                platform={platformBySlug.get(rom.platformSlug) ?? platforms[0]!}
                onSelect={setSelected}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mt-10 flex flex-col items-center rounded-4xl px-8 py-20 text-center"
        >
          <span className="accent-gradient inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow">
            <SparklesIcon size={26} />
          </span>
          <h2 className="mt-6 text-xl font-semibold text-white">Nothing matches that</h2>
          <p className="mt-2 max-w-sm text-white/50">
            Try a different search, or reset the platform and favourites filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPlatformFilter(null);
              setFavoritesOnly(false);
            }}
            className="btn-glass mt-6"
          >
            Reset filters
          </button>
        </motion.div>
      )}

      <RomModal
        rom={selected}
        platform={selected ? (platformBySlug.get(selected.platformSlug) ?? null) : null}
        onClose={() => setSelected(null)}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
