# Reliability and performance release

## Implemented

- Activity is ordered by `updatedAt` in Firestore. The initial history window is 80 records (120 direct notifications), with an explicit load-more control. Pending requests use an independent subscription and do not disappear behind the history limit. Expanded history stays live so changes and deletions remain consistent.
- Read/action markers remain available for old pending items and expanded history. These small markers are currently loaded for the signed-in account without a cap.
- Approval decisions commit domain changes and terminal status in one transaction. The scheduled function checks due requests every five minutes, with bounded batches, retries, permission checks, conflict detection, and structured failure logs.
- Sync status aggregates trees, people and relationships. Per-operation pending counts prevent one completed action from hiding another ongoing action. Routine saves no longer block the entire main workspace.
- Cache persistence skips serialization when persisted references have not changed. Full person records remain cached to preserve existing offline profile/draft behaviour; this release does not introduce a partial-profile schema.
- Invitation login/reload retains the requested tree, existing members can open that exact tree, and drafts can be restored after closing or reloading. Failed submissions retain form contents and attempt to save a local draft.
- Local, bounded performance samples cover startup, tree-data readiness, layout, React rendering, viewport frames, image loading, cache serialization and operation durations. Development builds expose the latest samples in Profile settings. Samples contain no family names or record identifiers and are not transmitted.

## Validation

Use Node 22 and Java 21. Install both root and Functions dependencies with `npm ci` and `npm ci --prefix functions`, then install Chromium with `npx playwright install chromium`.

`npm run verify:release` runs type checking, lint, core tests, backend tests, Firebase emulator integration tests, desktop/mobile browser journeys and the web export. GitHub Actions runs the same gate. Existing lint warnings are visible; errors block release.

All emulator tests use `demo-lineagetree`. The browser runner ignores local dotenv files and explicitly connects to local emulators. Never use production credentials or data for these tests. On Windows an interrupted emulator can leave its Java process listening on port 8089; identify its command line before stopping only the project's demo emulator.

## Rollout order

1. Review and back up the target database before migrating existing records. Use `npm run migrate:family-data -- --project=PROJECT_ID` for a read-only audit (exit 2 indicates records need migration).
2. Apply with the same command plus `--apply`, then rerun the read-only audit until it reports zero outstanding changes. Writes use document version preconditions, so a concurrent edit causes failure rather than being overwritten. The migration fills legacy membership fields, activity timestamps, expiry milliseconds and merge-history source/target fields. Resolve malformed records before proceeding.
3. Deploy Firestore rules and indexes; wait for indexes to finish building. Ordered queries exclude records lacking their order field, which is why migration comes first. Merge history needs the explicit source/target fields.
4. Deploy Functions, including `expireApprovalRequests`, and verify scheduled execution and failure logs. Existing stale approvals remain pending and require a fresh edit or rejection; they are not silently applied over newer data.
5. Only after the membership audit passes, set `EXPO_PUBLIC_MEMBERSHIP_MIGRATED=true` for the next app build to remove the extra legacy read. Keep it unset until then. Deploy web/native changes after the backend is ready.

No production migration, index deployment, scheduled job deployment or app release is performed by local tests.

## Performance acceptance on devices

Measure cold and warm startup, switching trees, opening profiles, pan/zoom and saving on representative Android hardware, with 300/1,000/2,000-person fixtures. Compare median and slow-tail samples on the same device/build; development React profiling is not a release frame-rate measurement. Record Firestore usage separately because document-change samples are not billing counts. Preserve the existing complete profile cache until those measurements justify a separate lightweight data schema.

The npm dependency audit also reports Expo/toolchain advisories. Review those separately before release; this change does not force an Expo major upgrade.
