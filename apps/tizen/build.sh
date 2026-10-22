#!/usr/bin/env bash
# Build, package and (optionally) install the Cabinet Samsung TV app.
#
# Requirements: Tizen Studio CLI (or the VS Code Tizen extension's CLI) with
# the TV extension, and a Samsung certificate profile for signing.
#
# Usage:
#   ./build.sh                    # build + package (cabinet.wgt)
#   TV_IP=192.168.1.50 ./build.sh install   # build, package, install + run
set -euo pipefail
cd "$(dirname "$0")"

PROFILE="${TIZEN_PROFILE:-SamsungProfile}"
APP_ID="CabinetTv1.cabinet"
OUT=".buildResult"

case "${1:-package}" in
  build)
    tizen build-web -- .
    ;;
  package)
    tizen build-web -- .
    tizen package --type wgt --sign "$PROFILE" -- "$OUT"
    echo "Package: $OUT/Cabinet.wgt (signed with $PROFILE)"
    ;;
  install)
    if [ -z "${TV_IP:-}" ]; then
      echo "TV_IP=<your tv's ip> $0 install" >&2
      exit 1
    fi
    tizen build-web -- .
    tizen package --type wgt --sign "$PROFILE" -- "$OUT"
    sdb connect "$TV_IP:26101"
    tizen install -n "$OUT/Cabinet.wgt" -t "$TV_IP:26101"
    tizen run -p "$APP_ID" -t "$TV_IP:26101"
    ;;
  *)
    echo "usage: $0 [build|package|install]" >&2
    exit 1
    ;;
esac
