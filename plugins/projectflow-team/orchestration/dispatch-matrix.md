# Dispatch-Matrix — wer wird wann angefeuert

Carla nutzt diese Tabelle, um Auslöser → Agentenkette zu bestimmen. Fehlt ein passender Agent
(z. B. PM für ein neues Projekt), stellt Carla ihn per `create_agent` ein.

| Auslöser | Kette (Reihenfolge) | Optional dazu |
|---|---|---|
| **Neues eigenes Produkt-Projekt** | Paul/PM (Vision+Scope) → Theo (Architektur) → Uma (UX) → Quinn (Tests) | Rosa (Markt), Mara/Nina (Go-to-Market) |
| **Neues Kundenprojekt** | Projekt anlegen → **PM** (dediziert, ggf. neu einstellen) + **Customer Service** (dediziert) → **Lara** (Datenschutz-Check) → Theo (Machbarkeit) | Mara (Außendarstellung) |
| **Kunden-Änderungswunsch** | **Customer Service** (annehmen/triagen) → **PM** (scopen) → **Theo/Dev** (auf Branch umsetzen) → **Kai/Code Review** (prüfen) → **Christoph** (final review + merge) | Lara, wenn Daten/Recht betroffen |
| **Bug/Regression** | Quinn (repro) → Theo/Dev (Fix-Branch) → Kai (Review) → Christoph | — |
| **Datenschutz/Legal-Frage** | Lara (Review) → Theo (Maßnahmen) → Christoph/Anwalt | — |
| **Marketing/Content** | Paul (was ist real) → Mara (Strategie) → Nina (Content) | — |
| **Report/Standup** | Carla (deterministischer Runner + Zusammenfassung) | — |

Grundregel Kundenprojekt-Erkennung: Auftraggeber-/Organisations-App (z. B. VfR Skiclub, Feuerwehr) = Kundenprojekt → CS + Legal.
Eigene B2C-Produkte (Quivena, Notenklar, Monoria, ProjectFlow) = kein CS/Legal-Pflichtpfad.
