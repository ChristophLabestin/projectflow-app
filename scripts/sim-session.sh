#!/usr/bin/env bash
# Per-session iOS simulators as APFS copy-on-write clones of one golden device.
# A fresh clone costs ~0 MB on disk; the iOS runtime is shared by all devices.
#
#   scripts/sim-session.sh golden [app_path]  create/refresh "ProjectFlow Golden" (app installed, shut down)
#   scripts/sim-session.sh create <name>      clone golden to "PF-<name>", boot it, print its UDID
#   scripts/sim-session.sh delete <name>      shut down and delete "PF-<name>"
#   scripts/sim-session.sh list               list golden and all PF-* clones
#   scripts/sim-session.sh prune              delete every PF-* clone that is shut down
#
# Builds: -destination "id=<UDID>" (or generic/platform=iOS Simulator), install with
# xcrun simctl install <UDID> <app>. At most PF_SIM_MAX (default 3) clones run at once.
set -euo pipefail

GOLDEN="ProjectFlow Golden"
DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro"
RUNTIME="com.apple.CoreSimulator.SimRuntime.iOS-27-0"
MAX="${PF_SIM_MAX:-3}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_APP="$ROOT/.xcodebuild/Build/Products/Debug-iphonesimulator/ProjectFlow.app"

udid_of() {
    xcrun simctl list devices | grep -F "    $1 (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' || true
}

booted_clones() {
    xcrun simctl list devices | grep -cE '^    PF-.*\(Booted\)' || true
}

cmd="${1:-}"
case "$cmd" in
    golden)
        app="${2:-$DEFAULT_APP}"
        [ -d "$app" ] || { echo "App not found: $app (build first)" >&2; exit 1; }
        id="$(udid_of "$GOLDEN")"
        [ -n "$id" ] || id="$(xcrun simctl create "$GOLDEN" "$DEVICE_TYPE" "$RUNTIME")"
        xcrun simctl boot "$id" 2>/dev/null || true
        xcrun simctl bootstatus "$id" >/dev/null
        xcrun simctl install "$id" "$app"
        xcrun simctl shutdown "$id"
        echo "$id"
        ;;
    create)
        name="${2:?name required}"
        golden="$(udid_of "$GOLDEN")"
        [ -n "$golden" ] || { echo "No golden device; run: $0 golden" >&2; exit 1; }
        existing="$(udid_of "PF-$name")"
        if [ -z "$existing" ]; then
            until [ "$(booted_clones)" -lt "$MAX" ]; do
                echo "Waiting: $MAX PF-* simulators already running" >&2
                sleep 20
            done
            existing="$(xcrun simctl clone "$golden" "PF-$name")"
        fi
        xcrun simctl boot "$existing" 2>/dev/null || true
        xcrun simctl bootstatus "$existing" >/dev/null
        echo "$existing"
        ;;
    delete)
        id="$(udid_of "PF-${2:?name required}")"
        [ -n "$id" ] || exit 0
        xcrun simctl shutdown "$id" 2>/dev/null || true
        xcrun simctl delete "$id"
        ;;
    list)
        xcrun simctl list devices | grep -E "^    ($GOLDEN|PF-)" || true
        ;;
    prune)
        xcrun simctl list devices | grep -E '^    PF-.*\(Shutdown\)' \
            | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' | while read -r id; do xcrun simctl delete "$id"; done
        ;;
    *)
        sed -n '2,12p' "$0"
        exit 1
        ;;
esac
