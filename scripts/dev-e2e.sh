#!/usr/bin/env bash
# Starts ProjectFlow fully local and already signed in, for E2E/QA sessions:
#   1. Firebase emulators (Auth, Firestore, Storage, Functions) with the repo's rules,
#   2. the demo workspace from scripts/seed-emulator.mjs plus an outsider account
#      (no workspace) for permission tests,
#   3. the Vite dev server in emulator mode, auto-signed-in as the demo owner.
# Nothing here talks to production: the project id is demo-projectflow (E2E_AI=1: see below).
#
#   bash scripts/dev-e2e.sh                         # app on :3000
#   PORT=3005 bash scripts/dev-e2e.sh               # other app port
#   E2E_LOGIN=outsider bash scripts/dev-e2e.sh      # sign in as the outsider instead
#   E2E_LOGIN=none bash scripts/dev-e2e.sh          # start signed out (login screen QA)
#   E2E_WEB=preview bash scripts/dev-e2e.sh         # serve the production build instead of the dev server
#   E2E_FUNCTIONS=0 bash scripts/dev-e2e.sh         # skip the Functions emulator
#   E2E_LEGAL=1 bash scripts/dev-e2e.sh             # seed legal docs v1 (consent gate active) and
#                                                   # make the demo owner a platform admin (/admin/legal)
#   E2E_ADMIN=1 bash scripts/dev-e2e.sh             # only make the demo owner a platform admin (/admin/*)
#   E2E_AI=1 bash scripts/dev-e2e.sh                # in-app AI with the real model: emulators run under the
#                                                   # real project id so the Functions emulator can read
#                                                   # OPENAI_API_KEY from Secret Manager (data stays in the
#                                                   # emulators); turns on `inAppAi` for the demo workspace
#
# Emulator accounts (emulator only):
#   demo@projectflow.test     / projectflow-demo     (seeded workspace owner)
#   outsider@projectflow.test / pf-outsider-e2e      (no workspace membership)
#
# Emulator ports default to a block other local Firebase projects rarely use;
# override with AUTH_PORT, FIRESTORE_PORT, STORAGE_PORT, FUNCTIONS_PORT.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="demo-projectflow"
[[ "${E2E_AI:-0}" == "1" ]] && PROJECT_ID="projectflow-labestin"
PORT="${PORT:-3000}"
AUTH_PORT="${AUTH_PORT:-9631}"
FIRESTORE_PORT="${FIRESTORE_PORT:-8631}"
STORAGE_PORT="${STORAGE_PORT:-9632}"
FUNCTIONS_PORT="${FUNCTIONS_PORT:-5631}"
CONFIG="$ROOT/.firebase.e2e.json"
LOG="$ROOT/.firebase-e2e.log"

case "${E2E_LOGIN:-demo}" in
    outsider) LOGIN_EMAIL="outsider@projectflow.test"; LOGIN_PASSWORD="pf-outsider-e2e" ;;
    none)     LOGIN_EMAIL="";                          LOGIN_PASSWORD="" ;;
    *)        LOGIN_EMAIL="demo@projectflow.test";     LOGIN_PASSWORD="projectflow-demo" ;;
esac

# Same config as firebase.json, only with this script's emulator ports.
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
EMULATORS="auth,firestore,storage"
if [[ "${E2E_FUNCTIONS:-1}" == "1" ]]; then
    echo "Building Cloud Functions for the emulator (E2E_FUNCTIONS=0 to skip)..."
    npm --prefix "$ROOT/functions" run build --silent
    EMULATORS="$EMULATORS,functions"
fi
# Own temp dir: the Storage emulator keeps blobs in $TMPDIR/firebase/storage and wipes it on exit, which
# breaks uploads of every other emulator suite on this machine that shares the default temp dir.
EMULATOR_TMP="$(mktemp -d "${TMPDIR:-/tmp}/pf-emulators.XXXXXX")"
TMPDIR="$EMULATOR_TMP" firebase emulators:start --only "$EMULATORS" --project "$PROJECT_ID" --config "$CONFIG" > "$LOG" 2>&1 &
EMULATOR_PID=$!
trap 'kill -INT "$EMULATOR_PID" 2>/dev/null; wait "$EMULATOR_PID" 2>/dev/null || true; rm -rf "$EMULATOR_TMP"' EXIT INT TERM

