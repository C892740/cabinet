# Cabinet Desktop (Windows .exe)

The native shell around Cabinet: the same account and Neon database as the web
app, plus desktop-only powers — local ROM folder scanning, emulator launching,
and the **encrypted admin key vault**.

## Requirements

- Node.js 20+
- Windows 10/11 (builds also run on macOS/Linux with `--mac`/`--linux`)

## Run in development

```bash
# from the repository root
npm install
npm run build -w @cabinet/core       # dual ESM/CJS build of the shared core

cd apps/desktop
CABINET_APP_URL=http://localhost:3000 npm start
```

`CABINET_APP_URL` points the shell at your local web app; it defaults to the
production deployment.

## Build the installer

```bash
cd apps/desktop
npm run dist
# → release/Cabinet-Setup-0.1.0.exe
```

Notes:

- Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` during `npm install` in CI environments
  that don't need to launch Electron.
- For direct downloads, sign the installer with a Windows code-signing
  certificate (Authenticode) so SmartScreen shows a known publisher.

## The key vault

Menu → **Cabinet → Key Vault…** (Ctrl+Shift+K) opens the vault window:

1. **Generate** a strong admin key-password (or paste your own).
2. **Encrypt into vault** — scrypt-derives a key from your master passphrase and
   seals the admin key with AES-256-GCM into a `.cabinet` file.
3. **Open vault** — converts it back to readable text in memory, on demand.

The same vault format is produced by the CLI at `tools/keyvault`, so you can
seal on your desktop and reveal on a server (or vice versa).

Menu → **Cabinet → Admin Dashboard…** (Ctrl+Shift+A) prompts for the key and
opens the admin dashboard only when the server confirms it.
