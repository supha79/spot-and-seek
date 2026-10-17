# Phase 2B Game Run RPC Test Plan

Run SQL/pgTAP artifacts only against a disposable, isolated Supabase test database after migration source and fixtures have been reviewed. Do not use Production or shared Staging data. As of 2026-10-17, all six SQL files have been run against the Docker-backed local database; no SQL test was run against Remote. See Verification Status for results. The migration order below is a proposed source dependency sequence, not authorization or confirmation that Apply is safe.

## Migration Baseline and Candidate Scope

The repository migration inventory contains 12 files. The three historical baseline versions reported for Production are `20261004000000`, `20261004010000`, and `20261005000000`; this report is not current evidence and says nothing about Staging. Nine candidate migrations follow them in source order:

1. `20261008000000_game_content_foundation.sql`
2. `20261009000000_backend_run_compatibility_foundation_publish.sql`
3. `20261009133000_dynamic_run_dual_path.sql`
4. `20261009133001_game_session_level_key_identity_guard.sql`
5. `20261009133004_lifecycle_and_score_policy_rpcs.sql`
6. `20261011090000_dynamic_gameplay_gate_read_rpc.sql`
7. `20261011100000_game_run_result_read_rpc.sql`
8. `20261011110000_private_gameplay_asset_pairs.sql`
9. `20261012092053_dynamic_start_expected_rule_version.sql`

The SQL artifacts below are not all valid after only `20261009133004`: current fixtures call `publish_game`, insert Comparison assets, and/or call asset-pair RPCs introduced by later candidates. Reconcile each artifact to its actual prerequisites below. Apply only after a separately authorized target/history/schema preflight; keep Dynamic gameplay disabled.

## SQL Artifact Coverage and Prerequisites

| Artifact | Minimum source migration state | Test fixtures and policy requirements |
|---|---|---|
| `backend_run_compatibility_foundation_test.sql` | Base migrations plus all eight candidates through `20261011110000`; it calls Game lifecycle behavior and uses Comparison assets/pair-aware publishing that are not available at 09133004. | At least one `auth.users` row; private `gameplay-assets` bucket; no existing rows in `game_run_score_policy_approvals`. The test creates temporary policy/approval and content fixtures in its transaction and ends with `ROLLBACK`. Run only in a disposable DB. |
| `dynamic_run_dual_path_test.sql` | Base migrations plus all nine candidates; fixtures publish a Game/Level with a pair and exercise the version-bound Start RPC and current run wrappers. | Two auth users with corresponding profiles and a private bucket. The test creates a test-only policy and distinct-approver approval inside its rollback transaction, temporarily enables the Gate, and exercises Dynamic success paths. These coefficients/approval are test fixtures, not product approval. |
| `lifecycle_score_policy_test.sql` | Base migrations plus all eight candidates; current fixture includes both asset roles and publishes through Game/Level RPCs. | Two auth users and private bucket. Creates a policy through the RPC and approves it as the distinct second user within the rollback transaction. This is test-only approval, not release approval. |
| `dynamic_gameplay_gate_read_test.sql` | Base migrations through `20261009133000_dynamic_run_dual_path.sql`, plus `20261011090000_dynamic_gameplay_gate_read_rpc.sql`. | Existing `dynamic_gameplay` Gate row and authenticated JWT subject claim. It deletes the Gate row temporarily to test fail-closed behavior; transaction rollback is essential. Isolated DB only. |
| `game_run_result_read_test.sql` | Base migrations plus candidates through `20261011100000_game_run_result_read_rpc.sql`; this artifact does not directly depend on 111100's asset-pair additions. | Two auth users and at least one Legacy `game_run_level_rules` row. The test creates Run/Session/registry/rule fixtures in a rollback transaction; it does not require an approved policy fixture for result reads. |
| `private_gameplay_asset_pairs_test.sql` | Base migrations plus all eight candidates, especially lifecycle RPCs and `20261011110000_private_gameplay_asset_pairs.sql`. | Two auth users and an existing private `gameplay-assets` bucket. SQL fixtures insert Storage object metadata and create a temporary policy approval, then roll back. This verifies database policy contracts, not uploaded image bytes, browser decoding, or real signed-URL behavior. |

The artifact requirements are derived from their current source. If a test source or migration changes, update this table after reviewing those exact changes. Do not infer that a test passed because it exists or because the migration source compiles.

`supabase/seed.sql` intentionally performs no writes and creates no Dynamic score policy or approval. The migrations also do not create/approve a policy. Dynamic Level publishing and positive Dynamic run tests require an already approved score policy; obtain product-approved coefficients and distinct authorized creator/approver fixtures through the approved process. Do not create a real release approval as test setup.

## Preconditions and Stop Conditions

