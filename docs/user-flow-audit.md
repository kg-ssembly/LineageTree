# User Flow Audit

## Scope

This audit covers the active user-facing flows reachable from the current app entry point:

- auth entry (`Login`, `SignUp`)
- post-auth main workspace (`Main`)
- no-tree onboarding gate
- all six main tabs
- drill-down screens (`PersonProfile`, `TreeDetail`)

Assumptions:

- "Every possible flow" means every distinct user journey family in the current app, not every single field-level variation.
- Repeated CRUD actions on different records are grouped into one flow family.

## Flow Map

### 1. Unauthenticated flows

| Flow | Entry | Branches / outcomes |
| --- | --- | --- |
| Sign in | `Login` screen | Valid credentials -> `Main`; invalid credentials -> inline/snackbar error |
| Forgot password | `Login` screen | Registered email -> reset notice; unknown email -> "not registered" notice |
| Sign up | `SignUp` screen | Success -> authenticated session in `Main`; validation/auth failure -> error |
| Switch auth mode | `Login` / `SignUp` | Navigate between sign-in and sign-up |

### 2. Post-auth startup flows

| Flow | Entry | Branches / outcomes |
| --- | --- | --- |
| Auth bootstrap | app launch with saved session | Load user, sync trees, then route to `Main` |
| Release/startup prompt | first launch after unseen app version | Dismiss -> mark version seen |
| Discoverability prompt | owner has trees needing discoverability choice | Choose per-tree discoverability or dismiss after recording prompt seen |
| Tree selection bootstrap | authenticated user with trees | Default/selected tree resolves -> main tabs; no tree -> no-tree gate |

### 3. No-tree flows

| Flow | Entry | Branches / outcomes |
| --- | --- | --- |
| Start own family tree | no-tree gate | Create tree -> optional default tree assignment -> main workspace |
| Search for discoverable tree | no-tree gate request dialog | Search by surname/tree name -> request access to result |
| Direct access request | no-tree gate request dialog | Enter username/email/tree ID -> request access |
| Review pending access request | no-tree gate pending state | Open request details |
| Cancel pending access request | no-tree gate pending state | Cancel request -> return to clean no-tree state |
| Similar tree warning on create | tree creation | Request access to matching discoverable tree or create anyway |

### 4. Main tab flows

#### Home

| Flow | Branches / outcomes |
| --- | --- |
| Overview dashboard | Setup-oriented state vs established tree state |
| Highlights view | Family highlights panel and attention summaries |
| Activity view | Embedded notifications/activity feed |
| Suggested actions | Open person edit/profile, add family member, add relationships, open approvals/merges |

#### Notifications

| Flow | Branches / outcomes |
| --- | --- |
| Open notification feed | Attention vs done filters |
| Open direct notification | Marks opened; modal shows full message |
| Accept/dismiss merge invite | Update invitation status |
| Approve/reject tree access request | Owner responds from notification modal |
| Open approval target | Jump to Tree Settings approvals tab |
| Open merge target | Jump to Tree Settings merges tab |
| Mark seen / mark opened / mark actioned | Updates feed state |
| Delete single notification | Removes one item |
| Delete all notifications | Clears direct notifications and derived activity items |

#### Tree visualization

| Flow | Branches / outcomes |
| --- | --- |
| Open tree canvas | Empty-state guidance vs rendered tree |
| Tap person node | Open quick actions |
| Navigate by family cluster | Switch active surname family when applicable |

#### Members

| Flow | Branches / outcomes |
| --- | --- |
| Browse members | Paginated list |
| Search members | Full-text filter across names/details |
| Filter members | Gender, presence, notes, parents, children, spouse, birth-date range |
| Open person profile | Drill into selected member |
| Add person | Launch add-person flow from members tab |

#### Tree settings

| Flow | Branches / outcomes |
| --- | --- |
| Overview | Tree metrics, self-linking, tree-level guidance |
| Collaborators | Add collaborator, remove collaborator, owner relinking |
| Approvals | Review pending approval requests, approve, reject |
| Merges | Preview merge, create merge request, review incoming merge requests, invite collaborator by identifier, request access to another tree, accept merge invites |
| Trees | Create tree, rename tree, delete tree, switch tree, toggle default tree |
| Tree configuration | Discoverability, approval window, kinship system, surname variants |
| Create surname branch tree | Spawn surname-based connected tree from maiden-name suggestions |

#### My profile

| Flow | Branches / outcomes |
| --- | --- |
| Biography | View and edit own linked person details |
| Relationships | Add/edit/remove relationships tied to own profile |
| Memories | Manage life events, notes, photos |
| Descendants / ascendants | Read lineage views from own linked profile |
| App settings | Language/theme/preferences and sign out |

### 5. Cross-screen creation/editing flows

| Flow | Branches / outcomes |
| --- | --- |
| Add first family member | Creates first person in tree |
| Add person with relationship | Create as parent/child/spouse of an existing person |
| Add self profile | Create and link current user to a person |
| Edit person | Update biography, dates, notes, life events, preferred photo |
| Delete person | Direct delete or approval-driven delete depending on policy |
| Create relationship | Parent-child or spouse |
| Edit relationship | Update spouse status / parent-child kind |
| Delete relationship | Direct delete or approval-driven delete depending on policy |
| Maiden-tree suggestion flow | Open connected/suggested surname tree or request access |

