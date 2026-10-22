/**
 * Emulator core mapping for the in-browser player.
 *
 * EmulatorJS is loaded from its CDN into an isolated frame (see
 * app/play/frame/route.ts). `core` is the EJS_core system identifier; the
 * default backend cores are listed for reference. Platforms EmulatorJS does
 * not support in the browser (Dreamcast, PS2, arcade boards…) map to null and
 * fall back to desktop emulator launch — honesty over a broken button.
 */

import type { EmulatorCoreId } from "./types";

export interface CoreInfo {
  /** EJS_core system identifier. */
  core: EmulatorCoreId;
  /** Human label, e.g. "SNES · snes9x". */
  label: string;
  /** Default libretro backend core inside EmulatorJS. */
  backend: string;
  /** ROM extensions the player accepts. */
  extensions: string[];
  /** BIOS requirement note, or null when none is needed. */
  bios: string | null;
  /** "stable" cores are well covered; "beta" cores are playable but rougher. */
  status: "stable" | "beta";
}

/** Cabinet platform slug → in-browser core. */
export const CORE_BY_PLATFORM: Record<string, CoreInfo> = {
  nes: {
    core: "nes",
    label: "NES · Famicom",
    backend: "fceumm",
    extensions: ["nes", "fds", "unf", "unif", "zip"],
    bios: null,
    status: "stable",
  },
  snes: {
    core: "snes",
    label: "SNES · Super Famicom",
    backend: "snes9x",
    extensions: ["sfc", "smc", "fig", "swc", "bs", "zip"],
    bios: null,
    status: "stable",
  },
  gb: {
    core: "gb",
    label: "Game Boy · Game Boy Color",
    backend: "gambatte",
    extensions: ["gb", "gbc", "dmg", "zip"],
    bios: null,
    status: "stable",
  },
  gba: {
    core: "gba",
    label: "Game Boy Advance",
    backend: "mgba",
    extensions: ["gba", "agb", "bin", "zip"],
    bios: null,
    status: "stable",
  },
  n64: {
    core: "n64",
    label: "Nintendo 64",
    backend: "mupen64plus-next",
    extensions: ["n64", "z64", "v64", "u64", "zip"],
    bios: null,
    status: "beta",
  },
  genesis: {
    core: "segaMD",
    label: "Mega Drive · Genesis",
    backend: "genesis-plus-gx",
    extensions: ["gen", "md", "smd", "bin", "zip"],
    bios: null,
    status: "stable",
  },
  gamegear: {
    core: "segaGG",
    label: "Game Gear",
    backend: "genesis-plus-gx",
    extensions: ["gg", "zip"],
    bios: null,
    status: "stable",
  },
  sms: {
    core: "segaMS",
    label: "Master System",
    backend: "smsplus",
    extensions: ["sms", "zip"],
    bios: null,
    status: "stable",
  },
  psx: {
    core: "psx",
    label: "PlayStation",
    backend: "pcsx-rearmed",
    extensions: ["bin", "cue", "img", "mdf", "pbp", "chd", "iso", "zip"],
    bios: "Works best with a PS1 BIOS (scph5501/5502) set as the BIOS file.",
    status: "beta",
  },
  nds: {
    core: "nds",
    label: "Nintendo DS · DeSmuME",
    backend: "desmume",
    extensions: ["nds", "zip"],
    bios: "No BIOS needed — Cabinet boots the BIOS-free DeSmuME core. Optional melonDS (bios7/9 + firmware) adds extra compatibility.",
    status: "beta",
  },
  segaSaturn: {
    core: "segaSaturn",
    label: "Sega Saturn",
    backend: "yabause",
    extensions: ["chd", "cue", "bin", "iso", "zip"],
    bios: "Saturn BIOS recommended.",
    status: "beta",
  },
  atari2600: {
    core: "atari2600",
    label: "Atari 2600",
    backend: "stella2014",
    extensions: ["a26", "bin", "zip"],
    bios: null,
    status: "stable",
  },
};

/** Platforms without a browser core — desktop emulator launch only. */
export const DESKTOP_ONLY_PLATFORMS: Record<string, string> = {
  dreamcast: "Dreamcast has no EmulatorJS core — launch it with a desktop emulator (Flycast/Redream).",
  ps2: "PS2 has no EmulatorJS core — launch it with a desktop emulator (PCSX2).",
  arcade: "Arcade boards vary too much for one browser core — launch with MAME/RetroArch on desktop.",
};

export function coreForPlatform(platformSlug: string): CoreInfo | null {
  return CORE_BY_PLATFORM[platformSlug] ?? null;
}

export function isPlayableInBrowser(platformSlug: string): boolean {
  return Boolean(CORE_BY_PLATFORM[platformSlug]);
}

/**
 * Exact EJS_core values the player frame boots. Normally the system
 * identifier itself — except NDS, where melonDS (the "nds" default) requires
 * DS BIOS + firmware files. DeSmuME runs cartridge games (Pokemon Diamond
 * included) out of the box, so it is Cabinet's NDS backend.
 */
const EJS_OVERRIDE: Record<string, string> = {
  nds: "desmume",
};

export function ejsCoreFor(core: EmulatorCoreId | string): string {
  return EJS_OVERRIDE[core] ?? core;
}

const KNOWN_CORES = new Set<string>(Object.values(CORE_BY_PLATFORM).map((c) => c.core));

export function isKnownCore(core: string): core is EmulatorCoreId {
  return KNOWN_CORES.has(core);
}

const KNOWN_EJS_CORES = new Set<string>([
  ...Object.values(CORE_BY_PLATFORM).map((c) => c.core),
  ...Object.values(CORE_BY_PLATFORM).map((c) => ejsCoreFor(c.core)),
]);

/** What the EmulatorJS frame accepts in its `core` query parameter. */
export function isKnownEjsCore(core: string): boolean {
  return KNOWN_EJS_CORES.has(core);
}
