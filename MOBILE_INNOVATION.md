# ProjectFlow Mobile Innovation: Feature Concepts

This document outlines mobile-first features designed to leverage native iOS capabilities and on-device sensors, distinct from the web application.

## 1. "Snap-to-Flow" (Vision-to-Text)
**Target:** Ideation & Flows
**Tech:** `AVFoundation` (Camera), `Firebase Storage`, `Gemini Flash` (Backend)

*   **The Problem:** Whiteboard sessions and notebook sketches are hard to digitize.
*   **The Solution:** A dedicated camera button in the "Flows" tab.
    1.  User snaps a photo of a whiteboard/sketch.
    2.  App uploads to Firebase Storage.
    3.  Triggers Cloud Function -> Gemini 1.5 Flash.
    4.  Gemini analyzes the image, extracts text, identifies diagrams, and generates a structured **Flow** description.
    5.  Result: A new Flow card is created with the image attached and AI-generated text.

## 2. Dynamic Island "Focus Keeper"
**Target:** Execution & Tasks
**Tech:** `ActivityKit`, `Live Activities`

*   **The Problem:** Users get distracted after picking a task.
*   **The Solution:** When a task status changes to **"In Progress"**:
    1.  Start a Live Activity.
    2.  **Dynamic Island (Compact):** Shows active task icon + timer.
    3.  **Dynamic Island (Expanded):** Shows Task Title, "Complete" button, and "Blocked" button.
    4.  **Lock Screen:** Persistent view of the current task.

## 3. "Walk & Log" (Voice-to-Issue)
**Target:** Issues & QA
**Tech:** `Speech` (SFSpeechRecognizer) or OpenAI Whisper (via API)

*   **The Problem:** Typing detailed bug reports on a mobile keyboard is tedious.
*   **The Solution:** A "Hold to Record" button on the Issues list.
    1.  User speaks: "There's a layout bug on the dashboard where the graph overlaps the sidebar on mobile."
    2.  App transcribes locally or sends audio to backend.
    3.  AI formats it into:
        *   **Title:** Layout Bug: Dashboard Graph Overlap
        *   **Description:** The graph overlaps the sidebar on mobile devices.
        *   **Priority:** Medium (inferred)

## 4. Interactive Home Screen Widgets
**Target:** Retention & Status
**Tech:** `WidgetKit`, `SwiftUI`

*   **Widget A (Small):** "Focus Score" - A circular gauge showing the health of the pinned project.
*   **Widget B (Medium):** "Today's Plan" - Interactive list of top 3 tasks due today with check buttons (iOS 17+ support).

## 5. Share Sheet Extension ("Save to ProjectFlow")
**Target:** Research & Marketing
**Tech:** `Share Extension`

*   **The Problem:** Inspiration happens in other apps (Safari, Instagram, Photos).
*   **The Solution:** A system-wide Share extension.
    *   **Safari:** "Save Link" -> Creates a Flow or adds to Project Resources.
    *   **Photos:** "Save Image" -> Creates a Flow or attaches to Task.
    *   **Text:** "Save Selection" -> Creates a Note/Task.

## 6. Proximity-Based Project Context (Location)
**Target:** Field Work / Office
**Tech:** `CoreLocation`

*   **The Concept:** If a user defines a "Location" for a project (e.g., a specific office or client site).
*   **The Solution:** When entering that geofence, the App Icon or Widget automatically switches the "Active Tenant/Project" to match the location, reducing navigation time.

---

## Recommended First Implementation
**"Snap-to-Flow"** is the highest value differentiator. It connects the "offline" ideation phase directly to the app's "Flows" feature, utilizing the existing Gemini infrastructure.
