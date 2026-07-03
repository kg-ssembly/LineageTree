# UI Audit And Migration Plan

## Current State

The duplicate profile components identified below have been merged into `app/screens/profile-shared`, and the redundant wrapper files were removed.

This app already has a shared theme in [constants/theme.ts](/Users/kgmfubha/WebstormProjects/LineageTree/constants/theme.ts) and a shared style bucket in [constants/styles.ts](/Users/kgmfubha/WebstormProjects/LineageTree/constants/styles.ts), but the UI layer has drifted in three ways:

1. True duplicate files exist for the same feature in `my-profile` and `person-profile`.
2. Shared primitives are imported directly from `react-native-paper` in many screen files instead of through local wrappers.
3. Similar layouts are implemented separately with different style groups (`treeDetail`, `personProfile`, `home`, and screen-local `StyleSheet`s).

## Confirmed Duplicate Components

### File-level duplicates (merged)

- `app/screens/my-profile/dialogs/photo-viewer-modal.tsx`
- `app/screens/person-profile/dialogs/photo-viewer-modal.tsx`
- `app/screens/my-profile/dialogs/notes-dialog.tsx`
- `app/screens/person-profile/dialogs/notes-dialog.tsx`
- `app/screens/my-profile/sections/relationships-section.tsx`
- `app/screens/person-profile/sections/relationships-section.tsx`
- `app/screens/my-profile/sections/memories-section.tsx`
- `app/screens/person-profile/sections/memories-section.tsx`
- `app/screens/my-profile/sections/lineage-section.tsx`
- `app/screens/person-profile/sections/lineage-section.tsx`
- `app/screens/main/main-node-quick-actions-dialog.tsx`
- `app/screens/tree-detail/tree-detail-node-quick-actions-dialog.tsx`

### Duplicate patterns, not yet extracted

- Navigation tab-strip cards are built in multiple places:
  - `home-dashboard-view.tsx`
  - `my-profile` sections
  - `person-profile-view.tsx`
  - `tree-settings-view.tsx`
- Section cards are styled in multiple families:
  - `GlobalStyles.treeDetail.sectionCard`
  - `GlobalStyles.personProfile.sectionCard`
  - several inline `Card` and `Surface` blocks
- Hero cards exist in separate variants:
  - `my-profile/sections/profile-hero-section.tsx`
  - `person-profile/person-profile-view.tsx`
  - `main-no-tree-gate.tsx`
- Dialog chrome is partly standardized via `GlobalStyles.dialogChrome`, but many dialog bodies remain screen-specific.

## Likely Root Causes Of The Issues You Called Out

### 1. Navigation cards are inconsistent

Root cause:
- different screens use different bases for similar navigation surfaces
- some use `profileStyles.tabStripCard`
- some use `treeDetail.sectionCard`
- `tree-settings-view.tsx` defines its own `settingsTabStripStyles`
- `person-profile-view.tsx` has a custom floating bottom nav that does not reuse main tab styles

### 2. Background circle gradients are missing outside the main screen

Root cause:
- the radial background exists only in `app/screens/main/main-view.tsx`
- auth, profile, tree detail, and settings screens use plain background colors
- there is no reusable `ScreenBackground` or `GradientBackdrop` component

### 3. Title fonts feel inconsistent

Root cause:
- theme typography is configured centrally in `constants/theme.ts`
- some screens rely on variants only
- some add manual overrides like `fontWeight: '800'`
- some use `headlineMedium`, others `headlineSmall`, others `titleLarge` for visually similar headings
- `root-navigator.tsx` also hardcodes header title weight/size

### 4. Shared UI is bypassed

Root cause:
- `react-native-paper` primitives are imported directly in many screens
- the repo has a shared exports file at `components/index.ts`, but it only re-exports custom components, not canonical UI primitives or wrappers
- there is no single `components/ui` layer

## Canonical Candidates To Reuse

These are the best current candidates if you want the smallest migration cost.

### Cards and section shells

Recommended candidate:
- `GlobalStyles.personProfile.sectionCard`

Why:
- more polished spacing than `treeDetail.sectionCard`
- already used by the newer `person-profile` experience
- pairs well with `heroCard`, `tabStripCard`, and biography blocks

Alternative:
- `GlobalStyles.treeDetail.sectionCard`

Why pick it instead:
- already used heavily across home, tree detail, and tree settings
- lower short-term migration effort for tree-related screens

### Tab strip / navigation surface

Recommended candidate:
- `GlobalStyles.personProfile.tabStripCard` plus `HorizontalTabStrip`

Why:
- already extracted
- cleaner than `settingsTabStripStyles`
- reusable across home, settings, and profile screens

### Dialog shell

Recommended candidate:
- `GlobalStyles.dialogChrome`

Why:
- already shared
- used across most dialogs
- should become the required wrapper for all new dialogs

### Background gradients

Recommended candidate:
- extract `MainBackground` from `app/screens/main/main-view.tsx` into a shared component

Why:
- it already implements the circle/radial look you want
- it can become a reusable backdrop for auth, profile, tree detail, and home

### Typography

Recommended candidate:
- keep `constants/theme.ts` as the single typography source
- treat these as the approved headline scale:
  - `displaySmall` for auth hero only
  - `headlineMedium` for hero identity/name
  - `headlineSmall` for top-level section intros
  - `titleLarge` for section titles
  - `titleMedium` for card titles

## Migration Plan

### Phase 1. Pick the canonical design family

Choose one:

1. `personProfile` as canonical base
2. `treeDetail` as canonical base
3. hybrid: `personProfile` for people/profile surfaces, `treeDetail` for operational/admin surfaces

### Phase 2. Extract a shared UI layer

Create:

- `components/ui/ScreenBackground.tsx`
- `components/ui/SectionCard.tsx`
- `components/ui/HeroCard.tsx`
- `components/ui/AppTabStrip.tsx`
- `components/ui/AppDialog.tsx`
- `components/ui/FormTextInput.tsx`

Then re-export all of them from:

- `components/ui/index.ts`
- `components/index.ts`

### Phase 3. Remove true duplicates first

Best first merges:

1. merge both `photo-viewer-modal.tsx` files
2. merge both `notes-dialog.tsx` files
3. merge both `lineage-section.tsx` files
4. merge both `relationships-section.tsx` files
5. merge both `memories-section.tsx` files
6. merge both node quick action dialogs

### Phase 4. Replace direct primitive usage

Priority targets:

- `Card`
- `Dialog`
- `TextInput`
- `Surface`

Current spread:

- `Card` imported directly in 11 files
- `Dialog` imported directly in 25 files
- `TextInput` imported directly in 23 files
- `Surface` imported directly in 17 files

### Phase 5. Unify design tokens

Move toward:

- no raw shadow values outside shared card wrappers
- no repeated border radius literals for shared surfaces
- no heading `fontWeight` overrides where theme variants already define weight
- no screen-local background implementations for standard screens

## Suggested Import Direction

Target shape after refactor:

- screens import from `components` or `components/ui`
- only wrapper components import from `react-native-paper` for shared primitives
- feature screens stop defining their own shared-card chrome

## What To Decide Before I Refactor

Please pick one of these:

1. Reuse the newer `person-profile` look as the canonical style system.
2. Reuse the broader `treeDetail` look as the canonical style system.
3. Keep the current palette but merge only functional duplicates first.

If you want, I can do the refactor in that order next:

1. extract `ScreenBackground`
2. merge duplicate profile/dialog files
3. add `components/ui` wrappers
4. update imports
5. add lint rules
