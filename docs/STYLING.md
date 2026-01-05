# Styling Guide (SCSS)

## Architecture
The styling system is built on SCSS and CSS Modules principles (though currently global SCSS).

### Directory Structure
```
src/styles/
├── main.scss        # Global entry point
├── _tokens.scss     # CSS Variables (Colors, Fonts, Spacing)
├── _themes.scss     # Light/Dark mode overrides
├── _mixins.scss     # Sass Mixins (Breakpoints, etc.)
├── _utilities.scss  # Helper classes (flex, text-*, etc.)
├── _components.scss # Legacy global components
└── components/      # Component-specific partials
    └── _settings.scss
```

## Tokens & Theming
We use CSS variables for theming.
- **Usage**: `var(--color-primary)`, `var(--radius-lg)`
- **Definition**: Defined in `_tokens.scss`.
- **Dark Mode**: Overrides are in `_themes.scss` under `html.dark`.

**Rule**: NEVER hardcode colors like `#171717`. Always use a token.

## Class Naming
- **Utilities**: Kebab-case, mimic standard CSS properties or Tailwind-like for familiarity (e.g., `p-4`, `flex`, `hidden`).
- **Components**: BEM-ish.
    - Block: `.settings-modal`
    - Element: `.settings-nav-item`
    - Modifier: `.active`, `.disabled` (chained: `.settings-nav-item.active`)

## Best Practices
1. **Mobile First**: Default styles are mobile. Use mixins for desktop.
   ```scss
   .foo {
     padding: 10px;
     @include mixins.mq('md') {
       padding: 24px;
     }
   }
   ```
2. **Nesting**: Avoid deep nesting (max 3 levels).
3. **Imports**: All partials must be imported in `main.scss`.

## Common patterns
- **Flexbox**: Use `@include mixins.flex-center` or `.flex` utility.
- **Text**: Use `.text-muted`, `.h1`, etc.