- Establish an authorized disposable database and confirm its target is not Production. Do not use a shared Staging database for rollback-oriented SQL tests.
- Reconcile all 12 migration versions against that database's actual migration history and object/constraint inventory. Stop on missing, unexpected, out-of-order, partially applied versions or schema drift; do not use `migration repair` to make history appear consistent.
- Confirm Supabase `auth` and `storage` schemas and required platform roles exist. The private bucket `gameplay-assets` must exist with `public = false`; inspect existing `storage.objects` policies for conflicts or broader access before running asset artifacts.
- Inventory every existing Published Level before 111100. That migration adds nullable asset IDs but does not backfill old immutable rule versions. Affected Levels must have an approved availability/remediation plan: unpublish, register a verified private Original/Comparison pair, then republish to create a new pinned rule version. Republish also requires a Published parent Game, active spots, and an approved score policy. Stop if any pair/object/metadata is missing, dimensions differ, policy approval is unavailable, or existing rows fail identity/constraint validation.
- For `backend_run_compatibility_foundation_test.sql`, ensure there are zero pre-existing Dynamic policy approvals. Do not run it after an artifact/setup has left approvals behind.
- `dynamic_run_dual_path_test.sql` creates a clearly labeled rollback-only policy/approval fixture to exercise positive Dynamic paths. It does not establish or represent a Product/Production policy approval.
- Use fresh UUID request IDs for each logical operation; reuse an ID only when testing retries. Keep test fixtures inside their transaction and verify rollback completes.
- Do not apply `supabase/seed.sql` for these fail-closed checks.

## Cases

1. **Owner isolation and Admin positive RLS:** User A can read their runs/events. User B cannot read them and receives the same not-found behavior when invoking any RPC on A's run. An authenticated Admin with the expected `app_metadata.role` can read cross-user profiles/sessions/runs/events under the corresponding policies, but still cannot invoke owner-only mutations on another user's run. Anonymous calls fail authentication.
2. **Playable level whitelist:** Start succeeds for all eight IDs in `GameDataContext.levelCatalog`: `cozy-cat-corner`, `sunny-picnic`, `balloon-hills`, `greenhouse-garden`, `bakery-breeze`, `night-train`, `stormy-shelf`, `forest-fable`. Start rejects difficulty aliases (`easy`, `medium`, `hard`), admin IDs (`level-1`), unknown IDs, null IDs, and malformed IDs.
3. **Start idempotency and concurrency:** Send concurrent Start calls for the same user/request ID/Level. They must resolve to one run and one `started` event. Dynamic Start must include the artwork's expected rule-version ID; a stale ID must reject without persisting a run or consuming the request ID, while the matching ID starts successfully. Reuse that request ID for a different Level and verify rejection; a fresh request ID must create a distinct run. Concurrent Starts with different request IDs must not collide.
4. **Event validation, idempotency, and concurrency:** Reject unknown event types, mismatched `spot_id` shape, invalid spot IDs, and hints beyond the limit. Same consumed request ID and same operation/payload is a no-op; reusing it with a different event/spot fails. Concurrent retries of one event create one event and one counter increment. Concurrent different valid spot events serialize to distinct event numbers; `event_number` is the authoritative event order, and tests must not require wall-clock timestamps to increase strictly. A repeated spot with a fresh ID fails without incrementing found count.
5. **Server-owned clock and timeout retry:** Verify RPC signatures accept no client timestamp, elapsed time, remaining time, counters, outcome, or score. Timeout and state transitions use one server timestamp captured after the run lock is acquired. In an isolated concurrency test, hold the run lock across the deadline and verify the waiting operation resolves using its post-lock timestamp. Events after that serialized deadline resolve as loss with score 0. Retry the exact event/pause/abandon request that first observed timeout; the same operation/payload returns the terminal loss result without adding another session, terminal event, or counter change. Reusing that consumed timeout request ID with a different operation/event/spot, including Resume, is rejected. Finish has no request ID; retry it and verify the same terminal result without duplicates. A different late event with a fresh ID is a no-op. Elapsed time excludes intervals between Pause and Resume.
6. **Pause/Resume and transition matrix:** Pause an active run and verify elapsed time freezes at the post-lock transition time. Resume continues from the stored elapsed value and sets `resumed_at` after acquiring the run lock. Check transitions: Active -> Paused -> Active -> Completed -> Won; Active -> Lost on timeout; Active/Paused -> Abandoned; Completed -> Abandon is a no-op and Finish can still produce Won; Won/Lost/Abandoned cannot transition again. Retry Pause/Resume with the same consumed request ID and verify no duplicate lifecycle event or counter change. Reusing a timeout request ID for Resume fails with a conflict; using a fresh request ID on a terminal run returns the unchanged terminal snapshot without adding an event. Invalid transitions fail.
    A terminal no-op with a fresh request ID does not persist or consume that ID; therefore, later reuse of that ID by another operation is not guaranteed to be detected or rejected.
