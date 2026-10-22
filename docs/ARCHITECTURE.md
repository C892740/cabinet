# Cabinet — Architecture & Technology Choices

Cabinet is a modern take on a self-hosted retro game library (think: the problem
RomM solves), with three first-class surfaces:

| Surface | What it is | Stack |
| --- | --- | --- |
| **Web app** | Library, collections, TV mode, admin dashboard | Next.js 14 (App Router), Tailwind, framer-motion → deployed on **Vercel** |
| **Database** | Users, sessions, platforms, ROMs, collections | **Neon Postgres** via Drizzle ORM (serverless HTTP driver) |
| **Desktop** | Windows `.exe` with local ROM scanning, emulator launching, encrypted key vault | **Electron** + TypeScript, sharing `@cabinet/core` |

Everything is one **TypeScript monorepo** (`npm` workspaces):

```
apps/
  web/        Next.js app (Vercel)
  desktop/    Electron shell (Windows .exe)
packages/
  core/       shared types + key vault crypto (dual ESM/CJS build)
  db/         Drizzle schema + Neon client
tools/
  keyvault/   CLI: generate / seal / reveal the admin key
```

---

## 1. Language choice: TypeScript vs Python

RomM is Python (FastAPI) + TypeScript (Vue). For *this* product the answer is
**TypeScript everywhere**. Honest comparison:

### TypeScript (chosen)

**Pros**
- **One language across web, desktop and tooling.** The desktop app, the CLI and
  the web app share the key-vault crypto and domain types as real packages —
  no duplicated logic across a Python/JS boundary.
- **First-class Vercel story.** Vercel is a Node/edge platform; Next.js is its
  native framework. A Python backend on Vercel is possible (serverless
  functions) but second-class: cold starts, limited runtimes, awkward streaming
  and no shared server code with the frontend.
- **The desktop app needs a JS runtime anyway.** A `.exe` shell (Electron/Tauri)
  speaks JavaScript; if the backend were Python you would still write a large
  amount of TS and maintain two type systems for one domain model.
- **Type safety end-to-end.** `Rom`, `Platform`, `User` are declared once in
  `packages/core` and checked at compile time in all three surfaces.
- **EmulatorJS / WebAssembly integration** for future in-browser play is a web
  technology; keeping the stack web-native makes it a feature, not a port.

**Cons**
- CPU-heavy scanning/hashing is slower than Python with native libraries —
  mitigated by doing it in the Electron main process (or a worker) where it
  doesn't block the UI.
- Node's async model has its own footguns (callback leaks, unhandled
  rejections); strict TS + small modules keeps this manageable.

### Python (not chosen, but viable)

