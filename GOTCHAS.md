# Gotchas Log

Living log of pitfalls, edge cases, and workflow surprises discovered while working in this repo. Add a new entry whenever you hit or learn something worth remembering.

## Format
- `YYYY-MM-DD | Area | Short title` - One sentence describing the gotcha and how to avoid it.

## Log
- `YYYY-MM-DD | Area | Short title` - Description.
- `2026-01-13 | SwiftUI | onChange needs Equatable inputs` - Use `.map(\.id)` or another Equatable projection when observing arrays in `onChange`.
- `2026-01-13 | SwiftUI | Type-check timeouts on large views` - Break large SwiftUI bodies into smaller subviews or use `AnyView` to reduce compiler load.
