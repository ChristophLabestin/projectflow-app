# Initiative Feedback Builder Rework Plan

Date: 2026-05-28

## Problem

The old initiative feedback builder mixed form setup, field editing, publishing, validation, and preview into a heavy settings modal. Even after visual compaction, the workflow still asked users to understand the builder's internal model before they could answer the practical question: what will customers be asked, and where does the feedback go?

## Product Direction

- Rebuild the feature around the public intake outcome, not around implementation settings.
- Match the existing task/initiative modal language instead of introducing a bespoke builder shell.
- Make the public form title and description the first editable controls so the modal starts with the customer-facing form, not internal setup text.
- Make questions the primary workspace; put publishing and links in a secondary Share view.
- Move field editing into inline row expansion instead of showing every setting at once.
- Let every field, including default fields, be fully customized: label, type, task mapping, placeholder, help text, select options, required state, visibility, width, order, and removal.
- Add question templates for the common field types so users do not start from an abstract "custom field".
- Keep preview available on demand, not as a permanent competing column.
- Preserve the existing `InitiativeFeedbackFormSettings` schema, callable save path, hosted public page, and embedded endpoint contract.

## Implementation Scope

1. Replace the setup/fields/publish stepper with a task-modal-style editor:
   - form title input and description textarea at the top
   - one compact toolbar for Questions/Share, add-question, preview, and publish
   - footer save/cancel actions with compact form health
   - main Questions canvas with dense question rows and inline selected-question editing
   - Share canvas for hosted link, endpoint, token, and attachment settings
2. Keep validation visible through a single top alert, field-level issue chips, selected-question issue rows, and the compact health text.
3. Use existing schema helper validation and save preparation so public submissions and task creation keep the same behavior, with an added warning when more than one visible field maps to the same task property.
4. Localize all new visible text in English and German.
5. Update styling guidance to treat builders as compact modal editors first, only expanding into workspace-like layouts when the workflow genuinely needs it.

## Validation

- `cd web && npm run lint:theme`
- `cd web && npm run test:run -- initiativeFeedbackBuilder`
- `cd web && npm run build`
- Browser-check desktop and mobile renders through a temporary local harness because the authenticated initiative route redirects to login outside a signed-in session.

## Tracking

ProjectFlow initiative tracking was attempted with `projectflow_cli.py sync checkpoint --entity initiative --phase start --request "Rework initiative feedback form builder from scratch"` and returned `HTTP 403: Insufficient permissions`. Completed fallback tasks were created instead: `8t1Of9ds8lQ1jc3Q7zEi` for the scratch rework and `UIEnvyqfNkGbquxzEYji` for the quieting pass.