7. **Finish and profile concurrency:** After an approved policy, concurrently Finish the same completed run. Every call returns the same status/result/score/session ID; exactly one session and one terminal event exist, with one aggregate increment. Concurrently finalize distinct runs for one user and verify no lost `total_plays`/`total_wins` increments and `best_score` remains the maximum accepted score.
8. **Scoring policy gate and forged score:** Confirm migrations alone create no policy approval and no user-facing role can edit the policy. With no approved policy, winning Finish must fail without session/profile changes. The dual-path test uses only a rollback-only synthetic policy to exercise the positive path and does not establish a product approval. Verify the server formula and forged-argument rejection without persisting any approval.
9. **Explicit abandon and browser exit:** Explicit Abandon on Active or Paused creates one `abandoned` event, no session, and no play aggregate changes. Retry the same request without duplicates. Abandon after server time expires resolves as Loss. Abandon on Completed does not change state; Finish remains available. Closing the browser or navigating away sends no Abandon RPC.
10. **Direct-write denial and approval history:** Authenticated direct INSERT/UPDATE/DELETE on run/event/rules/policy tables and game_sessions fails. Profile score/win/play updates fail while permitted avatar/buddy updates remain unaffected. Deleting an auth user referenced by `approved_by` is rejected while the policy is approved; deleting an unrelated user or a user when policy is unapproved is permitted according to the selected FK behavior.
11. **Backfill source-of-truth variants:** Treat `game_sessions` as canonical history and profile counters as cached aggregates. With no sessions and zero cached values, backfill produces zero plays/wins/best score. With win/loss sessions and cached values lower than or equal to their corresponding aggregates, backfill exactly matches session count, win count, and max session score. If cached `total_wins` exceeds recorded session wins or cached `best_score` exceeds recorded max score, the preflight must abort with no schema/data change; reconcile using verified history rather than guessing. Include equal values, loss-only sessions, zero-score sessions, and profiles with no matching sessions.
12. **Transaction rollback:** In an isolated project, install a temporary test-only trigger that raises during profile aggregate update; Finish must leave no session, terminal run/event, or partial profile change. Also inject failure during terminal-event insert and verify the same rollback. Remove test-only triggers afterward.

## Security limitation to verify

The RPC validates IDs, run ownership/status, accepted event order, event idempotency, server timestamps, hint limit, and duplicate spots. It cannot prove that a player actually clicked the claimed spot or that a reported wrong click corresponds to a physical click: an authenticated modified client can submit valid `spot_found` or `wrong_click` events with fresh request IDs. These RPCs prevent client-supplied score/outcome/time summaries and direct table writes, but they do not provide complete anti-cheat protection without trusted gameplay evidence.


## Approval gate

The migrations and `supabase/seed.sql` do not approve a score policy. A winning Finish must fail closed until a separately authorized approval exists. pgTAP fixtures use rollback-only policies to verify the Admin approval path; they do not provide runtime configuration. Timeout losses can still finalize at score 0 while the win-score policy is pending.

## Verification Status

**Local PASS (2026-10-17):** `npx supabase test db` passed all six SQL files and 177 assertions against the local Docker-backed database after all 16 local migrations were applied. Dynamic positive-path coverage used a synthetic policy/approval inside the test transaction; all fixtures rolled back. This does not verify Production behavior, remote Storage object bytes, signed-URL transformations, or authenticated browser gameplay, and it does not authorize any Production or Staging write.

## Local Repository Verification (2026-10-12)

- **PASS:** `node --experimental-strip-types --test tests/unit/levelAssets.test.mjs` — 10 passed, including `.jpeg` Original/Comparison parsing, MIME/path mismatch rejection, both-image decode, and pair loading.
- **PASS:** `node --experimental-strip-types --test tests/unit/compatibilityContracts.test.mjs` — 39 passed; Dynamic requests require and include an expected rule version.
- **PASS:** `node --experimental-strip-types --test tests/unit/migrationContracts.test.mjs` — 5 passed; migration order and source contract checked, not database behavior.
- **PASS:** `npm test` — 70 passed, including migration contract checks.
- **PASS:** `npm run test:ui` — 30 passed. These are Vitest/jsdom tests with mocked client behavior, not real-browser or Supabase integration tests.
- **PASS:** `npx tsc -b --pretty false` — completed without diagnostics.
- **NOT VERIFIED:** browser image decode with real signed URLs, Supabase authorization/Storage policies, migration application/history/schema, and every SQL/pgTAP artifact above. No SQL or database command was run.
- **PASS (source):** Player Start sends the fetched `rule_version_id`; the new version-bound RPC checks the actual run response and raises on a mismatch so the transaction rolls back. The old public signature remains for Legacy but rejects direct Dynamic Start while the Gate is enabled. Unit/static contract tests passed; the pgTAP regression is authored but not run.
- **BLOCKED:** Migration `20261012092053` is not verified as applied; migration history/schema, Supabase authorization/Storage policies, and SQL/pgTAP behavior remain unverified. Keep Dynamic gameplay disabled.