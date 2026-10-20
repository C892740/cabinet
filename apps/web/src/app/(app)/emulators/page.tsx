import type { Metadata } from "next";
import Link from "next/link";
import { CpuIcon, GamepadIcon, SparklesIcon, TvIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Emulators",
  description: "The Emulators section is coming to Cabinet — a dedicated home for cores, profiles and play sessions.",
};

const roadmap = [
  {
    title: "In-browser play",
    description:
      "WebAssembly emulator cores (EmulatorJS) so any supported game opens with one click — saves and states sync to your account.",
    status: "Planned",
  },
  {
    title: "Desktop emulator profiles",
    description:
      "Point Cabinet Desktop at your favourite emulators and launch ROMs directly, with per-platform defaults.",
    status: "Planned",
  },
  {
    title: "Save states & screenshots",
    description:
      "Server-side save states, per-user progress and screenshot galleries attached to every game.",
    status: "Planned",
  },
  {
    title: "Netplay",
    description:
      "Room-based multiplayer so you and your friends can share a session from different devices.",
    status: "Exploring",
  },
];

export default function EmulatorsPage() {
  return (
    <div className="max-w-4xl">
      <div className="glass relative overflow-hidden rounded-4xl px-8 py-12 sm:px-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="relative">
          <span className="accent-gradient inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow">
            <CpuIcon size={27} />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
            The Emulators wing is under construction.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/60">
            Cabinet is a library first — but this menu item already has a home. Future
            updates add emulator cores, launch profiles and play sessions in their own
            section, right where this placeholder sits.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/library" className="btn-primary">
              <SparklesIcon size={16} />
              Back to the library
            </Link>
            <Link href="/tv" className="btn-glass">
              <TvIcon size={16} />
              See TV Mode
            </Link>
          </div>
        </div>
      </div>

      <h2 className="mt-14 text-xl font-semibold tracking-tight text-white">Roadmap</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {roadmap.map((item) => (
          <div key={item.title} className="glass glass-hover rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold tracking-tight text-white">{item.title}</h3>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  item.status === "Exploring"
                    ? "bg-sky-400/15 text-sky-200"
                    : "bg-violet-400/15 text-violet-200"
                }`}
              >
                {item.status}
              </span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-white/55">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="glass mt-8 flex items-center gap-4 rounded-3xl p-6">
        <GamepadIcon size={22} className="shrink-0 text-violet-300" />
        <p className="text-sm text-white/60">
          Got opinions about emulator support? The roadmap lives in the GitHub repository —
          issues and feature requests are how this section gets prioritised.
        </p>
      </div>
    </div>
  );
}
