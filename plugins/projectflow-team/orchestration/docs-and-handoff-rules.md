# Doku- & Handoff-Regeln — immer aktuell, immer klein

Damit jeder Agent jederzeit weiß, was läuft, gibt es lebende Dateien mit klaren Update-Pflichten.

## Die lebenden Dateien
| Datei | Ort | Zweck | Wer pflegt |
|---|---|---|---|
| `CONTEXT.md` | `<repo>/.team/` | Kompakter Wissens-Pack für Subagenten (was ist das Projekt, Stack, Schlüsseldateien, Konventionen, run/test) | PM des Projekts |
| `STATE.md` | `<repo>/.team/` | Aktueller Stand: Fokus, in Arbeit, Blocker, nächste Schritte | jeder Agent nach seiner Arbeit |
| `HANDOFF.md` | `<repo>/.team/` | Kurze Übergabe: was geändert, validiert wie, nächster Zug, Watchouts | der zuletzt aktive Agent |
| `TEAM_STATE.md` | `00_Control_Tower/` | Projektübergreifend: wer arbeitet woran, offene Eskalationen, letzte Reports | Carla |

## Update-Pflichten (Regeln)
1. **Nach jeder Arbeitseinheit** aktualisiert der handelnde Agent `STATE.md` (1–5 Zeilen) und – wenn er übergibt – `HANDOFF.md`.
2. **Kleinste richtige Datei.** Fakten nicht duplizieren. Dauerwissen → `CONTEXT.md`; Tagesstand → `STATE.md`.
3. **Kurz halten.** `STATE.md`/`HANDOFF.md` sind Momentaufnahmen, kein Archiv. Altes raus (ggf. in Reports/Outbox).
4. **Carla** fasst täglich in `TEAM_STATE.md` zusammen (wer/was/Blocker/Eskalationen) — Quelle für den Standup.
5. **Escalations** stehen zusätzlich in `04_Outbox/Decisions/` und als dir zugewiesener ProjectFlow-Task.
6. **Konsistenz vor Vollständigkeit:** lieber ein aktueller Dreizeiler als ein veralteter Roman.

## Wer wacht darüber
**Ida (Knowledge & Rules Keeper)** ist Eigentümerin der Doku-Hygiene: sie auditiert regelmäßig, führt Duplikate
zusammen, entfernt Veraltetes, hält Context-Packs schlank und meldet Widersprüche. Jeder Agent bleibt aber selbst
verantwortlich, seine `STATE.md`/`HANDOFF.md` nach der Arbeit zu aktualisieren — Ida räumt auf, ersetzt diese
Pflicht nicht. Guardrail: Ida pflegt Regeln, ändert No-Gos/Autonomie-Grenzen/Rechte aber nur als Vorschlag an
Christoph (`01_Agents/Ida_Knowledge_Keeper/limits.md`).

## Bezug zu bestehenden „Brains"
Hat ein Repo bereits `brain/` oder `AGENTS.md` (z. B. projectflow-app, grade-manager, Quivena),
gilt das als vorhandener Context-Pack. `.team/CONTEXT.md` verweist dann nur kurz darauf, statt zu duplizieren.
