/**
 * Cabinet Desktop — Electron main process.
 *
 * Responsibilities:
 *   • host the Cabinet web app (same account, same Neon database)
 *   • the encrypted admin key vault window (uses @cabinet/core crypto)
 *   • the admin key-password prompt before opening the admin dashboard
 *   • local ROM folder scanning and emulator launching (roadmap features)
 *
 * Security posture: contextIsolation on, nodeIntegration off — renderer pages
 * talk to the system only through the narrow preload bridge.
 */

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
} from "electron";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  generateAdminKey,
  inspectVault,
  parseVault,
  revealSecret,
  sealSecret,
  serializeVault,
} from "@cabinet/core";

const APP_URL = process.env.CABINET_APP_URL ?? "https://cabinet.vercel.app";
const WINDOWS_DIR = path.join(__dirname, "..", "windows");

const ROM_EXTENSIONS = [
  "nes", "sfc", "smc", "gb", "gbc", "gba", "gen", "md", "bin", "cue", "chd",
  "iso", "n64", "z64", "v64", "gg", "sms", "nds", "pce", "zip", "7z",
];

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#07070b",
    title: "Cabinet",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void mainWindow.loadURL(APP_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

function createToolWindow(file: string, title: string, size = { width: 720, height: 760 }) {
  const win = new BrowserWindow({
    ...size,
    title,
    backgroundColor: "#0b0b12",
    resizable: true,
    minimizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  void win.loadFile(path.join(WINDOWS_DIR, file));
  return win;
}

// ─── key vault IPC ──────────────────────────────────────────────────────────

ipcMain.handle("keyvault:generate", () => generateAdminKey());

ipcMain.handle("keyvault:inspect", async (_event, filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  return inspectVault(parseVault(raw));
});

ipcMain.handle(
  "keyvault:seal",
  async (
    _event,
    input: { filePath: string; plaintext: string; passphrase: string; label: string },
  ) => {
    const vault = await sealSecret(
      input.plaintext,
      input.passphrase,
      input.label || "admin-dashboard-key",
    );
    await fs.writeFile(input.filePath, serializeVault(vault), { mode: 0o600 });
    return inspectVault(vault);
  },
);

ipcMain.handle(
  "keyvault:reveal",
  async (_event, input: { filePath: string; passphrase: string }) => {
    const raw = await fs.readFile(input.filePath, "utf8");
    return revealSecret(parseVault(raw), input.passphrase);
  },
);

// ─── dialogs ────────────────────────────────────────────────────────────────

ipcMain.handle("dialog:pickFile", async (_event, filters: { name: string; extensions: string[] }[]) => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: filters.length ? filters : [{ name: "All files", extensions: ["*"] }],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle("dialog:pickDirectory", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle("dialog:pickSave", async (_event, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: "Cabinet key vault", extensions: ["cabinet"] }],
  });
  return result.canceled ? null : (result.filePath ?? null);
});

// ─── ROM library + emulator launching (local, desktop-only powers) ──────────

async function walkDirectory(dir: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walkDirectory(full, depth + 1)));
    } else if (ROM_EXTENSIONS.includes(entry.name.split(".").pop()?.toLowerCase() ?? "")) {
      found.push(full);
    }
  }
  return found;
}

ipcMain.handle("roms:scan", async (_event, directory: string) => {
  const files = await walkDirectory(directory);
  return {
    directory,
    count: files.length,
    files: files.slice(0, 500),
  };
});

ipcMain.handle(
  "emulator:launch",
  async (_event, input: { emulatorPath: string; romPath: string }) => {
    try {
      const child = spawn(input.emulatorPath, [input.romPath], {
        detached: true,
        stdio: "ignore",
        shell: false,
      });
      child.unref();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "launch failed" };
    }
  },
);

// ─── admin key-password → web session ───────────────────────────────────────

ipcMain.handle("admin:unlock", async (_event, key: string) => {
  try {
    // Session-scoped fetch: shares the cookie jar with the main window, so the
    // unlock session cookie set by the web app applies to later navigations.
    const response = await session.defaultSession.fetch(`${APP_URL}/api/admin/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (payload.ok) {
      await mainWindow?.loadURL(`${APP_URL}/admin`);
    }
    return payload;
  } catch {
    return { ok: false, error: "unreachable" };
  }
});

ipcMain.handle("app:navigate", async (_event, target: string) => {
  await mainWindow?.loadURL(new URL(target, APP_URL).toString());
});

ipcMain.handle("app:openExternal", (_event, url: string) => {
  if (url.startsWith("https://")) void shell.openExternal(url);
});

// ─── menu ───────────────────────────────────────────────────────────────────

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Cabinet",
      submenu: [
        {
          label: "Admin Dashboard…",
          accelerator: "CmdOrCtrl+Shift+A",
          click: () => createToolWindow("admin.html", "Unlock admin dashboard", { width: 560, height: 620 }),
        },
        {
          label: "Key Vault…",
          accelerator: "CmdOrCtrl+Shift+K",
          click: () => createToolWindow("keyvault.html", "Cabinet Key Vault"),
        },
        { type: "separator" },
        {
          label: "Scan ROM Folder…",
          click: async () => {
            const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
            if (!result.canceled && result.filePaths[0]) {
              const scan = await walkDirectory(result.filePaths[0]);
              void dialog.showMessageBox({
                type: "info",
                title: "Scan complete",
                message: `Found ${scan.length} ROM files in ${result.filePaths[0]}`,
              });
            }
          },
        },
        {
          label: "Launch Emulator…",
          click: async () => {
            const emulator = await dialog.showOpenDialog({
              properties: ["openFile"],
              filters: [{ name: "Executables", extensions: ["exe", "bat", "cmd"] }],
            });
            const rom = await dialog.showOpenDialog({
              properties: ["openFile"],
              filters: [{ name: "ROM files", extensions: ROM_EXTENSIONS }],
            });
            if (!emulator.canceled && !rom.canceled && emulator.filePaths[0] && rom.filePaths[0]) {
              spawn(emulator.filePaths[0], [rom.filePaths[0]], { detached: true, stdio: "ignore", shell: false }).unref();
            }
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Library", click: () => void mainWindow?.loadURL(`${APP_URL}/library`) },
        { label: "TV Mode", click: () => void mainWindow?.loadURL(`${APP_URL}/tv`) },
        { role: "reload" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => void shell.openExternal("https://github.com/cabinet-roms/cabinet#readme"),
        },
        {
          label: "About Cabinet",
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "About Cabinet",
              message: `Cabinet Desktop ${app.getVersion()}\n\nYour retro library, beautifully organized.\n\nCabinet ships no games — bring your own legally obtained ROMs.`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── lifecycle ──────────────────────────────────────────────────────────────

void app.whenReady().then(() => {
  buildMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
