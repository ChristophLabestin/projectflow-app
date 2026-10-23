#!/usr/bin/env bash
# Pre-deploy smoke test for the web app: builds the production bundle (emulator mode), serves it with
# `vite preview` against freshly seeded emulators and runs web/e2e/smoke.spec.ts (main routes render without
# console errors, error boundary or stuck loader). Exit code != 0 on any failure.
#
#   bash scripts/predeploy-smoke.sh            # before every `firebase deploy --only hosting`
#
# Rule: build → predeploy-smoke → deploy. Uses its own ports so it can run next to other sessions:
#   SMOKE_PORT=4291 SMOKE_AUTH_PORT=9871 SMOKE_FIRESTORE_PORT=8871 SMOKE_STORAGE_PORT=9873 SMOKE_FUNCTIONS_PORT=5871
#   (emulator hub/logging = auth + 10 / + 11). Set SMOKE_FUNCTIONS=0 to skip the Functions emulator.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SMOKE_PORT:-4291}"
AUTH_PORT="${SMOKE_AUTH_PORT:-9871}"
FIRESTORE_PORT="${SMOKE_FIRESTORE_PORT:-8871}"
STORAGE_PORT="${SMOKE_STORAGE_PORT:-9873}"
FUNCTIONS_PORT="${SMOKE_FUNCTIONS_PORT:-5871}"
LOG="$ROOT/.predeploy-smoke.log"
START=$(date +%s)

for port in "$PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$STORAGE_PORT" "$FUNCTIONS_PORT" $((AUTH_PORT + 10)) $((AUTH_PORT + 11)); do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1; then
        echo "predeploy-smoke: port $port is in use — set SMOKE_*_PORT to free ports." >&2
        exit 2
    fi
done

# Kills a process and all of its descendants (emulators, vite preview).
kill_tree() {
    local pid=$1 child
    for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
    kill -TERM "$pid" 2>/dev/null || true
}

echo "predeploy-smoke: building + starting emulators (log: .predeploy-smoke.log)..."
(
    cd "$ROOT"
    E2E_WEB=preview E2E_LOGIN=none E2E_FUNCTIONS="${SMOKE_FUNCTIONS:-1}" E2E_DIST="${TMPDIR:-/tmp}/pf-smoke-dist" \
    PORT="$PORT" AUTH_PORT="$AUTH_PORT" FIRESTORE_PORT="$FIRESTORE_PORT" STORAGE_PORT="$STORAGE_PORT" FUNCTIONS_PORT="$FUNCTIONS_PORT" \
        bash scripts/dev-e2e.sh
) > "$LOG" 2>&1 &
SERVER_PID=$!
cleanup() {
    kill_tree "$SERVER_PID"
    wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 240); do
    if curl -sf -o /dev/null "http://localhost:$PORT"; then break; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "predeploy-smoke: server failed to start:" >&2
        tail -n 40 "$LOG" >&2
        exit 1
    fi
    sleep 1
done
curl -sf -o /dev/null "http://localhost:$PORT" || { echo "predeploy-smoke: server not reachable" >&2; tail -n 40 "$LOG" >&2; exit 1; }
READY=$(date +%s)
echo "predeploy-smoke: app ready after $((READY - START)) s, running smoke test..."

# Prefer the system Chrome locally (no Playwright browser download); CI sets SMOKE_CHANNEL= and installs Chromium.
if [[ -z "${SMOKE_CHANNEL+x}" && -d "/Applications/Google Chrome.app" ]]; then export SMOKE_CHANNEL=chrome; fi

set +e
(cd "$ROOT/web" && PLAYWRIGHT_BASE_URL="http://localhost:$PORT" npx playwright test e2e/smoke.spec.ts --reporter=line)
RESULT=$?
set -e

END=$(date +%s)
if [[ $RESULT -eq 0 ]]; then
    echo "predeploy-smoke: PASSED (tests $((END - READY)) s, total $((END - START)) s)"
else
    echo "predeploy-smoke: FAILED — do not deploy (tests $((END - READY)) s, total $((END - START)) s)" >&2
fi
exit $RESULT
