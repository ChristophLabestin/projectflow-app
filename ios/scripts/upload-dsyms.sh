#!/bin/bash
# Uploads the dSYMs of a ProjectFlow release build to Labestin Sentinel so crash stacks get symbolicated.
# Runs as the scheme's archive post-action (Xcode and `xcodebuild archive`), or by hand:
#   ios/scripts/upload-dsyms.sh <dSYM folder or .xcarchive/dSYMs> <release = MARKETING_VERSION>
#
# Needs SENTINEL_DSN (defaults to the PF_SENTINEL_DSN build setting) and SENTINEL_SECRET_KEY (sk_…, never in git).
# Both may live in ~/.config/projectflow/sentinel.env (or SENTINEL_ENV_FILE), since Xcode does not pass the shell env.
# Without a key or DSN the upload is skipped, not failed. SENTINEL_CLI points at sentinel.mjs (labestin-digital monorepo).
set -uo pipefail

DSYMS="${1:-}"; RELEASE="${2:-}"
LOG_DIR="$HOME/Library/Logs/ProjectFlow"; mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/dsym-upload.log") 2>&1
echo "== $(date '+%Y-%m-%d %H:%M:%S') dSYM upload release=$RELEASE path=$DSYMS"

ENV_FILE="${SENTINEL_ENV_FILE:-$HOME/.config/projectflow/sentinel.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set +a
SENTINEL_DSN="${SENTINEL_DSN:-${PF_SENTINEL_DSN:-}}"
SENTINEL_CLI="${SENTINEL_CLI:-$HOME/Documents/LabestinDigital/02_Projects/labestin-digital/sdks/sentinel-cli/bin/sentinel.mjs}"

[ -n "$DSYMS" ] && [ -d "$DSYMS" ] || { echo "skip: no dSYM folder"; exit 0; }
[ -n "$RELEASE" ] || { echo "skip: no release"; exit 0; }
[ -n "$SENTINEL_DSN" ] || { echo "skip: SENTINEL_DSN / PF_SENTINEL_DSN not set"; exit 0; }
[[ "${SENTINEL_SECRET_KEY:-}" == sk_* ]] || { echo "skip: SENTINEL_SECRET_KEY not set"; exit 0; }
[ -f "$SENTINEL_CLI" ] || { echo "skip: Sentinel CLI not found at $SENTINEL_CLI"; exit 0; }
NODE="$(command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -n1)"
[ -n "$NODE" ] || { echo "skip: node not found"; exit 0; }

SENTINEL_DSN="$SENTINEL_DSN" SENTINEL_SECRET_KEY="$SENTINEL_SECRET_KEY" \
    "$NODE" "$SENTINEL_CLI" dsym upload "$DSYMS" --release "$RELEASE"
