# ProjectFlow Production Provisioning

Date: 2026-05-26  
Scope: retention push surfaces for web, iOS, WidgetKit, ActivityKit, and Share Sheet support.

## Status

The repo-side notification and ambient-surface implementation is in place. Production readiness still depends on secrets and Apple/Firebase portal settings that must not be committed to the repository.

Run the local readiness check before a release:

```bash
scripts/check-retention-provisioning.sh
```

Run the release entitlement check after creating a signed distribution app bundle:

```bash
scripts/check-retention-provisioning.sh --signed-app /path/to/projectflow.app
```

Use `--strict` in CI or release scripts if warnings should fail the job.

## Firebase Project

Since 2026-09-25 ProjectFlow runs on Firebase project `projectflow-labestin` (project number `11139679569`, owner account `christoph@labestindigital.de`, billing account "Firebase Payment"). The previous project `project-manager-9d0ad` belongs to a different account and was abandoned without data migration (fresh start).

- Firestore `(default)` in `eur3`, RTDB `projectflow-labestin-default-rtdb` in `europe-west1`, Storage bucket `projectflow-labestin.firebasestorage.app` in `EUROPE-WEST3`, Functions in `europe-west3`.
- Registered apps: web `1:11139679569:web:cbe0ba834a8dd97715bf70`, iOS `1:11139679569:ios:8f2cc861969cce7915bf70` (`de.christophlabestin.projectflow`).
- Secret `OPENAI_API_KEY` was created with a placeholder value; set the real value with `firebase functions:secrets:set OPENAI_API_KEY`.

- Auth (2026-09-26): Identity Platform with email/password, Google (public name "ProjectFlow", support `christoph@labestindigital.de`), GitHub (OAuth App "ProjectFlow (projectflow-labestin)" owned by ChristophLabestin, callback `https://projectflow-labestin.firebaseapp.com/__/auth/handler`, user-token expiry off because Firebase gets no refresh token) and TOTP MFA (`mfa.providerConfigs[].totpProviderConfig.adjacentIntervals = 5`, set via the Identity Toolkit admin API; the console only shows "MFA per SMS"). The old OAuth App "ProjectFlow Auth" still serves the old project/domain.
- Functions runtime SA `projectflow-labestin@appspot.gserviceaccount.com` had no roles at all (new projects no longer get Editor), so every Firestore-touching function failed with `PERMISSION_DENIED`. Granted: `datastore.user`, `firebaseauth.admin`, `storage.objectAdmin`, `firebasecloudmessaging.admin`, plus `iam.serviceAccountTokenCreator` on itself (custom tokens for passkey sign-in).
- Passkeys: RP ID = the page hostname for allow-listed origins (`<project>.web.app`, `<project>.firebaseapp.com`, `app.getprojectflow.com`; override `PASSKEY_ORIGINS`). A passkey only works on the host it was created on.
- New-project gotchas hit during setup: the default compute service account needed `cloudbuild.builds.builder`, `logging.logWriter`, `artifactregistry.writer`, `storage.objectViewer` before functions could build; the labestindigital.de org policy `iam.allowedPolicyMemberDomains` blocks `allUsers`, so a project-level override (`allowAll`) was set and `allUsers` invoker granted to all HTTP/callable functions; deploy functions in batches of ~12 to avoid "Quota Exceeded".

Open manual steps (console/external):

1. Auth: Facebook provider is still off (Google, GitHub, TOTP and passkeys are set up, see below).
2. Set the real `OPENAI_API_KEY` secret and redeploy the functions that use it.
3. Cloud Messaging: generate a Web Push certificate, put it into `VITE_FIREBASE_VAPID_KEY` (local + CI), upload the APNs key for the iOS app.
4. GitHub Actions: create secrets `FIREBASE_SERVICE_ACCOUNT_PROJECTFLOW_LABESTIN` and the `VITE_FIREBASE_*` values for the new project.
5. ~~Custom domain~~ done 2026-09-26: `app.getprojectflow.com` CNAME → `projectflow-labestin.web.app`, ownership moved from the old project (`OWNERSHIP_ACTIVE`, cert active). Passkeys created there are bound to `app.getprojectflow.com`.
6. Codex/team plugins: issue new workspace API tokens (old tokens belonged to the old project).

