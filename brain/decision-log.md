# Decision Log

Last updated: 2026-06-04

## Decision Entries

- 2026-06-04: Adopt `/brain` as the repository living knowledge base.
  - Rationale: root Markdown and `docs/` had become scattered, making agent re-entry slower and less reliable.
  - Decision: scaffold an app-type Brain, move former root docs into `brain/reference/app/`, move old `docs/` content into themed Brain folders, and keep only conventional root Markdown entry points.
  - Alternatives considered: keep the old docs folder and add an index; create a new Brain without moving historical docs.
  - Consequences: future project context starts in `brain/README.md`; legacy docs remain available but are no longer the top-level navigation system.

## Follow-Ups

- Create ProjectFlow tracking record once `PROJECTFLOW_API_TOKEN` is available.