echo "Waiting for Firebase emulators (log: .firebase-e2e.log)..."
for _ in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:$AUTH_PORT" > /dev/null && curl -sf "http://127.0.0.1:$FIRESTORE_PORT" > /dev/null; then break; fi
    kill -0 "$EMULATOR_PID" 2>/dev/null || { tail -n 30 "$LOG"; exit 1; }
    sleep 1
done

SEED_PROJECT_ID="$PROJECT_ID" FIRESTORE_EMULATOR_HOST="127.0.0.1:$FIRESTORE_PORT" FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:$AUTH_PORT" \
    node scripts/seed-emulator.mjs

if [[ "${E2E_AI:-0}" == "1" ]]; then
    curl -s -X PATCH "http://127.0.0.1:$FIRESTORE_PORT/v1/projects/$PROJECT_ID/databases/(default)/documents/tenants/ws-demo-studio/ai_config/policy?updateMask.fieldPaths=inAppAi" \
        -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
        -d '{"fields":{"inAppAi":{"booleanValue":true}}}' > /dev/null
fi

if [[ "${E2E_LEGAL:-0}" == "1" ]]; then
    GCLOUD_PROJECT="$PROJECT_ID" FIRESTORE_EMULATOR_HOST="127.0.0.1:$FIRESTORE_PORT" \
        node functions/scripts/import-legal-docs.mjs legal/v1 --publish-initial
    GCLOUD_PROJECT="$PROJECT_ID" FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:$AUTH_PORT" FIRESTORE_EMULATOR_HOST="127.0.0.1:$FIRESTORE_PORT" \
        node functions/scripts/grant-platform-admin.mjs demo@projectflow.test
elif [[ "${E2E_ADMIN:-0}" == "1" ]]; then
    GCLOUD_PROJECT="$PROJECT_ID" FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:$AUTH_PORT" FIRESTORE_EMULATOR_HOST="127.0.0.1:$FIRESTORE_PORT" \
        node functions/scripts/grant-platform-admin.mjs demo@projectflow.test
fi

curl -s -X POST "http://127.0.0.1:$AUTH_PORT/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key" \
    -H 'Content-Type: application/json' \
    -d '{"email":"outsider@projectflow.test","password":"pf-outsider-e2e","displayName":"Outside Tester"}' > /dev/null

export VITE_EMULATOR_AUTH_PORT="$AUTH_PORT" VITE_EMULATOR_FIRESTORE_PORT="$FIRESTORE_PORT" \
    VITE_EMULATOR_STORAGE_PORT="$STORAGE_PORT" VITE_EMULATOR_FUNCTIONS_PORT="$FUNCTIONS_PORT" VITE_EMULATOR_PROJECT_ID="$PROJECT_ID"

if [[ "${E2E_WEB:-dev}" == "preview" ]]; then
    # Production build (minified, real chunking) against the emulators, served by `vite preview`.
    # Used by scripts/predeploy-smoke.sh; there is no auto-login in builds, the test signs in itself.
    DIST="${E2E_DIST:-${TMPDIR:-/tmp}/pf-e2e-dist}"
    echo "Building the web app (emulator mode) into $DIST..."
    (cd "$ROOT/web" && npx vite build --mode emulator --outDir "$DIST" --emptyOutDir --logLevel error)
    echo "App: http://localhost:$PORT (production build, not signed in)"
    (cd "$ROOT/web" && npx vite preview --mode emulator --outDir "$DIST" --port "$PORT" --strictPort)
    exit 0
fi

echo "App: http://localhost:$PORT (signed in as ${LOGIN_EMAIL:-nobody})"
VITE_E2E_AUTO_LOGIN_EMAIL="$LOGIN_EMAIL" VITE_E2E_AUTO_LOGIN_PASSWORD="$LOGIN_PASSWORD" \
    npm --prefix "$ROOT/web" run dev:emulator -- --port "$PORT" --strictPort
