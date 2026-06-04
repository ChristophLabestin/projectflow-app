# ProjectFlow Agent Entry

The primary AI working memory for this repository is the ProjectFlow Brain.

## Read First

1. [brain/README.md](./brain/README.md)
2. [brain/current-focus.md](./brain/current-focus.md)
3. [brain/handoff.md](./brain/handoff.md)
4. [brain/agent-operating-manual.md](./brain/agent-operating-manual.md)

## Quick Context

ProjectFlow is a multi-tenant project management app for project execution, structured ideation through Flows, optional operational modules, permissions, AI assistance, and Codex session tracking.

## Key Rules

- Web app: React, TypeScript, Vite under `web/`.
- Styling: SCSS only, use `web/styles/_tokens.scss` and [brain/reference/app/STYLING.md](./brain/reference/app/STYLING.md).
- Components: prefer reusable components and update [brain/reference/app/COMPONENTS.md](./brain/reference/app/COMPONENTS.md).
- Routes: keep routing centralized and update [brain/reference/app/SITEMAP.md](./brain/reference/app/SITEMAP.md).
- i18n: no hardcoded user-facing strings; use `web/locales/en.ts` and `web/locales/de.ts`.
- Permissions and product rules: follow [brain/reference/app/PERMISSIONS.md](./brain/reference/app/PERMISSIONS.md) and [brain/reference/app/APP_CONCEPT.md](./brain/reference/app/APP_CONCEPT.md).

See [brain/commands-and-environment.md](./brain/commands-and-environment.md) for build, test, deploy, and ProjectFlow tracking commands.
