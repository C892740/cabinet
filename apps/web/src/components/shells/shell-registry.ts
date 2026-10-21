/**
 * Shell registry — the optional console-style layouts.
 *
 * Zorin offers Windows- and macOS-familiar desktops; Cabinet offers the same
 * choice of muscle memory for game libraries. Every shell shows the same data
 * and opens the same rom dialog — only the navigation grammar changes.
 */

export type ShellId = "classic" | "ps5" | "nintendo" | "dual" | "xmb";

export interface ShellDescriptor {
  id: ShellId;
  name: string;
  /** The familiarity target this shell borrows its muscle memory from. */
  inspiration: string;
  blurb: string;
  accent: string;
}

export const SHELLS: ShellDescriptor[] = [
  {
    id: "ps5",
    name: "PlayStation 5",
    inspiration: "PS5 home screen",
    blurb: "Games rail, full-bleed hero art, clock in the corner — the living-room default.",
    accent: "#4b8dff",
  },
  {
    id: "nintendo",
    name: "Nintendo",
    inspiration: "Switch / 3DS home",
    blurb: "Bright rounded tiles on a clean top bar — friendly, chunky, tap-friendly.",
    accent: "#e60012",
  },
  {
    id: "dual",
    name: "Dual Screen",
    inspiration: "Nintendo DS / 3DS",
    blurb: "Two screens: hero banner up top, touchable icon grid below.",
    accent: "#00b39f",
  },
  {
    id: "xmb",
    name: "XMB",
    inspiration: "PS3 Cross Media Bar",
    blurb: "Categories across, icons down — the columnar classic with a wave background.",
    accent: "#9bb8c9",
  },
  {
    id: "classic",
    name: "Classic",
    inspiration: "Cabinet original",
    blurb: "The familiar Cabinet grid with search, filters and sorting.",
    accent: "#8b5cf6",
  },
];

export const DEFAULT_SHELL: ShellId = "ps5";
export const SHELL_STORAGE_KEY = "cabinet.shell";

export function readShellChoice(): ShellId {
  if (typeof window === "undefined") return DEFAULT_SHELL;
  const value = window.localStorage.getItem(SHELL_STORAGE_KEY) as ShellId | null;
  return SHELLS.some((shell) => shell.id === value) ? (value as ShellId) : DEFAULT_SHELL;
}

export function writeShellChoice(id: ShellId): void {
  if (typeof window !== "undefined") window.localStorage.setItem(SHELL_STORAGE_KEY, id);
}
