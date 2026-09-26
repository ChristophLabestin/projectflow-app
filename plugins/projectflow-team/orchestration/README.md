# Orchestrierung — wie Carla das Team steuert

Carla (Chief of Staff) ist der Orchestrator. Sie entscheidet anhand fester Regeln, welche Agenten
angefeuert werden, delegiert Arbeit an **Subagenten** (kostengünstig durch Context-Packs) und hält
den Stand über **Handoff-/State-Dateien** aktuell, damit jeder Agent jederzeit weiß, was läuft.

Kernprinzipien:
1. **Regeln vor Bauchgefühl:** Zuständigkeit kommt aus `dispatch-matrix.md`.
2. **Subagenten lesen wenig:** immer den kompakten `CONTEXT.md`-Pack des Projekts, nie das ganze Repo (`subagent-guide.md`).
3. **Doku ist immer aktuell:** jeder Agent aktualisiert die kleinste richtige Datei nach der Arbeit (`docs-and-handoff-rules.md`).
4. **Code nur auf Branch, Review vor Mensch:** siehe `customer-change-request.md`. Kein `main`/Deploy durch Agenten.

Dateien: `dispatch-matrix.md`, `new-project.md`, `customer-change-request.md`, `subagent-guide.md`, `docs-and-handoff-rules.md`, `templates/`.
