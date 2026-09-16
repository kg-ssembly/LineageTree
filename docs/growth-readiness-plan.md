# LineageTree growth readiness plan

Date: 15 September 2026

Status: Proposed. This document does not implement or deploy changes.

## Objective

Protect family information, make shared changes predictable, and support larger trees without excessive reads, device memory, or background processing costs. Preserve the existing Expo/Firebase architecture and working family workflows.

The September audit was based on source code. Production rules, indexes, migrations, backups, traffic, and billing still need verification. The key findings were checked against this worktree before writing this plan.

## Confirmed decisions and open choices

| Decision | Agreed direction | Effect on implementation |
| --- | --- | --- |
| Who manages collaborators? | Confirmed: editors may manage collaborators and their roles. The owner retains ownership protections. | Align functions, rules, UI, and documentation; protect the owner from removal or demotion. |
| What happens when approval time expires? | Confirmed: automatically approve valid changes. | Only the scheduler invokes automatic decisions; recheck permissions, revisions, and validation before applying. Conflicting or invalid requests need attention. |
| How does a person shared across trees work? | Confirmed: linked profiles with reviewed updates. Each tree keeps its own profile. | Use reviewed identity links and receiving-tree approval for proposed updates; migrate existing canonical records safely. |
| Should new trees be searchable? | Confirmed: searchable summary by default. | Publish only a safe summary to signed-in search; keep family records private and retain an invite-only option. |
| What scale and budget are required? | Confirmed: 1,000 registered users, 200 active users, 1,000 people in the largest tree, 100 collaborators per tree, target R500/month. | Clarify whether active means daily, monthly, or concurrent. Measure usage and price the complete operating cost before promising this budget. |

The active-user time window remains unanswered. Preserve existing private-tree settings during migration; the searchable-summary default applies to newly created trees. Explicitly decide how existing pending approvals are handled before migration.

### Confirmed shared-person behavior

Each tree owns its profile. An accepted identity link allows proposed updates to the other tree. Receiving-tree approval rules apply, including automatic approval on expiry when the proposal remains valid and authorized. Private notes and media require explicit sharing rules. Unlinking or deleting one tree must preserve the other tree's profile and accepted facts.

### Confirmed discoverability behavior

New trees default to a searchable safe summary: signed-in users can find the tree name and owner-approved summary and request access. People, photos, emails, and membership stay private. Invite-only remains available. A public showcase is outside this release plan.

Creation flow: default to Searchable summary, show a clear preview of what is exposed, and offer Invite-only. Discoverability never grants access to private tree records.

During the permission-design phase, confirm contributor rights and review exceptions, including self-profile creation, trees with one member, surname-scoped reviewers, and approvals disabled by an owner. Preserve current behavior until the intended policy is agreed; then enforce it on the server.

## Phase 0: Establish evidence and acceptance targets

1. Inventory actual deployed rules, function versions, indexes, regions, app versions, and membership-migration state.
2. Run the existing validation suite against demo emulators and record the baseline. Investigate failures instead of attributing them to this plan.
3. Create synthetic fixtures with 300, 1,000, and 2,000 people, including wide generations, many memories, and linked trees with overlapping membership.
4. Measure fresh and warm startup, switching trees, opening a profile, pan/zoom, saving, memory use, document reads, and serialized cache size on web and representative Android hardware.
5. Benchmark the confirmed 1,000-person / 100-collaborator tree; distinguish membership count from simultaneous readers and writers. Use 2,000-person fixtures as headroom tests. Clarify the 200-active-user time window, then model sessions, reads, writes, photo traffic, emails, and backups against R500/month. Define numeric timing and memory targets from measured baselines and report median and slow-tail timings.
6. Verify backup coverage for both Firestore and Storage, and restore a sample into an isolated environment.

Deliverable: baseline report, approved permission matrix, workload targets, migration inventory, and recovery procedure.

## Phase 1: Close privacy and authorization gaps

### Private profiles and safe discovery

- Add a separate directory containing only explicitly publishable tree summaries. Exclude emails, membership arrays, assignments, and history.
- Keep users' account documents private. Replace direct user collection searches with authenticated, rate-limited invitation lookup returning minimal information.
- Ensure owner changes and discoverability changes update/remove directory entries reliably. Stale directory entries must never confer access to private records.
- Migrate search and invitation clients before removing their existing read permissions. Include an old-client upgrade strategy.

### Authoritative mutations and approvals

- Route protected family mutations through server functions that derive the actor from authentication, validate payloads, check current membership, and calculate review requirements.
- Separate scheduled approval execution from public decision endpoints. Never trust a caller-supplied automatic-decision flag.
- Let the server create trusted approval payloads and eligibility lists. Make decision status and audit records server-owned.
- Enforce valid relationship endpoints, same-tree or explicitly authorized cross-tree references, duplicate prevention, and cycle checks under concurrency.
- Use operation IDs for repeat-safe submissions and record revisions for conflict detection. Do not depend on device-generated timestamps as the only revision mechanism.
- Deny direct writes that bypass the policy after compatible clients are available.
- Apply the agreed collaborator policy consistently to server functions, rules, UI, and documentation.

