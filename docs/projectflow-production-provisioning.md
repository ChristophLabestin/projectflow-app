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

## Web Push

ProjectFlow web push uses Firebase Cloud Messaging. The web app reads the public Web Push certificate key from `VITE_FIREBASE_VAPID_KEY` in the Vite environment.

Production setup:

1. In Firebase Console for `project-manager-9d0ad`, open Cloud Messaging.
2. Create or reuse the Web Push certificates key pair.
3. Put the public VAPID key into the web build environment as `VITE_FIREBASE_VAPID_KEY`.
4. Keep local development values in `web/.env.local`; do not commit them.
5. Keep production values in the hosting/build secret environment; do not bake them into docs.
6. Redeploy hosting after the production build environment is configured.
7. Sign in to production, open `/notifications`, and confirm the diagnostics show VAPID configured and token registered.

Current local observation on 2026-05-26: `web/.env.local` has Firebase app config keys but does not define `VITE_FIREBASE_VAPID_KEY`, so local web push registration reports missing configuration until that key is added. ProjectFlow follow-up task: `u7rRtb9TrHuLWxHKgYhl`.

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

The source entitlement file currently declares `aps-environment` as `development`. Treat that as normal for local development, but do not consider production push ready until a signed release app reports `aps-environment` as `production`. ProjectFlow follow-up task: `YYawDDhIJguHIFkKqrZD`.

## Release Checklist

- `scripts/check-retention-provisioning.sh` reports only expected external warnings during development.
- `scripts/check-retention-provisioning.sh --strict --signed-app /path/to/projectflow.app` passes for the signed release build.
- `/notifications` diagnostics in production show browser support, permission granted, VAPID configured, Firebase Messaging supported, and token registered.
- A production notification document creates a `notificationDeliveryLogs` record with an FCM success for the target user.
- A production iOS push opens the notification/action surface and exposes the ProjectFlow notification actions.
- A Focus Keeper widget and Live Activity can read the current App Group focus snapshot on a TestFlight or App Store signed build.
