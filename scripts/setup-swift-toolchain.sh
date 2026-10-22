#!/usr/bin/env bash
# Swift toolchain for Linux (used to compile/test the iOS app's shared core
# logic on this machine; the iOS app itself must be built on a Mac with Xcode).
set -euo pipefail

TOOLS="$HOME/toolchains"
mkdir -p "$TOOLS"

if [ -x "$TOOLS/swift/usr/bin/swift" ]; then
  "$TOOLS/swift/usr/bin/swift" --version | head -2
  echo "== SWIFT TOOLCHAIN READY (already installed) =="
  exit 0
fi

# Try current releases newest-first; first URL that exists wins.
for VER in 6.1.2 6.1 6.0.3; do
  TARBALL="swift-${VER}-RELEASE-ubuntu24.04.tar.gz"
  URL="https://download.swift.org/swift-${VER}-release/ubuntu2404/swift-${VER}-RELEASE/${TARBALL}"
  echo "== trying $URL =="
  if curl -fL --retry 2 -o "$TOOLS/swift.tar.gz" "$URL"; then
    echo "   got Swift $VER"
    break
  fi
done

if [ ! -s "$TOOLS/swift.tar.gz" ]; then
  echo "!! no Swift toolchain download succeeded" >&2
  exit 1
fi

mkdir -p "$TOOLS/swift-unpack"
tar xzf "$TOOLS/swift.tar.gz" -C "$TOOLS/swift-unpack" --strip-components=1
mv "$TOOLS/swift-unpack" "$TOOLS/swift"
"$TOOLS/swift/usr/bin/swift" --version | head -2
echo "== SWIFT TOOLCHAIN READY =="
