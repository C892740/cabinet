"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CoverArt } from "../CoverArt";
import { CheckIcon, GamepadIcon, TvIcon } from "../Icons";
import { Reveal } from "../ui/Reveal";
import { platforms, roms } from "@/lib/demo-data";

function platformOf(slug: string) {
  return platforms.find((p) => p.slug === slug) ?? platforms[0]!;
}

const highlights = [
  "Big, legible tiles designed for a 10-foot screen",
  "D-pad and stick navigation with focus rings",
  "Two controllers supported out of the box",
  "Samsung TV (Tizen) packaging on the roadmap",
];

export function TVSection() {
  const tiles = roms.slice(10, 15);
  return (
    <section id="tv" className="scroll-mt-28 overflow-hidden px-6 py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal>
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/75">
            <TvIcon size={14} className="text-orange-300" />
            Cabinet TV Mode
          </div>
          <h2 className="text-gradient text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Sofa-first.
            <br />
            Controller-ready.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/60">
            Point your TV browser at Cabinet and the interface transforms: larger tiles,
            spatial navigation and gamepad support via the standard Gamepad API — with
            room for player two.
          </p>

          <ul className="mt-8 space-y-3.5">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-white/75">
                <span className="accent-gradient mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white">
                  <CheckIcon size={13} />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/tv" className="btn-primary">
              <GamepadIcon size={17} />
              Try TV Mode
            </Link>
            <Link href="/library" className="btn-glass">
              Browse the library
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          {/* TV frame */}
          <motion.div
            whileHover={{ y: -8 }}
            transition={{ type: "spring", stiffness: 180, damping: 20 }}
            className="relative rounded-[2rem] border-[10px] border-white/[0.09] bg-black shadow-card"
          >
            <div className="absolute inset-0 rounded-[1.4rem] bg-gradient-to-br from-violet-600/20 via-transparent to-fuchsia-600/20" />
            <div className="relative p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                    Continue playing
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    Player 1 · Xbox Controller
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold text-emerald-300">
                  ● 2 controllers connected
                </span>
              </div>
              <div className="flex gap-3 overflow-hidden">
                {tiles.map((rom, index) => (
                  <CoverArt
                    key={rom.id}
                    rom={rom}
                    platform={platformOf(rom.platformSlug)}
                    className={`aspect-[3/4] w-[31%] shrink-0 transition-all duration-500 ${
                      index === 1
                        ? "ring-2 ring-white shadow-glow"
                        : "opacity-60 ring-1 ring-white/10"
                    }`}
                    rounded="rounded-2xl"
                    showBadge={false}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-white/45">
                <GamepadIcon size={13} />
                Press A to play · Y for details · B to go back
              </div>
            </div>
            {/* stand */}
            <div className="mx-auto h-6 w-28 rounded-b-2xl bg-white/[0.08]" />
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