### Media permissions

- Restrict upload, replacement, and deletion by role. Viewers must not write media.
- Enforce file size and allowed MIME metadata in Storage rules; validate actual image content in processing where appropriate.
- Use controlled staging for uploads attached to proposals. Users must not delete approved media by invoking proposal cleanup.
- Review photo URL lifetime, access revocation, and reference ownership, especially across linked trees.

Acceptance: emulator tests reject unauthorized reads, viewer media writes, forged approvals, direct policy bypasses, invalid relationships, and calls using another person's identity. Legitimate invitation, editing, and review journeys still pass.

## Phase 2: Make cross-tree records and lifecycle safe

Implement the confirmed linked-profile model and migrate existing shared canonical records into independently authorized tree profiles.

### Selected model: separate records with reviewed links

- Retain one profile per tree and store explicit, reviewed identity links between profiles.
- Treat updates in another tree as proposals with source attribution; prevent automatic propagation loops.
- Keep relationship endpoints local to the tree unless an explicitly designed cross-tree view is used.
- Give each tree control over its own facts, photos, and access. Linking identities must not expose an entire other tree.

### Link and proposal lifecycle

- Require authorized acceptance of identity links; a suggested match alone grants no access.
- Record source and destination revisions and changed fields on proposals. Apply valid proposals through the receiving tree's review policy.
- Recheck active links and permissions before applying; revoked links must not leave actionable cross-tree proposals.
- Suppress duplicate proposals and propagation loops using stable origin operation IDs.
- Keep each tree's accepted facts after unlinking; handle retained media through explicit independent references or copies.

### Migration and deletion

- Audit current canonical links, membership arrays, missing references, and media references using a read-only migration report.
- Create repeat-safe, version-checked migration steps with a dry run, reconciliation counts, and rollback data.
- Prevent original-tree deletion from orphaning shared people or shared media while the migration is pending.
- Implement deletion as a job: mark deleting, reject new mutations, process bounded pages, retry failures, verify completion, then finalize removal.
- Account for notifications, directory entries, assignments, history, trash, and photo references.
- Define retention and permanent-deletion policy before adding automated purges. Distinguish leaving a tree, deleting a tree, unlinking a person, and deleting an account.

Acceptance: test members of A only, B only, and both; revoke access; delete either original tree; interrupt cleanup and retry. Remaining trees keep their authorized people, relationships, and media without gaining unrelated access.

## Phase 3: Make merge and undo safe and bounded

- Generate candidates using normalized names, birth information, and relationship evidence before detailed comparison. Preserve uncertainty and human review.
- Paginate candidate review instead of silently restricting the workflow to a top-25 result set.
- Store snapshots and change manifests as separate bounded records instead of embedding a large snapshot in one request.
- Move merge application and undo to server-owned operations with revisions, stable operation IDs, and conflict checks.
- Start with explicitly bounded atomic merges. For larger jobs, use staged versions and a controlled final switch or block affected writes; simple chunking must not expose a half-merged graph.
- Check concurrent edits and membership changes before application. Retrying an approved request must not apply it twice.
- Make undo reverse only recorded changes when revisions still match. Surface conflicts where later edits exist instead of restoring entire old documents.
- Test photo references, parent-child cycles, self-links, and relationship semantics after proposed merges.

Acceptance: overlapping merges, simultaneous reviews, stale previews, retries after timeout, large histories, and undo after later edits produce either a correct result or an actionable conflict with no silent data loss.

## Phase 4: Reduce tree loading, memory, and document growth

- Introduce lightweight node summaries for tree display and directory rows. Load notes, memories, and full photo lists on demand.
- Maintain summaries through a trusted write path with reconciliation, so summary and detail records cannot silently diverge.
- Move growing history, life events, and photo metadata into paginated records. Keep only bounded summary fields on tree/person documents.
- Evaluate separate membership records using the Phase 0 contention measurements; migrate access checks together if changing the current membership arrays.
- Preserve current offline profile/draft behavior explicitly. Keep recent/pinned profile caches and show when uncached detail requires connectivity.
- Paginate the user's trees, member directory, and old notification markers. Keep actionable pending requests available.
- Finish and reconcile the existing membership backfill before disabling the extra legacy query.
- Avoid repeated complete array mapping, sorting, and cache serialization when a small number of records change.

### Reuse existing branch controls for data pagination

Confirmed direction: use the existing "More children" and "Show parents" controls to fetch additional data. Currently these controls reveal already-downloaded records; the change must reduce actual initial reads and memory use, not only the number of visible cards.

