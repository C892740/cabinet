"use client";

import type { ComponentType } from "react";
import { Reveal, lift } from "../ui/Reveal";
import { motion } from "framer-motion";
import {
  CpuIcon,
  DatabaseIcon,
  GamepadIcon,
  LibraryIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  TvIcon,
} from "../Icons";

const features: {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  accent: string;
}[] = [
  {
    title: "Cover art that feels alive",
    description:
      "Every game gets a generated, palette-aware cover with silky hover states. No two shelves look the same, and nothing is copyrighted.",
    icon: SparklesIcon,
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    title: "Search at the speed of thought",
    description:
      "Filter by platform, genre, region, players or rating. Results update as you type with fluid, layout-animated transitions.",
    icon: SearchIcon,
    accent: "from-sky-400 to-blue-600",
  },
  {
    title: "Your library, everywhere",
    description:
      "One account on the web app and the Windows app. Neon Postgres keeps your shelves, favourites and play history in sync.",
    icon: DatabaseIcon,
    accent: "from-emerald-400 to-teal-600",
  },
  {
    title: "Living-room TV mode",
    description:
      "A controller-first interface with big tiles, focus rings and support for two gamepads — designed for the sofa, not the desk.",
    icon: TvIcon,
    accent: "from-orange-400 to-rose-500",
  },
  {
    title: "Admin vault, sealed tight",
    description:
      "The admin dashboard is locked behind a key-password. On desktop it lives in an AES-256-GCM encrypted vault you open with a master passphrase.",
    icon: ShieldIcon,
    accent: "from-indigo-400 to-violet-600",
  },
  {
    title: "Emulators, coming soon",
    description:
      "A dedicated Emulators section is already in the menu. In-browser play and desktop emulator launching land in a future release.",
    icon: CpuIcon,
    accent: "from-pink-400 to-purple-600",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-28 px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/75">
            <LibraryIcon size={14} className="text-violet-300" />
            Everything a collection deserves
          </div>
          <h2 className="text-gradient text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Built like a modern product,
            <br />
            not a spreadsheet with covers.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/60">
            Cabinet takes the idea of a self-hosted ROM manager and gives it the polish of
            a first-party app — smooth motion, thoughtful defaults, and security that
            doesn&apos;t get in the way.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.07}>
              <motion.article
                {...lift}
                className="glass glass-hover group h-full rounded-3xl p-8"
              >
                <div
                  className={`mb-6 inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} p-3.5 text-white shadow-glow transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}
                >
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-white">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-relaxed text-white/60">{feature.description}</p>
              </motion.article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/45">
          <span className="inline-flex items-center gap-2">
            <GamepadIcon size={16} className="text-violet-300" /> Two-controller local multiplayer
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldIcon size={16} className="text-violet-300" /> Scrypt-hashed passwords
          </span>
          <span className="inline-flex items-center gap-2">
            <TvIcon size={16} className="text-violet-300" /> Samsung TV (Tizen) roadmap
          </span>
        </Reveal>
      </div>
    </section>
  );
}
