# Mobile App Feature Comparison & Parity Report

**Date:** January 21, 2026
**Scope:** Comparison between ProjectFlow Web App (React) and Mobile App (iOS/SwiftUI).

## 1. Executive Summary

The ProjectFlow iOS application provides a solid foundation for on-the-go management, covering core entities like Projects, Tasks, Issues, and Flows. It implements the "Spotlight" and "Focus" concepts effectively, matching the web app's recent strategic shifts.

Recent updates have significantly closed the interactivity gap by introducing Kanban boards, filtering, and inline actions.

## 2. Page Inventory

### Mobile App (SwiftUI)
*   **Dashboard:** `DashboardView.swift`
*   **Projects:** `ProjectsView.swift`
*   **Project Details:** `ProjectOverviewView.swift`
*   **Tasks:** `TasksView.swift`
*   **Issues:** `IssuesView.swift`
*   **Flows:** `FlowsView.swift`
*   **Notifications:** `NotificationsView.swift`
*   **Login:** `LoginView.swift`
*   **Settings:** `SettingsView.swift`

### Web App (React)
*   **Dashboard:** `Dashboard.tsx`
*   **Projects:** `ProjectsList.tsx`
*   **Project Overview:** `ProjectOverview.tsx`
*   **Tasks:** `ProjectTasks.tsx` (List & Board)
*   **Issues:** `ProjectIssues.tsx`
*   **Flows:** `ProjectFlows.tsx` (List & Board)
*   **Notifications:** `Notifications.tsx`
*   **Login:** `Login.tsx`
*   **Marketing/Social:** Complete modules (Missing in Mobile)
*   **Onboarding:** Tour components (Missing in Mobile)

## 3. Feature Comparison Matrix

| Feature Area | Mobile Page | Web Page | Parity | Mobile Gaps | Web Parity Gaps | Improvement Suggestions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `DashboardView` | `Dashboard.tsx` | Partial | **Missing Trend Chart (Sparklines), Donut Chart**, Calendar Widget, Risk Section. | None | **NEXT:** Implement `Swift Charts` for trends. Add a horizontal calendar strip. |
| **Projects List** | `ProjectsView` | `ProjectsList.tsx` | **High** | Templates, JSON Import. | None | Add "Create from Template" flow. |
| **Project Overview** | `ProjectOverviewView` | `ProjectOverview.tsx` | **High** | Drag & drop layout customization. | None | Layout customization is lower priority for mobile. |
| **Tasks** | `TasksView` | `ProjectTasks.tsx` | **High** | Bulk actions. | None | **COMPLETED:** Kanban Board, Filter/Sort Sheet, Search. |
| **Flows** | `FlowsView` | `ProjectFlows.tsx` | **High** | AI Generation. | None | **COMPLETED:** Kanban Board, Pipeline Tabs, Search. |
| **Issues** | `IssuesView` | `ProjectIssues.tsx` | Medium | **Stats grid (Active/Resolved counts)**. Richer list items. | None | **NEXT:** Add a summary stats header. Improve list row visual density. |
| **Notifications** | `NotificationsView` | `Notifications.tsx` | **High** | None. | None | **COMPLETED:** Accept/Decline Invites, Clear All, Mark All Read. |
| **Auth** | `LoginView` | `Login.tsx` | High | Social Login (Google/Github buttons). | None | Add "Sign in with Google/Apple" native buttons. |
| **Marketing** | *N/A* | `Marketing/*` | No | Entire module. | N/A | Consider if this is needed on mobile. Maybe read-only stats? |
| **Social** | *N/A* | `Social/*` | No | Entire module. | N/A | "Create Post" on mobile would be high value. |

## 4. Detailed Gap Analysis & Improvement Areas

### A. Dashboard & Visuals
The Web Dashboard is visually rich with data density. The Mobile Dashboard is list-heavy.
*   **Missing:** The 30-day trend line (Tasks/Flows/Issues) is a key visual anchor on Web (`Dashboard.tsx`).
*   **Missing:** "Projects at Risk" section which drives attention to critical health scores.
*   **Improvement:** Use Apple's Swift Charts framework to render the trend line. Create a horizontal scroll section for "At Risk" projects.

### B. Task & Flow Management (The "Board" Gap)
*   **Status:** **RESOLVED**.
*   **Update:** Horizontal paging Kanban boards have been implemented for both Tasks and Flows, along with filtering and pipeline selection.

### C. Project Overview interactivity
*   **Status:** **IMPROVED**.
*   **Update:** Inline task completion has been added to the Project Overview execution list.

### D. Interactivity in Lists
*   **Status:** **IMPROVED**.
*   **Update:** Checkmark buttons added to task lists.

### E. Social & Marketing (Strategic Omission?)
These modules are completely absent.
*   **Opportunity:** Mobile is the perfect place for **Social Media**. Users might want to upload a photo from their phone to a Social Post draft.
*   **Recommendation:** Implement a simplified "Social" tab allowing users to view the content calendar and upload assets/draft posts.

## 5. Prioritized Roadmap

1.  **Quick Wins (High Impact / Low Effort):**
    *   ✅ **Inline Task Completion:** Add checkboxes to `ProjectOverviewView` task list.
    *   ✅ **Notification Actions:** Allow Accepting/Declining invites directly in `NotificationsView`.
    *   ✅ **Filter/Sort:** Add a filter sheet to `TasksView` and `IssuesView` to match Web's control bar.

2.  **Core Feature Parity (Medium Effort):**
    *   ✅ **Kanban View:** Implement a board view for Flows and Tasks (horizontal paging columns).
    *   **Visual Charts:** Add Swift Charts to Dashboard for Trends and Health.
    *   **Issues Stats:** Add summary cards to the Issues view.

3.  **Mobile-First Enhancements (High Value):**
    *   **Social Media Module:** Create a "Quick Post" feature for the Social module.
    *   **Snap-to-Flow:** Camera integration for whiteboard capture (See `brain/reference/app/MOBILE_INNOVATION.md`).