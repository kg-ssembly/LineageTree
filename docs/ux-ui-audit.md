# LineageTree UX improvement audit

## Existing implementation

The app uses Expo/React Native, React Navigation, React Native Paper, Zustand, and Firestore services. Screens already separate controllers from views. Shared shells, theme tokens, translation helpers, person forms, relationship previews, and permission checks should be retained.

The current workspace already includes Home and Notifications in addition to Tree, Members, Settings, and Profile. Mobile uses bottom navigation; desktop web switches to a top navigation bar at 900px. The dashboard already offers setup guidance, family activity, and suggested tasks. The canvas already has surname grouping, preferred photos, pan/pinch gestures, focused people, and rendering optimizations. Member search and filters, self-assignment suggestions, collaborator roles, and approval previews are implemented.

## Changes made

- Kept the existing navigation and warm theme; enlarged desktop navigation targets, added accessible tab names, and constrained long tree titles.
- Constrained shared authentication forms, dashboard content, and member lists on large screens. Authentication was visually checked at 390px, 768px, and 1280px widths.
- Added one reusable empty-state component. Empty tree/member screens now offer Add Family Member for editors and owners, while viewers receive explanatory copy. Member search recovery resets both query and filters.
- Added a contextual relationship action when multiple people have no connections.
- Kept the first recommended dashboard action visible while retaining disclosure of additional actions.
- Expanded canvas zoom from 70–100% to 5–180%, preserving the readable initial focus scale. Added fit-to-screen recovery and labeled person/zoom/fullscreen controls. The fit action covers the currently displayed surname/lineage group, not hidden branches; extremely large groups remain bounded by the minimum scale.
- Increased shared action buttons to a minimum 48px height, allowing content to grow rather than imposing a fixed height. Constrained shared dialogs to a readable desktop width.
- Added visible collaboration permission guidance and labeled collaborator removal controls.
- Added a pending approval count and a deliberate confirmation step containing the change title and description. Existing detailed previews and server-side review authorization remain in place.
- Added explicit cancellation and busy indicators to shared confirmation/invite dialogs. Role selection is disabled while an invitation is being submitted.
- Respected native reduced-motion preferences and labeled authentication fields/password visibility controls.
- Corrected the existing growth-test fixture to use recent dates relative to execution time.

No backend, Firestore schema/rule, dependency, or migration changes were made.

## Verification and remaining checks

- TypeScript checks and all 76 core tests pass.
- Production web export succeeds.
- Changed-source ESLint has no errors; existing dashboard warnings remain. Repository-wide lint is not clean, including errors in generated Functions JavaScript.
- Browser verification reached the sign-in page. No test account was available, so authenticated navigation, mutation flows, approval decisions, native gestures, and native keyboard/safe-area behavior have not been exercised live.
- New short accessibility/control phrases use the existing translation fallback; translations should be reviewed before a multilingual release.

Before release, exercise owner/editor/viewer sessions with empty and populated trees at phone, tablet, and desktop sizes. Check add/edit person, photos and camera, relationship creation/removal, search reset, fit/zoom with a large surname group, approval cancellation/confirmation, invitation submission, and self-assignment. Verify keyboard focus, screen-reader traversal, large text, dark mode, and reduced motion on devices. Test network failure/reconnection against actual Firestore subscriptions; no speculative offline status or optimistic writes were introduced.

Potential later improvements include canvas search-and-jump across surname groups, richer inline approval comparisons, and a dedicated mobile editing sheet. These need an authenticated interaction pass before expanding the existing workflows.

## Visual refinement follow-up

The subsequent polish pass preserves the existing layout and workflows. The active light palette now uses off-white (#F9FBF6), sage surfaces, warm grey text (#514942), and a deeper leaf green (#477B25) for readable white button labels (5.09:1 contrast). Shared card shadows are lighter, nested cards cannot reintroduce shadows, section typography is calmer, member portraits/rows are roomier, and existing forms use consistent rounded outlines. Tabs have softer selected states and web hover feedback. Tree badge placement now clears person names; the Highlights icon uses a supported glyph. Backgrounds now respect dark mode instead of painting white. Toasts have a constrained, rounded presentation.

Live signed-in Chrome review covered desktop Home, Members, and Tree, plus mobile-width Members and Tree. The earlier signed-out limitation was resolved for visual inspection only; no backend mutations were exercised. Native-device and full dark-mode visual testing remain outstanding.
