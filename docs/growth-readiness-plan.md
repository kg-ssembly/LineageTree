# Growth-readiness delivery plan

## Release target

The first paid release is designed for 1,000 registered users, about 200 active users, a largest tree of 1,000 people, and up to 100 collaborators on one tree. The R500/month plan includes private collaboration, searchable safe summaries, reviewed linked-profile changes, and automatic approval at expiry.

## Delivered foundations

1. **Server-authoritative changes.** Tree creation, surname-tree creation, collaboration, family edits, approval decisions, profile linking, unlinking, and directory lookup run through callable Cloud Functions. Firestore rules deny direct client writes to family records, membership, approval, merge, and history documents.
2. **Editor-managed access.** Editors can add, remove, and assign collaborators through a server transaction. Membership and role data can no longer be changed directly from a browser or app client.
3. **Automatic approval expiry.** Approval decisions are validated and applied atomically. A scheduled server task can approve expired requests without relying on an editor being online. Client requests cannot falsely mark themselves as automatic.
4. **Linked profiles.** Tree copies create independent local people connected by a `personLinks` record. Changes to shared profile fields become reviewable change requests in linked trees, and unlinking stops future propagation.
5. **Safe discovery.** New trees default to a discoverable summary. Search runs on the server and returns only the intended public summary; private tree and account documents remain unreadable to non-members.
6. **Progressive tree loading.** The initial tree branch is small. “More children” and “Show parents” request the next graph segment, while the full graph is loaded only for views that require all family data.
7. **Abuse and media limits.** Server operations use fixed-window limits. Tree photos require editor permission, an image MIME type, and a 2 MB limit.

## Rollout steps

1. Deploy Firestore and Storage rules with the Cloud Functions package.
2. Backfill each existing tree with explicit `memberIds`, `editorIds`, collaborator records, `discoverable`, and search keywords before enabling the new client build.
3. Create directory-search indexes and monitor callable latency, invocation failures, approval queue age, graph page sizes, and rate-limit rejections.
4. Start with a small invited cohort. Verify an expiry decision, collaborator removal, linked-profile approval, tree search result, and a 1,000-person graph before expanding access.
5. Review limits and capacity after two weeks of real usage. Increase fixed-window thresholds only from observed traffic, keeping per-user and per-tree metrics separate.

## Remaining operational work before broad launch

- Run deletion as a resumable server job with a visible `deleting` state and progress cursor; do not rely on one long request for a large tree.
- Add a dedicated denormalised directory collection if search needs richer ranking or public browsing volumes exceed callable-query capacity.
- Add composite indexes and load tests using representative 1,000-person trees and 100-editor collaboration bursts.
- Define retention periods for audit events, expired approvals, person links, and search telemetry, then add automated cleanup.
- Add billing enforcement and usage telemetry before charging R500/month.
