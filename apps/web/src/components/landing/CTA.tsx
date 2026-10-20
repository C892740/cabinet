"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon, GithubIcon } from "../Icons";
import { site } from "@/lib/site";

export function CTA() {
  return (
    <section className="px-6 pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-5xl accent-gradient px-10 py-20 text-center shadow-glow-strong sm:px-16">
        <div className="absolute inset-0 noise opacity-[0.12] mix-blend-overlay" />
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-black/20 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[52px]">
            Give your collection the home it deserves.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/85">
            Self-host it tonight, invite your friends, and play on the big screen this
            weekend.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-violet-700 shadow-xl transition-all duration-300 hover:scale-[1.04] active:scale-[0.98]"
            >
              Open the library
              <ArrowRightIcon size={16} />
            </Link>
            <a
              href={site.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:scale-[1.04] hover:bg-white/20 active:scale-[0.98]"
            >
              <GithubIcon size={17} />
              Get it on GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
