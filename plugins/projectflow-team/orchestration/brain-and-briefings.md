# Briefing-Fäden & Brain-Ordner — zwei Ebenen, klar getrennt

Zwei Speicher mit unterschiedlicher Aufgabe. Das ist der Kern, damit gezieltes Chatten funktioniert,
ohne dass Wissen verrottet oder Subagenten teuer werden.

| Ebene | Was | Wo | Lebensdauer |
|---|---|---|---|
| **Briefing-Faden** | Gespräch/Posteingang: du gibst einem Agenten gezielt Infos, er antwortet | ProjectFlow-Task „📥 Briefing: <Agent>" (Kommentare) | kurzlebig, konversationell |
| **Durables Gedächtnis** | Gesichertes Projektwissen, Konventionen, Entscheidungen | Repo-`brain/` (falls vorhanden) sonst `<repo>/.team/CONTEXT.md` | dauerhaft, Quelle der Wahrheit |

## So chattest du gezielt mit einem Mitarbeiter
- **In ProjectFlow (auch mobil):** öffne den Task „📥 Briefing: <Agent>" im jeweiligen Projekt und schreib einen Kommentar.
- **In Claude:** `brief_agent(agent, message)` — legt denselben Faden an/füllt ihn.

## Was der Agent (z. B. der PM) damit tut
1. **`read_briefing`** zuerst — den Faden als Kontext lesen.
2. **Handeln** (Tasks, Spec, Code-Branch … je nach Rolle).
3. **Dauerwissen sichern:** relevante, bleibende Fakten ins **`brain/`** des Repos schreiben —
   nach den Regeln dieses Brains (z. B. `projectflow-app/brain/agent-operating-manual.md`: kleinste richtige Datei, nicht duplizieren).
   Hat das Repo kein brain, ins `<repo>/.team/CONTEXT.md`.
4. **`reply_briefing`** — kurz zurückmelden: verstanden/erledigt + wohin das Wissen wanderte + Rückfragen.

> Faustregel: **Der Faden ist das Gespräch, das brain/ ist das Gedächtnis.** Nichts Dauerhaftes bleibt nur im Faden liegen —
> es wird ins brain/ überführt. So bleibt der Faden kurz und Subagenten lesen weiter nur den kompakten brain-/Context-Pack.

## Brain-Landkarte (Repos in 02_Projects)
| Projekt | Repo | Durables Gedächtnis |
|---|---|---|
| ProjectFlow | projectflow-app | `brain/` (mit Operating Manual) |
| Notenklar | grade-manager | `brain/` bzw. `AGENTS.md` |
| Quivena | Quivena | `Brain/` bzw. `AGENTS.md` |
| Monoria | monoria-app | `AGENTS.md` → sonst `.team/CONTEXT.md` anlegen |
| VfR Skiclub | vfr-skiclub | `.team/CONTEXT.md` anlegen |
| Feuerwehr Laberweinting | feuerwehr-laberweinting | `.team/CONTEXT.md` anlegen |

## Wer wacht darüber
**Ida** hält brain/ und `.team/` konsistent und schlank; **Carla** stellt sicher, dass jeder aktive Agent einen Briefing-Faden hat.
Guardrail bleibt: kundensichtbare/rechtliche/main-relevante Dinge nie ohne Review/Freigabe.