### 6. Drill-down flows

#### Person profile

| Flow | Branches / outcomes |
| --- | --- |
| Open biography | View person summary/details |
| Open relationships | Inspect insights and relationship actions |
| Open memories/gallery | Manage notes, events, photos |
| Open descendant tree | Visual descendant traversal |
| Open ascendant tree | Visual ancestor traversal |
| Edit person from profile | Update person data in context |
| Add relationship from profile | Attach parent/child/spouse |
| Delete relationship from profile | Remove selected relationship |
| Request maiden-tree access | Search or request related surname tree |

#### Tree detail

| Flow | Branches / outcomes |
| --- | --- |
| Open connected tree detail | View another tree outside the current main selection |
| Browse tree members/tree/settings tabs in detail view | Similar capabilities to main tabs but scoped to opened tree |
| Open maiden-tree viewer | Browse related branch members |
| Return to original tree context | Preserve caller tree bundle / restore previous context |

## Logic Findings

### 1. Direct tree-ID access requests bypass discoverability checks

Severity: High

The searchable request flow correctly blocks access requests to non-discoverable trees, but the direct identifier flow does not.

- `requestAccessToTree` explicitly rejects `discoverable !== true` in [providers/family-tree-access-service.ts](/Users/kgmfubha/WebstormProjects/LineageTree/providers/family-tree-access-service.ts:146).
- `requestAccessFromIdentifier` accepts a tree ID path without the same guard in [providers/family-tree-access-service.ts](/Users/kgmfubha/WebstormProjects/LineageTree/providers/family-tree-access-service.ts:199).

Impact:

- Anyone who learns a private tree ID can still create an access request.
- That undermines the meaning of turning discoverability off.

Recommended fix:

- Apply the same discoverability rule in the direct tree-ID branch, or explicitly rename the feature if private-by-ID requests are intended.

### 2. Accepting a merge invite from Notifications does not open or prepare the merge flow

Severity: High

There are two different accept paths for merge invites:

- In Tree Settings, `handleUseMergeInvite` loads the merge preview first, then accepts the invite in [app/screens/tree-tabs/tree-settings/merges-section.tsx](/Users/kgmfubha/WebstormProjects/LineageTree/app/screens/tree-tabs/tree-settings/merges-section.tsx:82).
- In Notifications, the accept button only calls `onRespondToMergeInvite(..., 'accepted')` in [app/screens/tree-tabs/notifications/notifications-view.tsx](/Users/kgmfubha/WebstormProjects/LineageTree/app/screens/tree-tabs/notifications/notifications-view.tsx:772).

Impact:

- A user can "accept" a merge invite from Notifications and still not land in a usable review flow.
- The action confirms intent but does not move the user toward completing the merge.

Recommended fix:

- Make the Notifications accept path mirror the Tree Settings path: load preview, route to merges, then mark accepted.

### 3. Direct username/email access requests can target the wrong tree when an owner has multiple trees

Severity: Medium

When a requester uses a username or email, the system silently resolves one owned tree:

- default tree if present
- otherwise the most recently updated owned tree

That logic lives in [providers/family-tree-access-service.ts](/Users/kgmfubha/WebstormProjects/LineageTree/providers/family-tree-access-service.ts:41).

Impact:

- The requester may intend one tree, while the owner receives a request for another.
- This is especially risky once a user owns multiple branches or surname trees.

Recommended fix:

- If multiple candidate trees exist, return a chooser instead of auto-picking one.

### 4. Merge invites have no duplicate-pending protection

Severity: Medium

Tree access requests are deduplicated through `ensureNoPendingTreeAccessRequest`, but merge invites are not. `sendMergeInviteByIdentifier` creates a new pending notification every time in [providers/family-tree-access-service.ts](/Users/kgmfubha/WebstormProjects/LineageTree/providers/family-tree-access-service.ts:485).

Impact:

- Editors can send repeated pending merge invites to the same target user for the same source tree.
- The recipient can get spammed with redundant invites.

Recommended fix:

- Add a pending-invite lookup keyed by `userId + sourceTreeId + requestedByUserId + status`.

### 5. Multiple pending access requests are collapsed into a single visible pending state in the no-tree gate

Severity: Medium

The no-tree gate computes `pendingTreeAccessRequests`, but the UI only renders `pendingTreeAccessRequest` (the first item) for detail and cancel actions in [app/screens/main/main-no-tree-gate.tsx](/Users/kgmfubha/WebstormProjects/LineageTree/app/screens/main/main-no-tree-gate.tsx:222).

Impact:

- A user can have multiple pending requests to different trees, but only one is visible/manageable from that screen.
- The other pending requests effectively disappear from the primary onboarding state.

Recommended fix:

- Render the full pending request list, or at minimum add paging/selection before cancel/open actions.

## Overall Assessment

The app’s top-level flow coverage is strong: auth, no-tree onboarding, tree management, person management, approvals, merges, notifications, and profile drill-downs are all represented. The main gaps are not missing screens, but mismatched behavior between parallel flows that should act the same way.

The highest-value fixes are:

1. close the direct tree-ID discoverability bypass
2. unify merge-invite acceptance behavior across Notifications and Tree Settings
3. stop ambiguous direct access routing when a user owns multiple trees
