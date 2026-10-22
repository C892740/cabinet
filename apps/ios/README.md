# Cabinet for iOS

The iPhone/iPad companion for Cabinet: the full web app in a WKWebView, plus
the **Link TV** screen (Smart View-style phone ↔ TV linking) and **ROMs**
(folder scan + auto-import into your library while the TV link verifies the
phone is on the same Wi-Fi).

## First, a correction: `.pak` is not an iOS thing

There is no iOS app package called `.pak` — that extension belongs to Unreal
Engine game-content archives. iOS apps are distributed as **`.ipa`** files,
and this project produces one via `./build-ipa.sh` on a Mac.

## Why this folder has no compiled app yet

iOS apps can only be compiled and signed with **Xcode on macOS** (Apple does
not ship an iOS toolchain for Linux; the one community exception, `xtool`,
only handles SwiftPM projects and is not App Store viable). Everything that
*can* be prepared on Linux is prepared here: the full Swift source, the
project spec, the build script, and the shared logic package `CabinetCore`,
whose unit tests run anywhere (including on Linux — `swift test`).

## Build the .ipa (on a Mac)

1. Install Xcode 15+ (`mas install 497799835`) and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).
2. Sign in to Xcode with your Apple ID (Xcode → Settings → Accounts).
3. Run:

```bash
cd apps/ios
./build-ipa.sh
```

4. The app lands at `build/ipa/Cabinet.ipa`.

### Installing on your iPhone

- **Free Apple ID (Personal Team):** open `Cabinet.xcodeproj`, set your team
  under Signing & Capabilities, then run on your device from Xcode — or install
  the .ipa via Finder/Xcode Devices. Free provisioning expires after **7 days**;
  rebuild and reinstall to renew ([Apple docs](https://developer.apple.com/help/account/about-your-developer-account)).
- **Paid Developer Program + TestFlight:** `METHOD=app-store ./build-ipa.sh`,
  upload with Transporter, invite yourself in TestFlight (builds live 90 days).
- **Sideloaders** (AltStore/Sideloadly): also 7-day expiry on free accounts,
  and they still require your Apple ID — nothing here bypasses signing.

### Pairing with the TV

1. On the TV, open Cabinet → **Link a phone** → a 6-digit code appears.
2. On the phone: **Link TV** tab → enter the code → approve on the TV.
3. The server verifies the "same Wi-Fi" link by comparing both devices'
   egress IPs (same router/NAT); while that verdict holds and the TV is
   active, ROMs found in your chosen folder are auto-imported into the
   shared library and show up on the TV.

## Testing

```bash
swift test --package-path CabinetCore   # shared logic — runs on Linux/macOS
```

The UI layer (WKWebView, document picker, URLSession uploads) needs a device
or simulator build on a Mac — it is not compiled or covered by tests on Linux.
