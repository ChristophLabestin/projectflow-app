#!/usr/bin/env bash
# E2E regression suite: core flows (tasks, files, wiki, flows, invites/seats, legal gate, workspace
# suspension, Free plan limits, security regressions) on the production build (emulator mode) served by
# `vite preview` against freshly seeded emulators with published legal docs (E2E_LEGAL=1).
# Specs: web/e2e/regression/*.spec.ts, config web/playwright.regression.config.ts. Exit code != 0 on failure.
#
#   bash scripts/e2e-regression.sh                 # full suite (~3-4 min incl. build)
#   bash scripts/e2e-regression.sh files wiki      # only specs matching these names
#   REGRESSION_WEB=dev bash scripts/e2e-regression.sh   # Vite dev server instead of the build (faster loop)
#
# Own ports so it runs next to other sessions and the smoke test:
#   REGRESSION_PORT=3151 REGRESSION_AUTH_PORT=9851 REGRESSION_FIRESTORE_PORT=8851 REGRESSION_STORAGE_PORT=9852
#   REGRESSION_FUNCTIONS_PORT=5851 (emulator hub/logging = auth + 10 / + 11).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${REGRESSION_PORT:-3151}"
AUTH_PORT="${REGRESSION_AUTH_PORT:-9851}"
FIRESTORE_PORT="${REGRESSION_FIRESTORE_PORT:-8851}"
STORAGE_PORT="${REGRESSION_STORAGE_PORT:-9852}"
FUNCTIONS_PORT="${REGRESSION_FUNCTIONS_PORT:-5851}"
LOG="$ROOT/.e2e-regression.log"
START=$(date +%s)

for port in "$PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$STORAGE_PORT" "$FUNCTIONS_PORT" $((AUTH_PORT + 10)) $((AUTH_PORT + 11)); do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1; then
        echo "e2e-regression: port $port is in use — set REGRESSION_*_PORT to free ports." >&2
        exit 2
    fi
done

# Kills a process and all of its descendants (emulators, vite preview).
kill_tree() {
    local pid=$1 child
    for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
    kill -TERM "$pid" 2>/dev/null || true
}

echo "e2e-regression: building + starting emulators (log: .e2e-regression.log)..."
(
    cd "$ROOT"
    E2E_WEB="${REGRESSION_WEB:-preview}" E2E_LOGIN=none E2E_FUNCTIONS=1 E2E_LEGAL=1 E2E_DIST="${TMPDIR:-/tmp}/pf-regression-dist" \
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
        echo "e2e-regression: server failed to start:" >&2
        tail -n 40 "$LOG" >&2
        exit 1
    fi
    sleep 1
done
curl -sf -o /dev/null "http://localhost:$PORT" || { echo "e2e-regression: server not reachable" >&2; tail -n 40 "$LOG" >&2; exit 1; }
READY=$(date +%s)
echo "e2e-regression: app ready after $((READY - START)) s, running the regression suite..."

# Prefer the system Chrome locally (no Playwright browser download); CI sets SMOKE_CHANNEL= and installs Chromium.
if [[ -z "${SMOKE_CHANNEL+x}" && -d "/Applications/Google Chrome.app" ]]; then export SMOKE_CHANNEL=chrome; fi

set +e
(cd "$ROOT/web" && PLAYWRIGHT_BASE_URL="http://localhost:$PORT" E2E_AUTH_PORT="$AUTH_PORT" E2E_FIRESTORE_PORT="$FIRESTORE_PORT" \
    E2E_FUNCTIONS_PORT="$FUNCTIONS_PORT" E2E_STORAGE_PORT="$STORAGE_PORT" \
    npx playwright test -c playwright.regression.config.ts --reporter="${REGRESSION_REPORTER:-line}" "$@")
RESULT=$?
set -e

END=$(date +%s)
if [[ $RESULT -eq 0 ]]; then
    echo "e2e-regression: PASSED (tests $((END - READY)) s, total $((END - START)) s)"
else
    echo "e2e-regression: FAILED (tests $((END - READY)) s, total $((END - START)) s)" >&2
fi
exit $RESULT
