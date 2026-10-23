#!/usr/bin/env bash
# Pre-deploy smoke test for the admin console (admin/): production bundle (emulator mode) served with
# `vite preview` against seeded emulators (scripts/dev-admin.sh), then admin/e2e/smoke.spec.ts
# (gate refuses a normal user; admin opens every page without errors). Exit code != 0 = do not deploy.
#
#   bash scripts/predeploy-smoke-admin.sh      # before `cd admin && firebase deploy --only hosting`
#
# Own ports: SMOKE_ADMIN_PORT=4292, emulators 9881/8881/9882/5881 (hub/logging = auth + 10 / + 11).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SMOKE_ADMIN_PORT:-4292}"
AUTH_PORT="${SMOKE_AUTH_PORT:-9881}"
FIRESTORE_PORT="${SMOKE_FIRESTORE_PORT:-8881}"
STORAGE_PORT="${SMOKE_STORAGE_PORT:-9882}"
FUNCTIONS_PORT="${SMOKE_FUNCTIONS_PORT:-5881}"
LOG="$ROOT/.predeploy-smoke-admin.log"
DIST="${TMPDIR:-/tmp}/pf-admin-smoke-dist"

for port in "$PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$STORAGE_PORT" "$FUNCTIONS_PORT" $((AUTH_PORT + 10)) $((AUTH_PORT + 11)); do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1; then
        echo "predeploy-smoke-admin: port $port is in use — set SMOKE_*_PORT to free ports." >&2
        exit 2
    fi
done

kill_tree() {
    local pid=$1 child
    for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
    kill -TERM "$pid" 2>/dev/null || true
}

echo "predeploy-smoke-admin: building the console (emulator mode)..."
(cd "$ROOT/admin" && VITE_USE_FIREBASE_EMULATORS=true VITE_EMULATOR_AUTH_PORT="$AUTH_PORT" VITE_EMULATOR_FUNCTIONS_PORT="$FUNCTIONS_PORT" \
    npx tsc --noEmit && VITE_USE_FIREBASE_EMULATORS=true VITE_EMULATOR_AUTH_PORT="$AUTH_PORT" VITE_EMULATOR_FUNCTIONS_PORT="$FUNCTIONS_PORT" \
    npx vite build --mode emulator --outDir "$DIST" --emptyOutDir > /dev/null)

echo "predeploy-smoke-admin: starting emulators (log: .predeploy-smoke-admin.log)..."
ADMIN_DEV_SERVER=0 AUTH_PORT="$AUTH_PORT" FIRESTORE_PORT="$FIRESTORE_PORT" STORAGE_PORT="$STORAGE_PORT" FUNCTIONS_PORT="$FUNCTIONS_PORT" \
    ADMIN_EMULATOR_CONFIG="$ROOT/.firebase.admin-smoke.json" ADMIN_EMULATOR_LOG="$ROOT/.firebase-admin-smoke-emulators.log" bash "$ROOT/scripts/dev-admin.sh" > "$LOG" 2>&1 &
EMU_PID=$!
PREVIEW_PID=""
cleanup() {
    [[ -n "$PREVIEW_PID" ]] && kill_tree "$PREVIEW_PID"
    kill_tree "$EMU_PID"
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 240); do
    grep -q "Emulators ready" "$LOG" 2>/dev/null && break
    kill -0 "$EMU_PID" 2>/dev/null || { echo "predeploy-smoke-admin: emulators failed:" >&2; tail -n 40 "$LOG" >&2; exit 1; }
    sleep 1
done
grep -q "Emulators ready" "$LOG" || { echo "predeploy-smoke-admin: emulators not ready" >&2; exit 1; }

(cd "$ROOT/admin" && npx vite preview --outDir "$DIST" --port "$PORT" --strictPort > /dev/null 2>&1) &
PREVIEW_PID=$!
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://localhost:$PORT" && break; sleep 1; done

if [[ -z "${SMOKE_CHANNEL+x}" && -d "/Applications/Google Chrome.app" ]]; then export SMOKE_CHANNEL=chrome; fi
set +e
(cd "$ROOT/admin" && PLAYWRIGHT_BASE_URL="http://localhost:$PORT" npx playwright test --config e2e/playwright.config.ts --reporter=line)
RESULT=$?
set -e
[[ $RESULT -eq 0 ]] && echo "predeploy-smoke-admin: PASSED" || echo "predeploy-smoke-admin: FAILED — do not deploy" >&2
exit $RESULT