- Load the initial focused branch using lightweight people and relationship records, preserving the current bounded generations and child groups.
- On "More children", fetch the next bounded page of children and their required connecting relationships. On "Show parents", fetch the next ancestor group and its connecting relationships.
- Use stable ordering and cursors scoped to the tree, person, and expansion direction. Deduplicate people and edges shared by several loaded branches.
- Return authorized remaining-relative counts or explicit has-more metadata. Distinguish unloaded relatives from genuinely absent relatives; never present a partial graph as complete.
- Show loading, retry, and remaining-relative indicators at the existing controls. Preserve the selected person, zoom, and viewport anchor during expansion.
- Cache loaded branches within the authorized account/tree session. Reopening a branch should reuse data while checking freshness; clear inaccessible records after revocation or account changes.
- Limit live subscriptions to loaded data and reconcile edits, deletions, and cursor changes so expansion neither skips nor duplicates relatives.
- Search the authorized tree independently of loaded pages, then fetch the branch/path needed to reveal the selected result.
- Validate relationships, duplicates, and cycles against complete relevant server data. Kinship calculations must fetch required paths or report incomplete data instead of inferring no relationship from a partial graph.
- Keep Full tree available as an explicit progressive load with progress and cancellation; do not silently download the full graph on startup.

Acceptance: pass the agreed device timing, memory, and read budgets at target tree sizes. Verify that initial reads are bounded by the starting branch, each expansion fetches only needed pages, and repeated expansion reuses cached data. Test wide families, shared ancestors, concurrent additions/deletions, failed-page retries, search for unloaded people, Full tree, account/access changes, offline drafts, and fresh reloads. Family relationships and validation must remain correct with partially loaded graphs.

## Phase 5: Control abuse, costs, and background work

- Enforce per-account and per-tree limits for creation, invitations, searches, uploads, and expensive merges on the server. Set actual limits from product scale and budget decisions.
- Add rate limiting to password resets and return the same response whether an email exists or not.
- Roll out App Check in monitoring mode first, validate supported web/native clients, then enforce it. Keep role checks and quotas independent of it.
- Add email queueing, deduplication, retry policy, and monitoring. Design for ambiguous provider responses; do not promise exactly-once delivery without provider support.
- Process approvals with retry delays, attempt counts, and a needs-attention state. Persist progress so failing old items cannot monopolize every run.
- Apply the agreed expiry policy without silently changing existing pending requests.
- Monitor pending age, job failures, function latency, permission errors, media growth, and daily read/write usage. Avoid recording family names or notes in telemetry.
- Configure budget alerts plus application-enforced limits; alerts alone do not cap spending.

Acceptance: simulated spam is limited, valid clients remain usable, repeated failures do not starve new work, and alerts reach the responsible operator.

## Phase 6: Improve discovery and duplicate management

- Add stable cursor pagination over safe directory summaries.
- Avoid filtering away all results after applying the database limit; continue fetching authorized pages when necessary.
- Add optional, consented distinguishing details and explain why a tree or person matched.
- Offer duplicate suggestions during entry without preventing legitimate people with the same names.
- Preserve conflicting facts and their provenance. Require deliberate review before linking identities.

Acceptance: common-surname searches return relevant later pages; existing memberships do not conceal other matches; private trees and private people remain undiscoverable.

## Release and rollback strategy

1. Split phases into independently reviewable changes. Ship narrow critical security fixes ahead of schema-heavy work where possible.
2. Add failing regression coverage for each confirmed defect before implementing its fix.
3. Back up, dry-run migrations, and verify restore procedures.
4. Add new collections, indexes, and server endpoints with least-privilege rules. Wait for indexes to be ready.
5. Backfill and reconcile data before moving reads. Use temporary compatible writes only where necessary and documented.
6. Release compatible clients, handle installed older native versions, and then remove unsafe legacy paths. For urgent fixes, prefer an explicit upgrade requirement to leaving a bypass open indefinitely.
7. Run the existing release gate plus the new permission, concurrency, migration, and performance tests. Verify browser flows after reload and on actual Android hardware.
8. Roll out to a small cohort and expand only after agreed error, backlog, performance, and cost checks pass.
9. Retain rollback data and migration checkpoints. Roll back features or client routing without restoring known unsafe permissions.

## Completion criteria

- Private family/account data is inaccessible outside the intended membership and discovery policy.
- Every mutation enforces the same approved role and review rules on the server.
- Linked people survive access changes and deletion according to the chosen ownership model.
- Merges, undo, and background jobs are repeat-safe and surface conflicts.
- Target trees meet measured device and cost budgets.
- Recovery has been tested, and production monitoring has an assigned owner.

No implementation dates or safe user-count promises are assigned until the product decisions, baseline results, and deployment inventory are available.
