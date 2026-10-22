#!/usr/bin/env bash
# Headless Android toolchain installer (no root, no Android Studio).
# Installs into $HOME/toolchains + $HOME/android-sdk. Idempotent-ish: re-run skips done parts.
set -euo pipefail

TOOLS="$HOME/toolchains"
SDK="$HOME/android-sdk"
mkdir -p "$TOOLS" "$SDK/cmdline-tools"

# ── 1. JDK 17 (Temurin, AGP 8.x requires 17) ────────────────────────────────
if [ ! -x "$TOOLS/jdk17/bin/java" ]; then
  echo "== downloading JDK 17 =="
  curl -fL --retry 3 -o "$TOOLS/jdk17.tar.gz" \
    "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  mkdir -p "$TOOLS/jdk17"
  tar xzf "$TOOLS/jdk17.tar.gz" -C "$TOOLS/jdk17" --strip-components=1
fi
export JAVA_HOME="$TOOLS/jdk17"
export PATH="$JAVA_HOME/bin:$PATH"
echo "== java: $(java -version 2>&1 | head -1) =="

# ── 2. Android cmdline-tools ────────────────────────────────────────────────
if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "== downloading Android cmdline-tools =="
  for URL in \
    "https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"; do
    if curl -fL --retry 3 -o "$TOOLS/cmdline-tools.zip" "$URL"; then
      echo "   got $URL"
      break
    fi
  done
  rm -rf "$TOOLS/ct-unpack"
  unzip -q "$TOOLS/cmdline-tools.zip" -d "$TOOLS/ct-unpack"
  mv "$TOOLS/ct-unpack/cmdline-tools" "$SDK/cmdline-tools/latest"
fi

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"

echo "== accepting SDK licenses =="
set +o pipefail
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses > /tmp/sdk-licenses.log 2>&1
set -o pipefail

echo "== installing SDK packages =="
"$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" \
  "platform-tools" "platforms;android-36" "build-tools;35.0.0"
"$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --list_installed

# ── 3. Gradle 8.13 (AGP 8.13 pairing) ──────────────────────────────────────
if [ ! -x "$TOOLS/gradle-8.13/bin/gradle" ]; then
  echo "== downloading Gradle 8.13 =="
  curl -fL --retry 3 -o "$TOOLS/gradle.zip" \
    "https://services.gradle.org/distributions/gradle-8.13-bin.zip"
  unzip -q "$TOOLS/gradle.zip" -d "$TOOLS"
fi
"$TOOLS/gradle-8.13/bin/gradle" --version | head -8

echo "== ANDROID TOOLCHAIN READY =="
