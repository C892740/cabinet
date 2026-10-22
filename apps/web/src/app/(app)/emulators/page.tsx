import type { Metadata } from "next";
import Link from "next/link";
import { CpuIcon, GamepadIcon, SparklesIcon } from "@/components/Icons";
import { ScanPanel } from "@/components/emulator/ScanPanel";
import { ProfilesPanel } from "@/components/emulator/ProfilesPanel";
import { CORE_BY_PLATFORM, DESKTOP_ONLY_PLATFORMS } from "@/lib/emulator-cores";

export const metadata: Metadata = {
  title: "Emulators — Cabinet",
  description:
    "In-browser WASM cores, desktop emulator profiles, server-side ROM scanning, cloud saves and netplay.",
};

export const dynamic = "force-dynamic";

const WINGS = [
  {
    title: "In-browser play",
    description:
      "EmulatorJS WASM cores — pick a game and it opens instantly, with cloud save states, screenshots and play history synced to your account.",
    icon: <GamepadIcon size={20} />,
  },
  {
    title: "Desktop emulator profiles",
    description:
      "Point Cabinet Desktop at RetroArch or any standalone emulator: per-platform profiles with core and argument templates, and one-click launch.",
    icon: <CpuIcon size={20} />,
  },
  {
    title: "Server-side ROM scanning",
    description:
      "Files are hashed locally; Cabinet matches them against ScreenScraper and IGDB on the server and imports games with real box art — credentials never reach your browser.",
    icon: <SparklesIcon size={20} />,
  },
  {
    title: "Netplay",
    description:
      "Share a 5-character room code and a friend plays your game over a direct peer-to-peer stream, controls forwarded to the host — remote couch co-op.",
    icon: <GamepadIcon size={20} />,
  },
];

export default function EmulatorsPage() {
  const cores = Object.entries(CORE_BY_PLATFORM);
  return (
    <div className="max-w-5xl">
      <div className="glass relative overflow-hidden rounded-4xl px-8 py-10 sm:px-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="relative">
          <span className="accent-gradient inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow">
            <CpuIcon size={27} />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
            The Emulators wing is open.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/60">
            Play in the browser, launch on the desktop, scan your library against the big
            metadata databases, and take your saves everywhere. Cabinet ships no games —
            bring your own legally obtained ROMs.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/library" className="btn-primary">
              <SparklesIcon size={16} />
              Pick a game to play
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-white">In-browser WASM cores</h2>
        <p className="mt-1 text-sm text-white/55">
          Powered by EmulatorJS — one click from the library, no install. Blue cores are
          rock-solid; violet cores are playable but rougher.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cores.map(([slug, info]) => (
            <div key={slug} className="glass glass-hover rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{info.label}</h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    info.status === "stable"
                      ? "bg-sky-400/15 text-sky-200"
                      : "bg-violet-400/15 text-violet-200"
                  }`}
                >
                  {info.status}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-white/50">
                core <code className="text-white/70">{info.core}</code> · {info.backend}
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                .{info.extensions.slice(0, 4).join(" .")}
              </p>
              {info.bios && <p className="mt-2 text-[11px] text-amber-200/70">⚠ {info.bios}</p>}
              <Link
                href={`/library?platform=${slug}`}
                className="mt-3 inline-flex rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                Pick a game →
              </Link>
            </div>
          ))}
          {Object.entries(DESKTOP_ONLY_PLATFORMS).map(([slug, note]) => (
            <div key={slug} className="glass rounded-2xl p-4 opacity-80">
              <h3 className="text-sm font-semibold text-white">{slug.toUpperCase()}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/50">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-white">Library scanning</h2>
        <p className="mt-1 text-sm text-white/55">
          Hash locally, match on the server (ScreenScraper + IGDB), import with real covers.
        </p>
        <div className="glass mt-5 rounded-3xl p-6">
          <ScanPanel />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-white">Desktop emulator profiles</h2>
        <p className="mt-1 text-sm text-white/55">
          One-click launch from Cabinet Desktop — per-platform defaults, core + argument templates.
        </p>
        <div className="glass mt-5 rounded-3xl p-6">
          <ProfilesPanel />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-white">Everything else</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {WINGS.map((item) => (
            <div key={item.title} className="glass glass-hover rounded-3xl p-6">
              <div className="flex items-center gap-3">
                <span className="accent-gradient inline-flex h-10 w-10 items-center justify-center rounded-xl text-white">
                  {item.icon}
                </span>
                <h3 className="font-semibold tracking-tight text-white">{item.title}</h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-white/55">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
