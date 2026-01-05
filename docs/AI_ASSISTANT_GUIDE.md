# AI Assistant Guide: Styling Migration

This guide outlines the ongoing migration from Tailwind CSS to a custom SCSS architecture.

## Primary Objective
Remove Tailwind usage progressively and replace it with reusable SCSS classes while preserving the current visual appearance.

## Styling Architecture
We use a modular SCSS architecture located in `src/styles/`:
- `main.scss`: Entry point. Imports everything.
- `_tokens.scss`: Design tokens (Colors, Spacing, Radius, Shadows). Sourced from CSS variables.
- `_themes.scss`: Light/Dark mode variable definitions.
- `_mixins.scss`: SCSS mixins for media queries, etc.
- `_utilities.scss`: Global utility classes (migrated from Tailwind or custom).
- `components/`: Component-specific styles (e.g., `_settings.scss`).
- `_components.scss`: Legacy component styles migrated from `index.css`.

## Migration Workflow
When working on a component (e.g., SettingsModal, Profile):

1. **Analyze Tailwind classes**: Identify patterns in functionality (layout vs visual vs typography).
2. **Check for existing SCSS**:
    - Can you use a utility from `_utilities.scss`? (e.g., `.flex`, `.text-muted`)
    - Is there a component partial? (e.g., `_settings.scss`)
3. **Create/Update SCSS**:
    - If specific to the component, add BEM-style classes to `src/styles/components/_<name>.scss`.
    - If generic, check if `_tokens.scss` has the value, then use it in your new class.
    - **Avoid** adding new global utilities unless strictly necessary.
4. **Refactor JSX**:
    - Replace `className="long tailwind string"` with `className="component-class"`.
    - Use `join` or template literals for dynamic classes: `classNames('component-class', { 'active': isActive })`.
5. **Verify**:
    - Check Light Mode.
    - Check Dark Mode.
    - Ensure responsiveness.

## Definition of Done for a Component
- [ ] No Tailwind utility classes remaining in the JSX.
- [ ] Styles are defined in an appropriate SCSS partial.
- [ ] Responsiveness matches original behavior.
- [ ] Dark mode works correctly (uses CSS variables).

## Current Status
- **Architecture**: Set up.
- **Global Styles**: Switched to `main.scss`. `index.css` removed from HTML.
- **Core Layout**: AppLayout, Sidebar, Header fully migrated.
- **ProjectOverview**: Fully migrated (Overview, Stats, Initiatives, Updates, Resources, Team, Milestones, Controls).
- **ProjectTasks**: Fully migrated (Header, Stats, Controls, Content, TaskCard).
- **Tasks**: Fully migrated (Global Task List).
- **Task Modals**: Fully migrated (Create, Edit, Pinned, Scheduled Widget).
- **Settings**: Fully migrated (SettingsModal, WorkspaceRolesTab).
- **Tailwind**: Still active via CDN (do not remove until migration is complete).

## Next Steps
- Continue refactoring `SettingsModal` sections.
- Refactor `Account`, `Security`, `API` tabs in `SettingsModal`.
- Remove `scripts` block in `index.html` (Tailwind config) once tokens are fully reliable.
- Remove Tailwind CDN once all components are migrated.
