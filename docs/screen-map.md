# Screen map

Use this page to trace a visible screen to its route and source files. The canonical visible component name is used in source; route names remain stable for navigation and deep links.

## App entry and main tabs

| What you see | Route / trigger | Main source | Supporting source |
| --- | --- | --- | --- |
| Sign in | Root `Login` | `app/screens/auth/login/login-view.tsx` | `login-controller.tsx`, `index.ts` |
| Create account | Root `SignUp` | `app/screens/auth/sign-up/sign-up-view.tsx` | `sign-up-controller.tsx`, `index.ts` |
| Join a family tree | Root `JoinTree` / `/join/:treeId` | `app/screens/join-tree.tsx` | `app/navigation/app-linking.ts` |
| Home | Main tab `home` / `/home` | `app/screens/tree-tabs/home/home-dashboard-view.tsx` | `home-dashboard-controller.tsx`, `family-welcome.tsx` |
| Notifications | Main tab `notifications` / `/notifications` | `app/screens/tree-tabs/notifications/notifications-view.tsx` | `notifications-controller.tsx` |
| Family tree visualisation | Main tab `tree` / `/tree` | `app/screens/tree-tabs/family-tree/family-tree-view.tsx` | `family-tree-controller.tsx` |
| Family members | Main tab `members` / `/members`; also embedded in Tree Detail | `app/screens/tree-tabs/family-members/family-members-view.tsx` | `shared.ts` |
| Tree settings | Main tab `treeSettings` / `/settings` | `app/screens/tree-tabs/tree-settings/tree-settings-view.tsx` | `tree-settings-controller.tsx`, settings sections |
| My profile | Main tab `myProfile` / `/profile` | `app/screens/my-profile/my-profile-view.tsx` | `my-profile-controller.tsx`, `sections/` |
| Tree detail | Root `TreeDetail` | `app/screens/tree-detail/tree-detail-view.tsx` | `tree-detail-controller.tsx`, `tree-detail-node-quick-actions-dialog.tsx` |
| Person profile | Root `PersonProfile`; opened from member/tree views | `app/screens/person-profile/person-profile-view.tsx` | `person-profile-controller.tsx`, `sections/`, `dialogs/` |

## Common UI locations

- The registered root routes and auth-dependent route list are in `app/navigation/root-navigator.tsx`.
- Main tabs, their labels, icons, and screen component connections are in `app/screens/main/main-tab-navigator.tsx`.
- Deep-link paths are in `app/navigation/app-linking.ts`.
- Main tab behavior and shared dialogs are coordinated in `app/screens/main/main-controller.ts` and `main-view.tsx`.
- Translation keys and their English fallback phrases are in `i18n/keys.ts`; locale dictionaries are in `i18n/locales/`.
- Shared screen components live in `components/`; family tree feature screens live in `app/screens/tree-tabs/`.

## Naming and translation conventions

Keep route IDs stable and descriptive. Name a UI component for what it renders (`FamilyMembersView`); name controllers for the behavior/state they own. Export the same component name through feature indexes rather than introducing display-name aliases.

Use `I18N_KEYS` for UI copy: `t(K.common.searchFamilyMembers)`. For an unfamiliar translated label, run `node scripts/find-ui-location.mjs "visible phrase"`; the helper reports its key and source usages. Direct English strings passed to `t()` are supported for older code but should be migrated when touching that screen.
