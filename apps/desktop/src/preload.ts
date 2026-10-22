/**
 * Preload — the only bridge between renderer pages and the system.
 *
 * The renderer (key vault window, admin prompt) gets a narrow, promise-based
 * API. No Node access leaks into page context.
 */

import { contextBridge, ipcRenderer } from "electron";

export interface VaultHeader {
  format: string;
  version: number;
  label: string;
  createdAt: string;
  kdf: { name: string; N: number; r: number; p: number };
  cipher: { name: string };
}

export interface CabinetApi {
  pickFile(filters: { name: string; extensions: string[] }[]): Promise<string | null>;
  pickDirectory(): Promise<string | null>;
  pickSave(defaultName: string): Promise<string | null>;
  pickRomFile(): Promise<string | null>;
  generateKey(): Promise<string>;
  inspectVault(filePath: string): Promise<VaultHeader>;
  sealVault(input: {
    filePath: string;
    plaintext: string;
    passphrase: string;
    label: string;
  }): Promise<VaultHeader>;
  revealVault(input: { filePath: string; passphrase: string }): Promise<string>;
  scanRoms(directory: string): Promise<{ directory: string; count: number; files: string[] }>;
  launchEmulator(input: {
    emulatorPath: string;
    romPath: string;
    /** Expanded argument list from the profile's args template. */
    args?: string[];
  }): Promise<{ ok: boolean; error?: string }>;
  /** Fires when a launched emulator exits; returns an unsubscribe function. */
  onEmulatorExit(
    callback: (info: { emulatorPath: string; code: number | null }) => void,
  ): () => void;
  unlockAdmin(key: string): Promise<{ ok: boolean; error?: string }>;
  navigate(target: string): Promise<void>;
  openExternal(url: string): Promise<void>;
}

const api: CabinetApi = {
  pickFile: (filters) => ipcRenderer.invoke("dialog:pickFile", filters),
  pickDirectory: () => ipcRenderer.invoke("dialog:pickDirectory"),
  pickSave: (defaultName) => ipcRenderer.invoke("dialog:pickSave", defaultName),
  generateKey: () => ipcRenderer.invoke("keyvault:generate"),
  inspectVault: (filePath) => ipcRenderer.invoke("keyvault:inspect", filePath),
  sealVault: (input) => ipcRenderer.invoke("keyvault:seal", input),
  revealVault: (input) => ipcRenderer.invoke("keyvault:reveal", input),
  scanRoms: (directory) => ipcRenderer.invoke("roms:scan", directory),
  launchEmulator: (input) => ipcRenderer.invoke("emulator:launch", input),
  onEmulatorExit: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      info: { emulatorPath: string; code: number | null },
    ) => callback(info);
    ipcRenderer.on("emulator:exited", listener);
    return () => ipcRenderer.removeListener("emulator:exited", listener);
  },
  pickRomFile: () => ipcRenderer.invoke("dialog:pickFile", [{ name: "ROM files", extensions: ["zip", "nes", "sfc", "smc", "gb", "gbc", "gba", "gen", "md", "bin", "cue", "iso", "chd", "n64", "z64", "v64", "gg", "sms", "nds"] }]),
  unlockAdmin: (key) => ipcRenderer.invoke("admin:unlock", key),
  navigate: (target) => ipcRenderer.invoke("app:navigate", target),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
};

contextBridge.exposeInMainWorld("cabinet", api);
