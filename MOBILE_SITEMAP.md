# Atomic Mobile Sitemap & Deep Functional Parity Index

This document provides a component-level breakdown of the ProjectFlow iOS application compared to the Web App. It serves as the definitive guide for achieving "Zero-Difference" between platforms.

## **Parity Legend**
- `✅` **Full Parity**: UI density, interaction patterns, and data logic match exactly.
- `!` **Partial Parity**: Feature exists but lacks depth (e.g., missing specific fields, no drag-drop).
- `X` **No Parity**: Component or logic is entirely missing.
- `📱` **Mobile Exclusive**: Native innovation exceeding web capabilities.

---

## 1. Authentication & Onboarding
| Component Scope | Web Depth | Mobile Parity | Technical Detail / Gaps |
| :--- | :--- | :---: | :--- |
| **Login Flow** | Multi-tenant selector, MFA, Passkeys. | `✅` | Full support for TOTP, Passkey, and Workspace Switcher. |
| **Registration** | Wizard: Plan -> Workspace -> Invite. | `✅` | Full multi-step onboarding wizard implemented. |
| **Password Reset** | In-app token handling. | `✅` | Triggered in-app; full parity. |
| **Plan Selection** | Tier comparisons (Starter/Pro/Org). | `✅` | Integrated into Onboarding Wizard. |

---

## 2. Dashboard (Workspace Home)
| Component Scope | Web Depth | Mobile Parity | Technical Detail / Gaps |
| :--- | :--- | :---: | :--- |
| **Health Trends** | Interactive Line charts (last 30 days). | `✅` | `SwiftUI Charts` with `AreaMark` & `LineMark`. |
| **Project Status** | Donut chart with status breakdown. | `✅` | Sector-based status distribution chart. |
| **Quick Stats** | Tappable cards: Tasks, Issues, Flows. | `✅` | Dynamic sync from `DashboardStore`. |
| **Pinned Items** | Global list of items across projects. | `✅` | Real-time sync with `PinnedTasksStore`. |
| **Ambient Focus** | Current focus visible outside the app. | `📱` | App Group snapshot powers local reminders, Focus/Today widgets, and Focus Keeper Live Activity. |
| **Recent Activity** | Global feed of all workspace events. | `✅` | Tappable cards leading to details. |

---

## 3. Project Overview Index
| Component Scope | Web Depth | Mobile Parity | Technical Detail / Gaps |
| :--- | :--- | :---: | :--- |
| **Branding Header** | Cover images, custom icons, gradients. | `✅` | Parity on `AsyncImage` covers & dynamic icons. |
| **Dynamic Widgets** | Draggable grid of 8+ widget types. | `✅` | **Drag-to-reorder** implemented natively. |
| **Health Snapshot** | 100-point score, trend icon, drivers. | `✅` | Full parity on health logic via `HealthService`. |
| **Team Strip** | Presence indicators, avatar stack. | `✅` | Full parity including online/busy status. |
| **AI Insights** | CORA Executive Summary (PDF/Text). | `✅` | Full parity using `generateReport` cloud logic. |
| **Modules Gate** | Conditional UI based on enabled modules. | `✅` | Correctly hides/shows Social, Issues, etc. |

---

## 4. Execution Components (Tasks & Issues)
| Component Scope | Web Depth | Mobile Parity | Technical Detail / Gaps |
| :--- | :--- | :---: | :--- |
| **Task Boards** | Full Kanban (Drag-drop columns). | `✅` | Paginated Kanban Board with rich cards. |
| **Task Detail** | Subtasks, Dependencies, Links, Labels. | `✅` | Subtasks and Labels matching web depth. |
| **Task Editor** | Custom fields, multi-assignee. | `✅` | **Multi-Assignee** picker implemented. |
| **Issue Triage** | Impact matrix, Severity, Tech linkage. | `✅` | Status/Priority/Assignee parity. |
| **Issue Resolution** | Conversion to Task, Link to Flow. | `✅` | Strategic advance logic implemented. |

---

## 5. Strategic Components (Flows & CORA)
| Component Scope | Web Depth | Mobile Parity | Technical Detail / Gaps |
| :--- | :--- | :---: | :--- |
| **Capture (Mobile)** | Text only. | `📱` | **Snap-to-Flow**: Camera + Vision OCR to Flow. |
| **Stage Tools** | Brainstorm (Keywords), SWOT, Concept. | `✅` | Real Gemini 1.5/3.0 integration per stage. |
| **SWOT Tool** | Interactive 4-quadrant edit. | `✅` | AI-generated SWOT with quadrant visualization. |
| **PRD Concept** | Full Markdown editor + AI Drafter. | `✅` | Full parity on AI drafting and Markdown preview. |
| **Handoff** | Approve -> Convert to Task/Initiative. | `✅` | Logic parity via `convertToTask` service. |

---

## 6. Workspace & Collaboration
| Component Scope | Web Depth | Mobile Parity | Technical Detail / Gaps |
| :--- | :--- | :---: | :--- |
| **Member Mgmt** | Bulk invites, Groups, granular roles. | `✅` | Email invites + **Group Management** added. |
| **Presence** | Typing indicators, active view list. | `✅` | Online/Busy/Idle status parity. |
| **Media Library** | AI Generation, Unsplash, Folder structure. | `!` | Project-specific assets works; global studio pending. |
| **Notifications** | Push, Email, In-app, Browser alerts. | `✅` | Full parity on native Push & Deep Linking. |
| **Share Sheet Capture** | Quick capture from any app. | `📱` | Native share extension queues text/URLs and imports them as private personal tasks when ProjectFlow activates. |

---

## 7. Configuration & Developer Tools
| Component Scope | Web Depth | Mobile Parity | Technical Detail / Gaps |
| :--- | :--- | :---: | :--- |
| **Design System** | Atomic CSS Variables. | `✅` | `PFColors` mapping 1:1 to SCSS Tokens. |
| **i18n** | Multi-language runtime switching. | `✅` | `PFLocalization` matches `en.ts` / `de.ts`. |
| **Offline Sync** | 50MB Persistent Cache. | `✅` | Native Firestore Persistence layer. |
| **Theme Toggle** | System, Light, Dark, Moss, Tide. | `✅` | Support for System/Light/Dark themes. |

---

## **Roadmap to Zero-Difference (Remaining Tasks)**

### **Phase 4: Advanced Administrative Features**
- [ ] **Billing Detail**: Viewing invoices and specific usage quotas.
- [ ] **Role Matrix**: UI to change granular permissions per group.
- [ ] **Audit Log**: Viewing a history of workspace-level changes.

### **Phase 5: Global AI Hub**
- [ ] **CORA Lab**: Launching the standalone AI studio hub.
- [ ] **Global Media Library**: Native picker for tenant-wide assets.