**Pros**
- Excellent for **file scanning, hashing and metadata scraping** (the "boring
  bulk" of a ROM manager): mature libs, fast iteration, easy scripting.
- Great ML/scraper ecosystem if metadata matching ever needs it.
- FastAPI + SQLAlchemy is proven at RomM's scale.

**Cons**
- **Two languages, two type systems, two deploy pipelines** for one product —
  the biggest cost for a solo developer.
- **Vercel is not a natural Python host**; you would need a second backend host
  (Fly.io/Railway/Render) alongside Vercel for the frontend, plus CORS, auth
  and session coordination across origins.
- The desktop `.exe` still requires TS/Electron, so you never escape JS.

**Verdict:** Python only starts to win if the product becomes primarily a
heavy-duty server-side scanner/scraper with a thin UI. Cabinet's centre of
gravity is the UI/UX and the desktop/TV surfaces → TypeScript.

> If you later want Python for a specific job (e.g. a metadata pipeline), the
> clean seam is an internal HTTP/queue worker — not a second application
> server.

---

## 2. Desktop shell: Electron vs Tauri vs WPF

| | Electron (chosen) | Tauri | WPF |
| --- | --- | --- | --- |
| UI code reuse with Next.js/React | **Best** — same components & types | Good (static export only; no Next server features) | None (C#/XAML) |
| Local ROM files + launching emulators | **Best** (Node `fs`, `child_process`) | Good (Rust plugins, capability system) | Excellent (native) |
| Installer size | ~100 MB+ | 3–15 MB (system WebView2) | Small–medium |
| Updater / signing ecosystem | Mature (electron-builder, Squirrel) | Built-in updater (signed artifacts required) | ClickOnce/MSIX |
| Effort for a TS solo dev | **Lowest** | Medium (Rust boundary) | High (new language) |

**Chosen: Electron**, because the core desktop-only features (scan local
folders, launch emulator executables, host a native key-vault window) are
trivial in Node and the UI stays one codebase with the web app. If installer
size becomes a product problem, the migration path to **Tauri** is realistic:
keep the React UI static/client-rendered and move the same IPC surface to Rust
commands.

---

## 3. Data & security decisions (and the trade-offs we improved)

| Decision | Trade-off | How Cabinet handles it |
| --- | --- | --- |
| **Neon serverless (HTTP) driver** | Great for short-lived Vercel functions; no interactive transactions | Used for all app queries; migrations use the *unpooled* URL (`DATABASE_URL_UNPOOLED`) |
| **Connection pooling** | PgBouncer transaction pooling strips session state | Runtime uses the pooled `-pooler` URL; nothing in the schema relies on `SET`/`LISTEN` |
| **Demo mode** (`DATABASE_URL` unset) | A demo dataset vs. "real" DB behavior | Same `Repo` interface, two implementations — zero-setup exploration without weakening the real path |
| **Password storage** | Speed vs. resistance to cracking | scrypt (N=2¹⁵, r=8, p=1), per-user salt; never reversible |
| **Session tokens** | Stateless (easy) vs. revocable (safe) | **Opaque random tokens, stored hashed** — revocable per session, leak-safe |
| **Admin key** | Convenience vs. exposure | `ADMIN_KEY_HASH` (scrypt digest) preferred; the key itself can live only in the **encrypted vault** |
| **Admin key at rest** | A readable password in config is convenient and dangerous | AES-256-GCM vault with authenticated header + scrypt master passphrase (desktop window + CLI) |
| **CSRF** | Cookie auth is XSS/CSRF-sensitive | `SameSite=Lax`, `HttpOnly`, `Secure` in prod + `Origin` checks on mutations + rate limits on auth endpoints |
| **Cover art** | Real artwork looks great but isn't ours to ship | Deterministic generated art from platform palettes + title typography — original by construction |
| **In-browser emulation** | Huge win for UX; WASM cores are heavy | Shipped: EmulatorJS (WASM) in an isolated same-origin frame (`/play/frame`), ROM bytes passed as blob URLs; heavier cores (N64, PSX, DS) flagged beta |
| **TV input** | TV browsers may not expose gamepads | Standard Gamepad API + focus navigation; Tizen packaging is the reliable path (see `docs/TV-PLAY.md`) |

---

## 4. Scaling notes (future you)

1. **Scanning/matching** — shipped as client-side hashing + a serial server-side
   matcher (`lib/metadata`); the next step is a background job queue (Redis/BullMQ
   or a Vercel cron + queue) with WebSocket progress for very large libraries.
2. **Metadata providers** (IGDB, ScreenScraper…) — shipped in `apps/web/src/lib/metadata`
   behind a shared match pipeline; more providers (SteamGridDB, RetroAchievements
   covers) slot into the same shape.
3. **File storage** — ROMs stay on user disks (desktop) or R2/S3-compatible
   object storage (web streaming); the DB stores metadata + hashes only.
4. **Multi-tenant / friends** — `users`, `collections` and `sessions` already
   support ownership; add a `shares` table for friend libraries.
5. **Emulator cores** — shipped: EmulatorJS (WASM) in the browser with cloud
   save states and netplay; desktop emulator profiles launch local emulators
   through the `emulator:launch` IPC.
