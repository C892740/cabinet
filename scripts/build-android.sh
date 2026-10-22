#!/usr/bin/env bash
# Build + test the Cabinet Android app headlessly (no Android Studio).
# Expects the toolchain from scripts/setup-android-toolchain.sh in $HOME.
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-$HOME/toolchains/jdk17}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$HOME/toolchains/gradle-8.13/bin:$PATH"

cd "$(dirname "$0")/../apps/android"

if [ ! -f gradlew ]; then
  echo "== generating Gradle wrapper =="
  gradle wrapper --gradle-version 8.13 --distribution-type bin --no-daemon
fi

echo "== running JVM unit tests =="
./gradlew --no-daemon test

echo "== assembling APKs =="
./gradlew --no-daemon assembleDebug assembleRelease

echo "== outputs =="
ls -la app/build/outputs/apk/debug/ app/build/outputs/apk/release/
echo "== ANDROID BUILD DONE =="
