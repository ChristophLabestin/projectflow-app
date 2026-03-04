# ProjectFlow - AI Agent Context Guide

This document serves as the primary context source for AI agents working on the ProjectFlow repository. It summarizes the project architecture, tech stack, development workflows, and strict coding conventions.

## 1. Project Overview
**ProjectFlow** is a multi-tenant project management application designed for B2B software teams and freelancers. It combines execution (tasks/issues) with structured ideation (Flows) and supports optional modules like Social, Marketing, and Accounting.

*   **Core Value:** Unified workspace for ideation and execution.
*   **Target Audience:** Product teams, engineering, marketing, freelancers.
*   **Key Features:** Multi-tenancy, Flows (structured pipelines), Modular Project configuration, Media Library, AI-powered features (Gemini).

## 2. Architecture & Tech Stack

The project is a monorepo containing a Web App, Cloud Functions, and an iOS Client.

### **Web Application (`/web`)**
*   **Framework:** React 19 (Vite)
*   **Language:** TypeScript
*   **Styling:** SCSS with CSS Modules approach (BEM-ish) and **strict Design Tokens**. **NO Tailwind.**
*   **State/Data:** Firebase SDK (Firestore, Auth, Storage).
*   **Key Libs:** `@tiptap` (Rich Text), `framer-motion` (Animations), `lucide-react` (Icons), `react-router-dom`, `date-fns`.
*   **Routing:** React Router v6.

### **Backend (`/functions`)**
*   **Runtime:** Node.js 22 (Firebase Cloud Functions 2nd Gen recommended).
*   **Language:** TypeScript.
*   **Key Libs:** `firebase-admin`, `firebase-functions`, `@google/genai` (Gemini API), `nodemailer`.
*   **Role:** Handles complex business logic, AI operations, email, and heavy lifting not suitable for the client.

### **iOS Application (`/swift`)**
*   **Language:** Swift.
*   **Framework:** SwiftUI (inferred).
*   **Role:** Native mobile companion app.

## 3. Directory Structure

*   `web/` - The main React application.
    *   `src/` - Source code (legacy structure mixed with root-level folders).
    *   `components/` - Reusable UI components (buttons, modals, etc.).
    *   `screens/` - Page-level components (routes).
    *   `styles/` - Global styles and **`_tokens.scss`** (The Single Source of Truth for design).
    *   `locales/` - I18n dictionaries (`en.ts`, `de.ts`). **No hardcoded text allowed.**
    *   `services/` - Firebase interactions and API calls.
    *   `context/` - React Context providers (Auth, Theme, etc.).
*   `functions/` - Firebase Cloud Functions.
    *   `src/` - Source code.
*   `swift/` - Native iOS project.
*   `docs/` - Additional documentation.

## 4. Development Workflow

### **Web App**
*   **Install:** `cd web && npm install`
*   **Dev Server:** `cd web && npm run dev`
*   **Build:** `cd web && npm run build`
*   **Lint Theme:** `cd web && npm run lint:theme` (Checks for invalid token usage)
*   **Deploy:** `cd web && npm run deploy`

### **Cloud Functions**
*   **Install:** `cd functions && npm install`
*   **Build:** `cd functions && npm run build`
*   **Emulate:** `cd functions && npm run serve`
*   **Deploy:** `cd functions && firebase deploy --only functions` (Or specific function: `firebase deploy --only functions:functionName`)

### **iOS App**
*   **Build:** `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build`

## 5. Critical Conventions & Rules

### **Styling (Strict)**
*   **DO NOT use hardcoded hex codes.** You MUST use variables from `web/styles/_tokens.scss`.
*   **DO NOT use Tailwind CSS.**
*   **Structure:** Co-locate `.scss` files with their components (e.g., `screens/Dashboard.tsx` uses `screens/dashboard.scss`).

### **Internationalization (Strict)**
*   **DO NOT hardcode user-facing text.**
*   All text must be added to `web/locales/en.ts` (and `de.ts` if possible) and accessed via the translation hook.

### **Code Style**
*   **Imports:** Group imports logically.
*   **Naming:** PascalCase for Components, camelCase for functions/vars.
*   **Comments:** Explain *WHY*, not *WHAT*.

### **Documentation**
*   **Update Docs:** If you add a route, component, or style, update `SITEMAP.md`, `COMPONENTS.md`, or `STYLING.md` respectively.
*   **Gotchas:** detailed issues or quirks go in `GOTCHAS.md`.

## 6. Key Documentation References

*   `AGENTS.md` - Meta-instructions for AI agents.
*   `APP_CONCEPT.md` - The Product "Bible" (Scope, Entities, Roles).
*   `STYLING.md` - Comprehensive guide to the design system and tokens.
*   `AI_AGENT_INSTRUCTIONS.md` - General instructions.
*   `GOTCHAS.md` - Known issues and workarounds.

## 7. AI & Gemini Integration
The project uses Gemini 3.0 Flash for text and Gemini 3.0 Flash Nano Banana for images. All AI logic resides in Cloud Functions (`functions/`).
