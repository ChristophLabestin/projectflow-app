# Analytics and Observability

Last updated: 2026-06-04

## Current Signals

- Notification delivery, push provisioning, APNs, web VAPID, and signed-release behavior are tracked in [operations/projectflow-production-provisioning.md](./operations/projectflow-production-provisioning.md).
- Retention, focus state, notification reliability, Codex integration, and habit loop analysis are tracked in [plans/projectflow-retention-and-codex-integration-report.md](./plans/projectflow-retention-and-codex-integration-report.md).
- Runtime diagnostics and implementation phases are tracked in [plans/projectflow-retention-implementation-plan.md](./plans/projectflow-retention-implementation-plan.md).

## What To Monitor

- Authentication and membership resolution failures.
- Permission denials and backend validation failures.
- Notification subscription, send, delivery, and callback behavior.
- AI quota and overage accounting.
- Codex session start, checkpoint, finish, and follow-up creation.
- Firestore rule/index deployment drift.
- E2E smoke coverage for critical routes.

## Notes

- There is no single consolidated observability dashboard documented yet.
- When adding telemetry, document the event name, owner, emitted fields, and where it can be inspected.
