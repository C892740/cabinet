"use client";

import { motion } from "framer-motion";
import { CheckIcon, CloudIcon, DownloadIcon, GithubIcon } from "../Icons";
import { MonitorIcon } from "./MonitorIcon";
import { Reveal, lift } from "../ui/Reveal";
import { site } from "@/lib/site";

const webPerks = [
  "Deploys to Vercel in minutes",
  "Neon Postgres with serverless pooling",
  "Instant, zero-install access from any device",
  "TV Mode included",
];

const desktopPerks = [
  "Native Windows .exe (Electron)",
  "Scan local ROM folders and launch emulators",
  "Encrypted admin key vault (AES-256-GCM)",
  "Same account, same library as the web app",
];

export function AppsSection() {
  return (
    <section id="apps" className="scroll-mt-28 px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/75">
            <CloudIcon size={14} className="text-sky-300" />
            Two apps, one account
          </div>
          <h2 className="text-gradient text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Use it in the browser.
            <br />
            Own it on the desktop.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/60">
            The web app and the Windows app share one database and one login — start a
            session on your laptop, finish it on the TV.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <motion.article
              {...lift}
              className="glass glass-hover flex h-full flex-col rounded-3xl p-9"
            >
              <div className="mb-6 inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 p-3.5 text-white shadow-glow">
                <CloudIcon size={24} />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-white">
                Cabinet Web
              </h3>
              <p className="mt-3 flex-1 leading-relaxed text-white/60">
                The full library experience in your browser — perfect for browsing on the
                couch, the office, or a smart TV.
              </p>
              <ul className="mt-6 space-y-2.5">
                {webPerks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm text-white/70">
                    <CheckIcon size={15} className="text-emerald-400" />
                    {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={site.appUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  Launch web app
                </a>
                <a
                  href={`${site.repoUrl}#readme`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-glass"
                >
                  <GithubIcon size={16} />
                  Deploy guide
                </a>
              </div>
            </motion.article>
          </Reveal>

          <Reveal delay={0.1}>
            <motion.article
              {...lift}
              className="glass glass-hover relative flex h-full flex-col overflow-hidden rounded-3xl p-9"
            >
              <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-violet-600/25 blur-3xl" />
              <div className="mb-6 inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-3.5 text-white shadow-glow">
                <MonitorIcon size={24} />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-white">
                Cabinet Desktop
              </h3>
              <p className="mt-3 flex-1 leading-relaxed text-white/60">
                A native Windows app for people who keep their ROMs on disk — with the
                encrypted admin vault built in.
              </p>
              <ul className="mt-6 space-y-2.5">
                {desktopPerks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm text-white/70">
                    <CheckIcon size={15} className="text-emerald-400" />
                    {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={site.downloadUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  <DownloadIcon size={17} />
                  Download .exe
                </a>
                <a
                  href={`${site.repoUrl}#readme`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-glass"
                >
                  Build from source
                </a>
              </div>
            </motion.article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
