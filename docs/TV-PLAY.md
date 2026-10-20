# Playing on PC and TV (Samsung) with two controllers

The end goal: **you and a friend play your library on the TV, one controller
each.** Research findings (Samsung developer docs, Moonlight, MDN) plus the
options, ranked by reliability.

## TL;DR recommendation

1. **Most reliable today:** run the game on the **PC**, plug both controllers
   into the PC, and connect the PC to the TV (HDMI or wireless display).
   Cabinet Desktop launches the emulator; the TV is just a display.
2. **Best wireless experience:** **Sunshine** on the PC + **Moonlight for
   Tizen** on the Samsung TV (community client, Tizen 5.5+ / ~2020+ models),
   with controllers paired to the TV.
3. **Cabinet's own path:** **TV Mode** — a controller-first web UI (already in
   the app at `/tv`) that can later be packaged as a **Tizen web app**.

## Why TV Mode is the strategic bet

Samsung documents gamepad input for Tizen TV apps:
`navigator.getGamepads()`, up to **four** controllers, supported on TVs since
2016. Two controllers is comfortably within spec.

| Path | Pros | Cons |
| --- | --- | --- |
| **A. PC + HDMI** | Zero latency, full emulator compatibility, simplest | Cable to the couch |
| **B. Moonlight Tizen + Sunshine** | Wireless, controllers on the TV, free/open source | Community client (maintenance risk), model/firmware quirks, needs decent Wi-Fi |
| **C. TV Mode web app in TV browser** | No install, instant updates | Gamepad access in the *built-in browser* is unverified per model |
| **D. Tizen web app (packaged TV Mode)** | Proper TV app, documented gamepad support, store distribution possible | Tizen Studio + certificates + Seller Office review |

**Cabinet ships C now, and D next:** TV Mode is a normal web route (`/tv`) with
large tiles, focus rings and a Gamepad API navigation layer — so the same UI
can be wrapped in a Tizen package without a rewrite.

## What TV Mode already does

- Large 10-foot tiles with focus rings (`data-tv-focusable` focus management)
- **Gamepad API** navigation: d-pad/left stick moves focus, **A** selects,
  **B** goes back, up to four controllers tracked live in the header
- Keyboard fallback (arrow keys/Enter via native focus) for browsers without
  gamepad access

## Before building further: run these two hardware tests

1. **Gamepad tester in the TV browser** — open a small
   `navigator.getGamepads()` test page on the actual Samsung TV and confirm
   *both* controllers appear and report input. If the browser hides them,
   skip path C and go straight to D (Tizen packaging) or B (Moonlight).
2. **Moonlight trial** — install Moonlight Tizen (Tizen 5.5+) and stream the
   desktop for 30 minutes with both controllers. Judge latency and drops.

## Tizen packaging notes (path D)

- Dev flow: Tizen Studio → certificate profile → TV in **Developer Mode** →
  deploy the `TV Mode` bundle (HTML/CSS/JS + WASM).
- Public distribution: Samsung **Seller Office** submission.
- Testing caveat from Samsung: **the TV emulator does not support gamepads** —
  test on real hardware.

## Two-controller setup (works today)

1. Pair/attach two gamepads (USB or Bluetooth) to the PC (paths A/B) or the TV
   (path B/D).
2. Open Cabinet → **TV Mode** (or the emulator on PC).
3. Each player picks their controller; the header shows the connected count.

## Legal note

Cabinet streams/plays **your own dumps**. It ships no ROMs, no BIOS files and
no emulator cores; you are responsible for the dumps in your library.

### Sources

- Samsung — Gamepad guide: https://developer.samsung.com/smarttv/develop/guides/user-interaction/gamepad.html
- Samsung — Quick start / certificates / Seller Office:
  https://developer.samsung.com/smarttv/develop/getting-started/quick-start-guide.html
- Moonlight: https://moonlight-stream.org/ · Tizen client: https://github.com/brightcraft/moonlight-tizen
- MDN — Gamepad API: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
