#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_GROUP_ID="group.de.christophlabestin.projectflow"
STRICT=0
SIGNED_APP_PATH=""

usage() {
    cat <<'USAGE'
Usage: scripts/check-retention-provisioning.sh [--strict] [--signed-app PATH]

Checks ProjectFlow retention provisioning prerequisites:
- web push VAPID configuration wiring
- iOS App Group entitlement wiring
- iOS APNs entitlement wiring

Options:
  --strict          Treat warnings as failures.
  --signed-app     Path to a signed .app bundle to inspect with codesign.
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --strict)
            STRICT=1
            ;;
        --signed-app)
            shift
            SIGNED_APP_PATH="${1:-}"
            if [[ -z "$SIGNED_APP_PATH" ]]; then
                echo "[fail] --signed-app requires a path"
                exit 2
            fi
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "[fail] Unknown argument: $1"
            usage
            exit 2
            ;;
    esac
    shift
done

failures=0
warnings=0

pass() {
    echo "[pass] $1"
}

warn() {
    warnings=$((warnings + 1))
    echo "[warn] $1"
    if [[ "$STRICT" -eq 1 ]]; then
        failures=$((failures + 1))
    fi
}

fail() {
    failures=$((failures + 1))
    echo "[fail] $1"
}

relative_path() {
    local path="$1"
    echo "${path#"$ROOT_DIR"/}"
}

has_non_placeholder_env_value() {
    local key="$1"
    shift

    for file in "$@"; do
        [[ -f "$file" ]] || continue
        local line
        line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
        [[ -n "$line" ]] || continue

        local value="${line#*=}"
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"

        if [[ -n "${value//[[:space:]]/}" && "$value" != *"replace"* && "$value" != *"your-"* && "$value" != *"placeholder"* ]]; then
            echo "$file"
            return 0
        fi
    done

    return 1
}

check_file_contains() {
    local file="$1"
    local pattern="$2"
    local label="$3"

    if [[ ! -f "$file" ]]; then
        fail "$label is missing at $(relative_path "$file")"
        return
    fi

    if grep -q "$pattern" "$file"; then
        pass "$label"
    else
        fail "$label is not configured in $(relative_path "$file")"
    fi
}

echo "ProjectFlow retention provisioning checks"
echo

notification_service="$ROOT_DIR/web/services/notificationService.ts"
messaging_worker="$ROOT_DIR/web/public/firebase-messaging-sw.js"
env_example="$ROOT_DIR/web/.env.example"
env_files=(
    "$ROOT_DIR/web/.env.local"
    "$ROOT_DIR/web/.env.production.local"
    "$ROOT_DIR/web/.env"
)

check_file_contains "$notification_service" "VITE_FIREBASE_VAPID_KEY" "Web push reads VITE_FIREBASE_VAPID_KEY"
check_file_contains "$messaging_worker" "onBackgroundMessage" "Firebase Messaging service worker handles background pushes"
check_file_contains "$env_example" "VITE_FIREBASE_VAPID_KEY" "Environment example documents VAPID key"

if env_source="$(has_non_placeholder_env_value "VITE_FIREBASE_VAPID_KEY" "${env_files[@]}")"; then
    pass "VITE_FIREBASE_VAPID_KEY is present in $(relative_path "$env_source")"
elif [[ -n "${VITE_FIREBASE_VAPID_KEY:-}" ]]; then
    pass "VITE_FIREBASE_VAPID_KEY is present in the shell environment"
else
    warn "VITE_FIREBASE_VAPID_KEY is not set locally; web push token registration will show missing configuration until the Firebase Web Push certificate key is provided."
fi

echo

project_file="$ROOT_DIR/swift/projectflow.xcodeproj/project.pbxproj"
app_entitlements="$ROOT_DIR/swift/projectflow/projectflow.entitlements"
ambient_entitlements="$ROOT_DIR/swift/projectflowAmbientExtension/projectflowAmbientExtension.entitlements"
share_entitlements="$ROOT_DIR/swift/projectflowShareExtension/projectflowShareExtension.entitlements"

check_file_contains "$project_file" "CODE_SIGN_ENTITLEMENTS = projectflow/projectflow.entitlements;" "Main app target uses entitlement file"
check_file_contains "$project_file" "CODE_SIGN_ENTITLEMENTS = projectflowAmbientExtension/projectflowAmbientExtension.entitlements;" "Ambient extension target uses entitlement file"
check_file_contains "$project_file" "CODE_SIGN_ENTITLEMENTS = projectflowShareExtension/projectflowShareExtension.entitlements;" "Share extension target uses entitlement file"
check_file_contains "$project_file" "DEVELOPMENT_TEAM = 48BM67TY9G;" "Apple development team is configured"

check_file_contains "$app_entitlements" "$APP_GROUP_ID" "Main app App Group entitlement includes $APP_GROUP_ID"
check_file_contains "$ambient_entitlements" "$APP_GROUP_ID" "Ambient extension App Group entitlement includes $APP_GROUP_ID"
check_file_contains "$share_entitlements" "$APP_GROUP_ID" "Share extension App Group entitlement includes $APP_GROUP_ID"
check_file_contains "$app_entitlements" "aps-environment" "Main app declares APNs entitlement"

if grep -q "<string>production</string>" "$app_entitlements"; then
    pass "Source APNs entitlement is production"
elif grep -q "<string>development</string>" "$app_entitlements"; then
    warn "Source APNs entitlement is development; verify a signed release archive because production APNs is determined by the distribution provisioning profile."
else
    warn "Source APNs entitlement value was not recognized; verify the signed release archive before shipping push."
fi

echo

if [[ -n "$SIGNED_APP_PATH" ]]; then
    if [[ ! -d "$SIGNED_APP_PATH" ]]; then
        fail "Signed app bundle does not exist: $SIGNED_APP_PATH"
    elif ! command -v codesign >/dev/null 2>&1; then
        fail "codesign is not available; cannot inspect signed app entitlements."
    else
        signed_entitlements="$(mktemp)"
        if codesign -d --entitlements :- "$SIGNED_APP_PATH" >"$signed_entitlements" 2>/dev/null; then
            if grep -q "$APP_GROUP_ID" "$signed_entitlements"; then
                pass "Signed app includes App Group entitlement $APP_GROUP_ID"
            else
                fail "Signed app is missing App Group entitlement $APP_GROUP_ID"
            fi

            if grep -q "<string>production</string>" "$signed_entitlements"; then
                pass "Signed app APNs entitlement is production"
            else
                fail "Signed app APNs entitlement is not production"
            fi
        else
            fail "codesign could not extract entitlements from $SIGNED_APP_PATH"
        fi
        rm -f "$signed_entitlements"
    fi
else
    warn "No signed .app path supplied; release-profile APNs/App Group entitlement verification still needs a signed archive check."
fi

echo

if [[ "$failures" -gt 0 ]]; then
    echo "Provisioning check failed: $failures failure(s), $warnings warning(s)."
    exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
    echo "Provisioning check completed with $warnings warning(s)."
else
    echo "Provisioning check passed without warnings."
fi
