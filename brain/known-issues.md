# Known Issues

Last updated: 2026-06-04

## Issue List

- ProjectFlow tracking unavailable in the current shell.
  - Impact: the Brain migration, Flow/Issue removal cleanup, and Task Full Workbench redesign could not create the required ProjectFlow initiative/task automatically.
  - Evidence: `python3 plugins/projectflow-codex/scripts/projectflow_session.py start ... --entity initiative` returned `Missing PROJECTFLOW_API_TOKEN.`
  - Status: unresolved environment/configuration issue.
  - Workaround: set `PROJECTFLOW_API_TOKEN` and rerun the ProjectFlow Codex session command from [commands-and-environment.md](./commands-and-environment.md).

## Workarounds

- When the ProjectFlow API cannot be reached, record the attempted tracking action in this file and [handoff.md](./handoff.md); do not invent task ids.
