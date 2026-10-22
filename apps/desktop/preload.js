"use strict";
/**
 * Preload — the only bridge between renderer pages and the system.
 *
 * The renderer (key vault window, admin prompt) gets a narrow, promise-based
 * API. No Node access leaks into page context.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    pickFile: (filters) => electron_1.ipcRenderer.invoke("dialog:pickFile", filters),
    pickDirectory: () => electron_1.ipcRenderer.invoke("dialog:pickDirectory"),
    pickSave: (defaultName) => electron_1.ipcRenderer.invoke("dialog:pickSave", defaultName),
    generateKey: () => electron_1.ipcRenderer.invoke("keyvault:generate"),
    inspectVault: (filePath) => electron_1.ipcRenderer.invoke("keyvault:inspect", filePath),
    sealVault: (input) => electron_1.ipcRenderer.invoke("keyvault:seal", input),
    revealVault: (input) => electron_1.ipcRenderer.invoke("keyvault:reveal", input),
    scanRoms: (directory) => electron_1.ipcRenderer.invoke("roms:scan", directory),
    launchEmulator: (input) => electron_1.ipcRenderer.invoke("emulator:launch", input),
    onEmulatorExit: (callback) => {
        const listener = (_event, info) => callback(info);
        electron_1.ipcRenderer.on("emulator:exited", listener);
        return () => electron_1.ipcRenderer.removeListener("emulator:exited", listener);
    },
    pickRomFile: () => electron_1.ipcRenderer.invoke("dialog:pickFile", [{ name: "ROM files", extensions: ["zip", "nes", "sfc", "smc", "gb", "gbc", "gba", "gen", "md", "bin", "cue", "iso", "chd", "n64", "z64", "v64", "gg", "sms", "nds"] }]),
    unlockAdmin: (key) => electron_1.ipcRenderer.invoke("admin:unlock", key),
    navigate: (target) => electron_1.ipcRenderer.invoke("app:navigate", target),
    openExternal: (url) => electron_1.ipcRenderer.invoke("app:openExternal", url),
};
electron_1.contextBridge.exposeInMainWorld("cabinet", api);
//# sourceMappingURL=preload.js.map