## Web Push

ProjectFlow web push uses Firebase Cloud Messaging. The web app reads the public Web Push certificate key from `VITE_FIREBASE_VAPID_KEY` in the Vite environment.

Production setup:

1. In Firebase Console for `projectflow-labestin`, open Cloud Messaging.
2. Create or reuse the Web Push certificates key pair.
3. Put the public VAPID key into the web build environment as `VITE_FIREBASE_VAPID_KEY`.
4. Keep local development values in `web/.env.local`; do not commit them.
5. Keep production values in the hosting/build secret environment; do not bake them into docs.
6. Redeploy hosting after the production build environment is configured.
7. Sign in to production, open `/notifications`, and confirm the diagnostics show VAPID configured and token registered.

Firebase's FCM web setup docs currently route Web Push certificate generation/import through Firebase Console, not through the Firebase app SDK config returned by `firebase apps:sdkconfig`.

Current local observation on 2026-05-26: `web/.env.local` now defines `VITE_FIREBASE_VAPID_KEY`, and `scripts/check-retention-provisioning.sh` confirms the local VAPID configuration. Production web push still needs the same public key in the hosting/build environment followed by a hosting redeploy and `/notifications` diagnostics check. ProjectFlow follow-up task: `u7rRtb9TrHuLWxHKgYhl`.

## iOS App Group And APNs

Known identifiers:

| Surface | Bundle identifier | Required capability |
| --- | --- | --- |
| Main app | `de.christophlabestin.projectflow` | Push Notifications, App Groups, Associated Domains |
| Ambient extension | `de.christophlabestin.projectflow.ambient` | App Groups |
| Share extension | `de.christophlabestin.projectflow.share` | App Groups |

Shared App Group:

```text
group.de.christophlabestin.projectflow
```

Apple Developer setup:

1. Enable Push Notifications for `de.christophlabestin.projectflow`.
2. Enable App Groups for the main app and both extensions.
3. Add `group.de.christophlabestin.projectflow` to all three identifiers.
4. Regenerate development and distribution provisioning profiles after capability changes.
5. In Firebase Console, upload or verify the APNs authentication key/certificate for the iOS app.
6. Build and archive with the distribution profile.
7. Inspect the signed release app with `scripts/check-retention-provisioning.sh --signed-app`.

The source entitlement file currently declares `aps-environment` as `development`. Treat that as normal for local development, but do not consider production push ready until a signed release app reports `aps-environment` as `production`.

Current local observation on 2026-05-26: a Release archive with `-allowProvisioningUpdates` succeeded, but Xcode used `Apple Development: Christoph Labestin (U9SR73H968)` and the Xcode-managed profile `iOS Team Provisioning Profile: de.christophlabestin.projectflow`. The signed app includes `group.de.christophlabestin.projectflow`, but its APNs entitlement is still `development`. User-reported external update on 2026-05-26: the APNs credential was created in Apple Developer and the iOS push certificate was configured in Firebase Cloud Messaging. Remaining production push verification is a distribution-signed archive whose signed `.app` reports `aps-environment=production`, followed by a real device/TestFlight push test. ProjectFlow follow-up task: `YYawDDhIJguHIFkKqrZD`.

## Release Checklist

- `scripts/check-retention-provisioning.sh` reports only expected external warnings during development.
- `scripts/check-retention-provisioning.sh --strict --signed-app /path/to/projectflow.app` passes for the signed release build.
- `/notifications` diagnostics in production show browser support, permission granted, VAPID configured, Firebase Messaging supported, and token registered.
- The `/notifications` Send test action creates a `diagnostic_test` notification and recent delivery logs show the FCM/email outcome.
- A production iOS push opens the notification/action surface and exposes the ProjectFlow notification actions.
- A Focus Keeper widget and Live Activity can read the current App Group focus snapshot on a TestFlight or App Store signed build.
