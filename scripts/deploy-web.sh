#!/usr/bin/env bash
# The only supported way to deploy the web app's hosting: merge origin/main → build → predeploy smoke → deploy.
# Stops at the first failure (no `;` chains), so a stale or broken state can never reach production.
#
#   bash scripts/deploy-web.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git fetch -q origin main
git merge -q --no-edit origin/main
npm --prefix web run -s build
bash scripts/predeploy-smoke.sh
firebase deploy --only hosting --project projectflow-labestin --non-interactive
