# Codex UI Guardrails

Use these rules whenever adding or editing UI in this repo.

## Shared Component Rules

- Before creating any new UI component, check `components/index.ts`, `components/ui`, and `constants/styles.ts`.
- If a screen needs a card, dialog, tab strip, hero, or form input that already exists elsewhere, extend the shared component instead of creating a new one.
- Do not create a new screen-local version of `Card`, `Modal`, `Dialog`, `Input`, `Select`, `Hero`, `TabStrip`, or `Background`.
- If two screens differ only by copy or data shape, use one shared component with props.

## Styling Rules

- Use theme colors from `useTheme()` and tokens from `constants/theme.ts`.
- Prefer shared styles from `constants/styles.ts` before adding new `StyleSheet` groups.
- Do not hardcode heading font weights for standard titles unless the theme variant cannot express the design.
- Reuse the shared background component once extracted; do not redraw separate gradient backdrops per screen.

## Import Rules

- Import shared UI from `components` or `components/ui`.
- Avoid importing `Card`, `Dialog`, `Surface`, and `TextInput` directly in screen files once wrappers exist.
- New wrappers belong in one place and should be re-exported from an index file.

## Extraction Heuristic

Extract a shared component when any of these is true:

- the same layout appears in 2 or more screens
- the same spacing and border treatment appears in 2 or more screens
- the same dialog shell is reused with different content
- the same typography pattern is repeated with copy changes only

## Naming Rules

- Shared primitives go in `components/ui`
- Feature-specific composites stay near the feature
- Avoid suffixes like `New`, `Better`, `Alt`, `V2`, `Updated`

## Review Checklist

- Did this reuse an existing shared component?
- Did this introduce any new raw colors, spacing, shadows, or font weights?
- Did this add another direct `react-native-paper` primitive import in a screen?
- Could this be handled by props on an existing component?

## Recommended ESLint Policy To Add Next

After the canonical components are chosen, add ESLint with rules that:

- forbid direct imports of `Card`, `Dialog`, `Surface`, and `TextInput` in screen files
- forbid new files matching patterns like `*card.tsx`, `*modal.tsx`, `*dialog.tsx` inside screen folders unless explicitly allowed
- flag raw color literals outside theme and token files
- flag `fontWeight` overrides on `Text` in screen files unless explicitly allowed
