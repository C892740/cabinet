#!/usr/bin/env bash
# Build the Cabinet iOS app into an .ipa — run this on a Mac with Xcode 15+.
# (iOS apps cannot be compiled on Linux; see README.md.)
#
# Usage:
#   ./build-ipa.sh                # development-signed .ipa for your devices
#   METHOD=app-store ./build-ipa.sh   # App Store / TestFlight export
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required: brew install xcodegen" >&2
  exit 1
fi

echo "== generating Xcode project =="
xcodegen generate

METHOD="${METHOD:-development}"
EXPORT="build/ExportOptions.plist"
cp ExportOptions.plist "$EXPORT"
if [ "$METHOD" != "development" ]; then
  /usr/libexec/PlistBuddy -c "Set :method $METHOD" "$EXPORT"
fi

echo "== archiving (this runs the CabinetCore unit tests first) =="
swift test --package-path CabinetCore

echo "== archiving =="
xcodebuild \
  -project Cabinet.xcodeproj \
  -scheme CabinetApp \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/Cabinet.xcarchive \
  archive

echo "== exporting .ipa =="
xcodebuild \
  -exportArchive \
  -archivePath build/Cabinet.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist "$EXPORT"

echo "== done =="
ls -la build/ipa/
echo "Install the .ipa with Xcode (Devices window), TestFlight, or Finder."
