# Subagenten sparsam einsetzen (Token-Regeln)

Subagenten (Task-Tool) starten **ohne Kontext**. Wenn sie das ganze Repo durchsuchen, kostet das viel.
Ziel: jeder Subagent liest **eine kompakte Datei** + bekommt einen **engen Auftrag** und liefert ein **kurzes Ergebnis**.

## Regeln (verbindlich)
1. **Ein Context-Pack, kein Repo-Scan.** Jeder Subagent-Prompt nennt genau die zu lesende Datei:
   `<repo>/.team/CONTEXT.md` (oder das vorhandene `brain/`/`AGENTS.md`). Kein „lies dich ins Projekt ein".
2. **Enger Auftrag.** Genau ein Deliverable pro Subagent (z. B. „implementiere X in Datei Y", „review diesen Diff").
3. **Kurzes Output-Format vorgeben.** Ergebnis = Zusammenfassung + geänderte Dateien + nächster Schritt.
   **Keine** Volltext-Dumps, keine langen Erklärungen zurückgeben.
4. **Nur bei Bedarf tiefer.** Erst wenn der Context-Pack nicht reicht, darf gezielt (nicht flächig) nachgelesen werden.
5. **Parallelisieren, wo unabhängig.** Mehrere Subagenten gleichzeitig für unabhängige Teile; Carla führt zusammen.
6. **Context-Pack aktuell halten** (siehe `docs-and-handoff-rules.md`) — dann bleibt der Lese-Aufwand pro Subagent klein.

## Prompt-Schablone für einen Subagenten
> Rolle: <Agent>. Lies NUR `<repo>/.team/CONTEXT.md`. Aufgabe: <ein Deliverable>.
> Constraints: <Branch, keine Prod, Konventionen>. Antworte knapp im Format:
> **Ergebnis** (2–4 Sätze) · **Geänderte Dateien** · **Nächster Schritt** · **Offene Fragen**.

## Warum das spart
Context-Packs sind < ~150 Zeilen und kuratiert. Ein Subagent liest 150 statt 5.000+ Zeilen —
das ist der Hebel. Doku-Pflege ist damit kein Selbstzweck, sondern direkte Token-Ersparnis.
