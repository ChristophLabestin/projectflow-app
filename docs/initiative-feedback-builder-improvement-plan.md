# Initiative Feedback Builder Improvement Plan

Date: 2026-05-25

## Problem

The initiative feedback form builder currently exposes every concern in one long modal: form copy, field structure, field settings, publishing links, and preview. It works technically, but the experience makes it hard to know what to do next, whether the form is safe to publish, and how a configured field will turn into a linked task.

## Product Goals

- Make the builder feel like a guided workflow instead of a settings dump.
- Keep the core action clear: configure a customer-facing form that creates tasks on the initiative.
- Surface validation before save, not only after backend rejection.
- Explain task mapping where the user is editing fields, not in detached help copy.
- Keep the public preview sticky and useful while editing.
- Keep the hosted link, endpoint, and token management available only when relevant.

## Implementation Plan

1. Add a three-step builder frame: setup, fields, publish.
2. Add builder health checks for missing labels, hidden required fields, select fields without options, empty enabled forms, and missing task title/description mapping.
3. Block save when blocking issues exist and show issue rows with direct field selection where possible.
4. Refactor field cards into a denser list with type, mapping, visibility, and required state visible at scan level.
5. Make field movement available in the list and editor so reordering does not require opening a secondary control cluster.
6. Add helper functions that prepare fields for save by trimming labels, placeholders, help text, and select options.
7. Refresh the preview column so it shows the current publishing state, enabled field count, attachment behavior, and the live public form.
8. Keep all new strings in `web/locales/en.ts` and `web/locales/de.ts`.
9. Update docs and add focused tests for the schema helpers.

## Validation

- Run focused Vitest coverage for the feedback builder helpers.
- Run the web production build.
- Browser-check the initiative feedback modal if a local app session is practical.

## Tracking

ProjectFlow initiative/task upsert was attempted at the start and end of the session. Initiative creation returned HTTP 500, and the plain task-create fallback returned HTTP 503. Tracking still needs to be retried when the ProjectFlow API is healthy again.
