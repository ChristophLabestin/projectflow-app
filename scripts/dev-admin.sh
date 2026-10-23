#!/usr/bin/env bash
# Admin console (admin/) fully local against emulators — nothing talks to production (demo-projectflow).
#   1. Firebase emulators (Auth, Firestore, Functions) with the repo rules, own port block,
#   2. demo workspace (seed-emulator.mjs), legal docs v1, a few crash reports,
#   3. demo@projectflow.test = platform admin (claim + allowlist + emulator MFA stand-in),
#      outsider@projectflow.test = normal user (negative tests),
#   4. Vite dev server of admin/ in emulator mode.
#
#   bash scripts/dev-admin.sh                  # console on :3141
#   ADMIN_DEV_SERVER=0 bash scripts/dev-admin.sh   # emulators + seed only (for scripts/admin-e2e.mjs)
#
# Accounts: demo@projectflow.test / projectflow-demo (admin), outsider@projectflow.test / pf-outsider-e2e.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="demo-projectflow"
PORT="${PORT:-3141}"
AUTH_PORT="${AUTH_PORT:-9841}"
FIRESTORE_PORT="${FIRESTORE_PORT:-8841}"
STORAGE_PORT="${STORAGE_PORT:-9842}"
FUNCTIONS_PORT="${FUNCTIONS_PORT:-5841}"
CONFIG="${ADMIN_EMULATOR_CONFIG:-$ROOT/.firebase.admin-e2e.json}"
LOG="${ADMIN_EMULATOR_LOG:-$ROOT/.firebase-admin-e2e.log}"

node -e '
const [src, dest, auth, firestore, storage, functions] = process.argv.slice(1);
const config = JSON.parse(require("fs").readFileSync(src, "utf8"));
config.emulators = { ...config.emulators,
    auth: { port: +auth }, firestore: { port: +firestore }, storage: { port: +storage },
    functions: { port: +functions }, hub: { port: +auth + 10 }, logging: { port: +auth + 11 },
    ui: { enabled: false } };
delete config.emulators.database;
require("fs").writeFileSync(dest, JSON.stringify(config, null, 2));
' "$ROOT/firebase.json" "$CONFIG" "$AUTH_PORT" "$FIRESTORE_PORT" "$STORAGE_PORT" "$FUNCTIONS_PORT"

cd "$ROOT"
echo "Building Cloud Functions for the emulator..."
npm --prefix "$ROOT/functions" run build --silent
firebase emulators:start --only auth,firestore,storage,functions --project "$PROJECT_ID" --config "$CONFIG" > "$LOG" 2>&1 &
EMULATOR_PID=$!
trap 'kill -INT "$EMULATOR_PID" 2>/dev/null; wait "$EMULATOR_PID" 2>/dev/null || true' EXIT INT TERM

echo "Waiting for Firebase emulators (log: .firebase-admin-e2e.log)..."
for _ in $(seq 1 120); do
    if curl -sf "http://127.0.0.1:$AUTH_PORT" > /dev/null && curl -sf "http://127.0.0.1:$FIRESTORE_PORT" > /dev/null \
        && grep -q "All emulators ready" "$LOG"; then break; fi
    kill -0 "$EMULATOR_PID" 2>/dev/null || { tail -n 30 "$LOG"; exit 1; }
    sleep 1
done

export GCLOUD_PROJECT="$PROJECT_ID" FIRESTORE_EMULATOR_HOST="127.0.0.1:$FIRESTORE_PORT" FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:$AUTH_PORT"
node scripts/seed-emulator.mjs
node functions/scripts/import-legal-docs.mjs legal/v1 --publish-initial > /dev/null
node functions/scripts/grant-platform-admin.mjs demo@projectflow.test --mfa-test > /dev/null
curl -s -X POST "http://127.0.0.1:$AUTH_PORT/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key" \
    -H 'Content-Type: application/json' \
    -d '{"email":"outsider@projectflow.test","password":"pf-outsider-e2e","displayName":"Outside Tester"}' > /dev/null
FUNCTIONS_URL="http://127.0.0.1:$FUNCTIONS_PORT/$PROJECT_ID/europe-west3" node scripts/seed-admin-emulator.mjs
unset FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST

if [[ "${ADMIN_DEV_SERVER:-1}" != "1" ]]; then
    echo "Emulators ready (auth :$AUTH_PORT, functions :$FUNCTIONS_PORT). Ctrl+C stops them."
    wait "$EMULATOR_PID"
    exit 0
fi

echo "Admin console: http://localhost:$PORT (demo@projectflow.test / projectflow-demo)"
VITE_USE_FIREBASE_EMULATORS=true VITE_EMULATOR_AUTH_PORT="$AUTH_PORT" VITE_EMULATOR_FUNCTIONS_PORT="$FUNCTIONS_PORT" \
    npm --prefix "$ROOT/admin" run dev -- --port "$PORT"
