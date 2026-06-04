# Open Questions

Last updated: 2026-06-04

## Questions

- Should root-level `GEMINI.md` remain as a conventional Gemini entry file, or should it eventually become a tiny pointer to `brain/agent-operating-manual.md` only?
  - Why it matters: root cleanup should not break external agent conventions.
  - Current stance: keep `GEMINI.md` at root as a conventional entry point and point it into the Brain.

- Should historical reference docs under `brain/reference/app/` be renamed from uppercase legacy names to kebab-case Brain names?
  - Why it matters: renaming would improve consistency but may create additional link churn.
  - Current stance: preserve names during the first migration to keep history and references recognizable.

## Resolution Path

- Revisit after future agents have used the Brain for at least one implementation session.
