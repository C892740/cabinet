import type { Metadata } from "next";
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { CoverArt } from "@/components/CoverArt";
import { ArrowRightIcon, CollectionsIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Collections",
  description: "Curated shelves from your Cabinet library.",
};

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const repo = getRepo();
  const [collections, roms, platforms] = await Promise.all([
    repo.listCollections(),
    repo.listRoms(),
    repo.listPlatforms(),
  ]);
  const romById = new Map(roms.map((rom) => [rom.id, rom]));
  const platformBySlug = new Map(platforms.map((p) => [p.slug, p]));

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
        Collections
      </h1>
      <p className="mt-2 text-white/50">
        Hand-picked shelves — public collections are read-only for everyone else.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => {
          const covers = collection.romIds
            .map((id) => romById.get(id))
            .filter((rom): rom is NonNullable<typeof rom> => Boolean(rom))
            .slice(0, 4);

          return (
            <Link
              key={collection.id}
              href="/library"
              className="glass glass-hover group rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1.5"
            >
              {/* cover mosaic */}
              <div className="relative h-44">
                {covers.map((rom, index) => (
                  <div
                    key={rom.id}
                    className="absolute w-[38%] transition-transform duration-500 group-hover:z-10"
                    style={{
                      left: `${index * 21}%`,
                      top: index % 2 === 0 ? 0 : 10,
                      zIndex: index,
                      transform: `rotate(${(index - 1.5) * 4}deg)`,
                    }}
                  >
                    <CoverArt
                      rom={rom}
                      platform={platformBySlug.get(rom.platformSlug) ?? platforms[0]!}
                      className="aspect-[3/4] shadow-card"
                      rounded="rounded-2xl"
                      showBadge={false}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    {collection.name}
                  </h2>
                  <p className="mt-1.5 line-clamp-2 text-sm text-white/55">
                    {collection.description}
                  </p>
                </div>
                <span className="accent-gradient inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowRightIcon size={16} />
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
                <CollectionsIcon size={14} />
                {collection.romIds.length} games
                {collection.isPublic && (
                  <span className="ml-auto rounded-full border border-white/10 px-2.5 py-0.5">
                    Public
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
