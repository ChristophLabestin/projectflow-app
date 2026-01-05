# Theming System

The application supports Light and Dark modes using CSS variables.

## How it works
- The `<html>` tag receives a class `class="dark"` when dark mode is active.
- Variables are defined in `:root` (Light Mode default).
- Variables are overridden in `html.dark` (Dark Mode).

## Adding New Tokens
1. Open `src/styles/_tokens.scss`.
2. Add the variable to `:root`.
   ```css
   --color-new-feature: #ffffff;
   ```
3. Open `src/styles/_themes.scss`.
4. Add the variable override to `html.dark`.
   ```css
   html.dark {
     --color-new-feature: #000000;
   }
   ```

## Usage
In SCSS:
```scss
.my-component {
  background-color: var(--color-new-feature);
}
```
Do NOT use `html.dark .my-component` unless you are doing something that variables cannot solve (e.g. changing background image url).
