# Cabinet TV — Samsung Tizen package

Gamepad-first TV Mode for Samsung Smart TVs (2016+, Tizen 3.0+). The widget
boots straight into the deployed `https://<your-deployment>/tv` page, which is
same-origin with the Cabinet API — so accounts, favourites and the admin gate
all work exactly like on the web.

## Contents

```
config.xml   Tizen TV manifest (tv profile, internet privilege, allow-navigation)
index.html   local fallback that redirects to the deployed TV Mode
icon.png     512×512 launcher icon
build.mjs    builds the .wgt (plain ZIP with the required layout)
```

## Build

```bash
node apps/tizen/build.mjs --url https://your-deployment.vercel.app/tv
# → apps/tizen/release/Cabinet-TV-0.1.0.wgt   (unsigned)
```

## Sign (required — one-time setup)

Samsung TVs require a signed `.wgt` even in Developer Mode. Signing needs
**Tizen Studio** (CLI tools) and a free **Samsung account**:

1. Install Tizen Studio → *Package Manager* → install **Samsung TV Extension**
   and **Certificate Manager**.
2. *Tools → Certificate Manager → Samsung → TV*, create a certificate profile
   (sign in with your Samsung account; add your TV's device ID via
   *Device Manager* or by connecting with `sdb` first).
3. Sign the package:

```bash
tizen package -t wgt -s <your-cert-profile> -- apps/tizen/release/stage
# → produces a signed .wgt next to the project
```

## Install on the TV

1. TV: *Apps →* type **12345** on the remote → enable **Developer Mode**, enter
   your PC's IP, restart the TV.
2. PC (same network):

```bash
sdb connect <TV-IP>
sdb devices
sdb install Cabinet-TV-0.1.0.wgt
```

3. Launch **Cabinet TV** from the TV's app list. Pair up to two Bluetooth/USB
   controllers — TV Mode reads `navigator.getGamepads()` (supported on Samsung
   TVs since 2016; no extra privilege needed).

## Alternative (no packaging at all)

The TV's built-in web browser can open `https://<your-deployment>/tv` directly.
Same UI, same controllers, minus the home-screen launcher icon.
