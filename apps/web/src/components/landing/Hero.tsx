"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { ReactNode } from "react";
import { CoverArt } from "../CoverArt";
import { ArrowRightIcon, GithubIcon, PlayIcon, SearchIcon, SparklesIcon, TvIcon } from "../Icons";
import { platforms, roms } from "@/lib/demo-data";
import { site } from "@/lib/site";

function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), { stiffness: 140, damping: 18 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-9, 9]), { stiffness: 140, damping: 18 });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={`perspective-1200 ${className ?? ""}`}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - rect.left) / rect.width - 0.5);
        y.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

function platformOf(slug: string) {
  return platforms.find((p) => p.slug === slug) ?? platforms[0]!;
}

function AppPreview() {
  const featured = roms.slice(0, 8);
  return (
    <div className="rounded-[26px] border border-white/[0.12] bg-white/[0.055] p-2 shadow-card backdrop-blur-2xl">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="mx-auto flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-1 text-[10px] text-white/55">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {site.appUrl.replace("https://", "")}/library
        </div>
      </div>

      {/* window body */}
      <div className="overflow-hidden rounded-[20px] bg-[#0b0b12]">
        <div className="flex">
          {/* mini sidebar */}
          <aside className="hidden w-[128px] shrink-0 flex-col gap-1.5 border-r border-white/[0.07] bg-white/[0.02] p-3 sm:flex">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="accent-gradient h-4 w-4 rounded-[30%]" />
              <span className="text-[9px] font-semibold text-white/80">Cabinet</span>
            </div>
            {["Library", "Platforms", "Collections", "Emulators", "TV Mode"].map((item, i) => (
              <div
                key={item}
                className={`rounded-lg px-2 py-1.5 text-[8px] ${
                  i === 0 ? "bg-white/[0.1] text-white" : "text-white/45"
                }`}
              >
                {item}
                {item === "Emulators" && (
                  <span className="ml-1 rounded-full bg-violet-500/25 px-1 text-[6px] text-violet-200">
                    soon
                  </span>
                )}
              </div>
            ))}
          </aside>

          {/* mini content */}
          <div className="min-w-0 flex-1 p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5">
                <SearchIcon size={9} className="text-white/40" />
                <span className="text-[8px] text-white/40">Search 48 games…</span>
              </div>
              <div className="accent-gradient rounded-full px-2.5 py-1.5 text-[8px] font-semibold text-white">
                All
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {featured.map((rom) => (
                <CoverArt
                  key={rom.id}
                  rom={rom}
                  platform={platformOf(rom.platformSlug)}
                  className="aspect-[3/4]"
                  rounded="rounded-xl"
                  showBadge={false}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-36 sm:pt-44">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />
        <div className="absolute -left-24 top-40 h-[340px] w-[340px] rounded-full bg-sky-500/10 blur-[110px] animate-float-slow" />
        <div className="absolute -right-16 top-64 h-[300px] w-[300px] rounded-full bg-fuchsia-500/10 blur-[110px] animate-float" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_1.15fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="glass mb-7 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/80"
          >
            <SparklesIcon size={14} className="text-violet-300" />
            New — TV Mode with gamepad navigation is in early access
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="text-gradient text-5xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[68px]"
          >
            Your retro library,
            <br />
            <span className="accent-text">beautifully organized.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-white/65"
          >
            Cabinet turns your ROM collection into something that feels like it was
            designed in Cupertino — silky cover art, instant search, one account across
            web and desktop, and a living-room mode built for two controllers.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link href="/library" className="btn-primary">
              <PlayIcon size={16} />
              Explore the library
            </Link>
            <a href={site.downloadUrl} target="_blank" rel="noreferrer" className="btn-glass">
              Download for Windows
            </a>
            <a
              href={site.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              <GithubIcon size={18} />
              Star on GitHub
              <ArrowRightIcon size={15} />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-white/50"
          >
            <span>⚡ Next.js + Neon Postgres</span>
            <span>🖥 Windows app with encrypted admin vault</span>
            <span>📺 Samsung TV ready</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 34, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <Tilt>
            <AppPreview />
          </Tilt>
          <div className="glass mx-auto mt-5 flex w-fit items-center gap-3 rounded-full px-5 py-2.5 text-xs text-white/65">
            <span className="flex -space-x-2">
              {["#8b5cf6", "#38bdf8", "#f472b6"].map((color) => (
                <span
                  key={color}
                  className="h-5 w-5 rounded-full border-2 border-ink-950"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            One account for web, desktop and TV
          </div>
        </motion.div>
      </div>
    </section>
  );
}
