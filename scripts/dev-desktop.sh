#!/usr/bin/env bash
# Starts the ProjectFlow desktop app (Electron, desktop/) fully local and already signed in:
#   1. scripts/dev-e2e.sh — Firebase emulators + seeded demo workspace + Vite auto-signed-in as demo owner,
#   2. the Electron shell pointed at that Vite server (PF_DESKTOP_URL), with a fresh profile per run.
# Nothing here talks to production (project id demo-projectflow).
#
#   bash scripts/dev-desktop.sh                       # signed in as demo@projectflow.test
#   E2E_LOGIN=outsider bash scripts/dev-desktop.sh    # signed in as the outsider (no workspace)
#   E2E_FUNCTIONS=0 bash scripts/dev-desktop.sh       # skip the Functions emulator (faster start)
#   DESKTOP_REUSE=1 PORT=3000 bash scripts/dev-desktop.sh   # attach to an already running web-e2e server
#   DESKTOP_KEEP_PROFILE=1 bash scripts/dev-desktop.sh      # reuse the dev profile (window state etc.)
#
# The Electron renderer exposes Chrome DevTools Protocol on DEBUG_PORT (default 9333) for
# Playwright/browser tooling: chromium.connectOverCDP('http://127.0.0.1:9333').
# MAIN_INSPECT_PORT=9339 additionally opens the Node inspector of the main process (shell debugging).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="$ROOT/desktop"
DEBUG_PORT="${DEBUG_PORT:-9333}"
WEB_PID=""
PROFILE_DIR=""

port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN > /dev/null 2>&1; }

cleanup() {
    if [[ -n "$WEB_PID" ]]; then
        # dev-e2e.sh runs in its own process group (emulators + Java + Vite): stop all of it.
        kill -INT -- "-$WEB_PID" 2>/dev/null || true
        sleep 2
        kill -TERM -- "-$WEB_PID" 2>/dev/null || true
    fi
    if [[ -n "$PROFILE_DIR" && "${DESKTOP_KEEP_PROFILE:-0}" != "1" ]]; then
        rm -rf "$PROFILE_DIR"
    fi
}
trap cleanup EXIT INT TERM

if [[ "${DESKTOP_REUSE:-0}" == "1" ]]; then
    PORT="${PORT:-3000}"
    curl -sf "http://localhost:$PORT" > /dev/null || { echo "No dev server on http://localhost:$PORT (start web-e2e first)."; exit 1; }
else
    # dev-e2e.sh starts Vite with --strictPort: pick the first free app port.
    PORT="${PORT:-3000}"
    while port_in_use "$PORT"; do PORT=$((PORT + 1)); done
    for emulator_port in "${AUTH_PORT:-9631}" "${FIRESTORE_PORT:-8631}" "${STORAGE_PORT:-9632}" "${FUNCTIONS_PORT:-5631}"; do
        if port_in_use "$emulator_port"; then
            echo "Emulator port $emulator_port is busy (another dev-e2e.sh running?)."
            echo "Attach to it with DESKTOP_REUSE=1 PORT=<its app port>, or set AUTH_PORT/FIRESTORE_PORT/STORAGE_PORT/FUNCTIONS_PORT."
            exit 1
        fi
    done

    echo "Starting emulators + signed-in web app on :$PORT (log: .desktop-web.log)..."
    set -m  # own process group, so cleanup can stop emulators and Vite together
    PORT="$PORT" bash "$ROOT/scripts/dev-e2e.sh" > "$ROOT/.desktop-web.log" 2>&1 &
    WEB_PID=$!
    set +m

    for _ in $(seq 1 240); do
        if curl -sf "http://localhost:$PORT" > /dev/null; then break; fi
        kill -0 "$WEB_PID" 2>/dev/null || { tail -n 40 "$ROOT/.desktop-web.log"; exit 1; }
        sleep 1
    done
    curl -sf "http://localhost:$PORT" > /dev/null || { echo "Web app did not come up."; tail -n 40 "$ROOT/.desktop-web.log"; exit 1; }
fi

if [[ ! -d "$DESKTOP/node_modules" ]]; then
    echo "Installing desktop dependencies..."
    npm --prefix "$DESKTOP" install --silent
fi
npm --prefix "$DESKTOP" run build --silent

# Fresh profile per run: the Auth emulator is wiped on every start, a persisted IndexedDB user would
# skip the auto-login (`if (auth.currentUser) return`) and hold invalid tokens.
if [[ "${DESKTOP_KEEP_PROFILE:-0}" == "1" ]]; then
    PROFILE_DIR="${TMPDIR:-/tmp}/projectflow-desktop-dev-profile"
    mkdir -p "$PROFILE_DIR"
else
    PROFILE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/projectflow-desktop.XXXXXX")"
fi

echo "Desktop app → http://localhost:$PORT (CDP on 127.0.0.1:$DEBUG_PORT)"
cd "$DESKTOP"
PF_DESKTOP_URL="http://localhost:$PORT" PF_DESKTOP_USER_DATA="$PROFILE_DIR" \
    "$DESKTOP/node_modules/.bin/electron" . --remote-debugging-port="$DEBUG_PORT" ${MAIN_INSPECT_PORT:+--inspect="$MAIN_INSPECT_PORT"} &
ELECTRON_PID=$!

# If the web stack dies underneath (e.g. another session kills emulators/Vite), the app would keep running
# with failing requests and chunk loads. Quit it with a clear message instead.
while kill -0 "$ELECTRON_PID" 2>/dev/null; do
    if [[ -n "$WEB_PID" ]] && ! kill -0 "$WEB_PID" 2>/dev/null; then
        echo "Web stack (emulators + Vite) stopped unexpectedly — see .desktop-web.log / .firebase-e2e.log. Quitting the desktop app."
        kill -TERM "$ELECTRON_PID" 2>/dev/null || true
        break
    fi
    if ! curl -s -o /dev/null --max-time 5 "http://localhost:$PORT"; then
        echo "Dev server on :$PORT is gone. Quitting the desktop app."
        kill -TERM "$ELECTRON_PID" 2>/dev/null || true
        break
    fi
    sleep 5
done
wait "$ELECTRON_PID" 2>/dev/null || true
