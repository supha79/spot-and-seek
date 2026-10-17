# Spot & Seek — Gameplay Asset Readiness and Test Plan

Status: Local source inventory only. No Remote, database, Storage, Staging, or End-to-End test was run for this document. Do not use mockup URLs or illustrative coordinates as runtime content.

## 1. Readiness Summary

| Area | Status | Evidence |
|---|---|---|
| Local asset inventory | BLOCKED for verified gameplay art | No local gameplay image file was found under `src/` or `docs/screens-reference/`. `src/assets/README.md` identifies the asset folder as a placeholder. |
| Legacy configuration | PASS (source definition only) | The baseline migration defines eight Legacy IDs, time limits, and spot IDs. It does not define images or visual geometry. |
| Legacy Gameplay | BLOCKED for End-to-End | The Player flow intentionally reports Legacy content unavailable until a verified catalog/runtime source exists. No authoritative image pairs or measured Legacy spot geometry are present locally. |
| Dynamic Gameplay | BLOCKED for release; locally fail-closed | Runtime content requires published DB rows, active `level_spots`, a private Original/Comparison pair, and a published rule-version ID. A missing/unreadable Gate is `unknown` and blocks Start. Production Gate state remains NOT VERIFIED. |
| Source defects | None found in this targeted review | Existing code prevents substituting Dynamic content for Legacy and fails closed on unavailable or invalid published artwork. No source change is justified. |

This inventory describes repository evidence only. It does not establish whether images or rows exist in external Storage or a deployed database.

## 2. Asset and Geometry Inventory

### Classification

- **Verified asset:** None in the Local repository for Legacy gameplay.
- **Placeholder/reference:** `src/assets/README.md` says the folder is for future images/icons. The UI reference `docs/screens-reference/spot_seek_game_play_level_1_cozy_cat_corner_1/code.html` contains externally hosted image URLs and a demo interaction. Both displayed Cozy Cat Corner image elements use the same external image URL; its demo code calls one target “roughly” at about 84%/57.5%. This is mockup-only evidence, not an approved Original/Comparison pair, not locally versioned artwork, and not authoritative geometry.
- **Missing asset:** No local Original/Comparison gameplay image files were found in `src/` or `docs/screens-reference/`. The required Legacy pairs below are therefore missing from this repository.
- **Unknown / verify later:** External object existence, provenance, permissions, exact image bytes/dimensions, any non-repository coordinates, and deployed catalog rows were not inspected. Do not infer their presence or validity.

The Legacy `game_run_level_rules` migration records canonical spot IDs and durations, but no Original/Comparison paths, pixel dimensions, shapes, normalized coordinates, radii, widths/heights, or tolerances. The list of IDs is not proof that any particular visible feature is the answer.

| Legacy Level ID | Local rule evidence | Required gameplay artwork | Geometry / answer evidence | Asset readiness |
|---|---|---|---|---|
| `cozy-cat-corner` | 120s; `window`, `plant`, `teapot` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |
| `sunny-picnic` | 120s; `umbrella`, `flower`, `basket` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |
| `balloon-hills` | 120s; `balloon`, `hill`, `kite` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |
| `greenhouse-garden` | 90s; `window`, `plant`, `lamp`, `bench`, `vase` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |
| `bakery-breeze` | 90s; `window`, `plant`, `lamp`, `bench`, `vase` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |
| `night-train` | 90s; `window`, `plant`, `lamp`, `bench`, `vase` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |
| `stormy-shelf` | 60s; `window`, `plant`, `lamp`, `book`, `frame`, `mug`, `chair` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |
| `forest-fable` | 60s; `window`, `plant`, `lamp`, `book`, `frame`, `mug`, `chair` | Approved Original + Comparison pair: missing locally | Spot IDs only; measured shape/coordinates/tolerance and visual mapping missing | Missing locally; external status unknown |

Configuration evidence: [`20261004010000_phase_2b_game_runs.sql`](../../supabase/migrations/20261004010000_phase_2b_game_runs.sql). The UI title/difficulty map in [`adminDashboard.ts`](../../src/services/adminDashboard.ts) is display metadata, not an artwork or gameplay source.

## 3. What Each Level Must Supply

Before a Legacy level can be called playable, its content owner must provide, for every row in the inventory:

1. An approved Original image and its matching Comparison image, with provenance/usage approval, stable version/hash, MIME type, exact pixel dimensions, and confirmation that they show the same composition and aspect ratio. No artwork should be inferred from a screen mockup.
2. A reviewed mapping from every configured spot ID to the actual visual difference in the exact image pair. Record the shape (circle/rectangle), normalized center, dimensions or radius, tolerance, and any answer/score mapping required by the runtime. Do not fill these values from memory, labels, or the demo marker.
3. An annotated review copy for each image showing each answer region and its spot ID, tied to the exact image hashes. A content reviewer must confirm every region is visibly different in the pair, centered correctly, non-ambiguous, and does not overlap another answer unexpectedly.
4. A review at the actual runtime aspect ratio and responsive sizes. Confirm the displayed image scaling and hit targets correspond to the coordinate basis; the current Dynamic view uses the Comparison image's aspect ratio and normalized spot positions. Re-test after any asset or crop change.
5. QA sign-off that each correct target is accepted once, nearby non-target clicks are not falsely accepted, each configured ID can be found, and wrong-click/hint/time behavior agrees with the reviewed content and server rules.

Legacy's current database rule has `spot_ids` but no geometry relation. Adding an image pair alone does not make the Legacy hit-testing path ready; the owner must also identify an approved Legacy runtime source/adapter for those coordinates and answer IDs. Do not repurpose Dynamic rows or fabricate a Legacy mapping without explicit compatibility review.

## 4. Source Call Sites and User Impact

| Concern | Local call site / behavior | Impact while Legacy assets/geometry are missing |
|---|---|---|
| Legacy catalog | [`GameDataContext.tsx`](../../src/context/GameDataContext.tsx) uses the Dynamic published Games/Levels catalog and reports no verified Legacy catalog. | Legacy levels are not listed as playable through the current Player catalog. |
| Legacy route/content | [`GamePlay.tsx`](../../src/pages/game/GamePlay.tsx) requires a Dynamic `contentLevelId` to load `getPublishedLevelContent`; reserved Legacy routes show an unavailable message instead of substituting Dynamic content. | Legacy Start cannot be reached through a verified gameplay screen, even though the RPC request contract exists. |
| Legacy Start contract | [`compatibilityContracts.ts`](../../src/services/compatibilityContracts.ts) routes an unambiguous Legacy identity to `start_game_run`; [`gameRuns.ts`](../../src/services/gameRuns.ts) sends the selected RPC request. | This verifies request routing only, not artwork, click geometry, scoring, or End-to-End readiness. Legacy Start does not require the Dynamic Gate or a Dynamic expected rule version. |
| Dynamic content and geometry | [`playerContent.ts`](../../src/services/playerContent.ts) loads published Games/Levels, active `level_spots`, and a published asset pair; [`GamePlay.tsx`](../../src/pages/game/GamePlay.tsx) maps normalized geometry to hit targets. | Incomplete or invalid content prevents a playable Dynamic screen. Geometry needs review against the exact pair before release. |
| Dynamic artwork/version | [`levelAssets.ts`](../../src/services/levelAssets.ts) reads and validates the private Original/Comparison pair and signed images. Start sends `assetPair.rule_version_id`; the server contract rejects stale expected versions. | A valid pair must be pinned to the rule version used for Start. Never substitute unpinned/current artwork for a different version. |
| Scoring and results | [`GamePlay.tsx`](../../src/pages/game/GamePlay.tsx) submits spot IDs/events; result pages [`LevelComplete.tsx`](../../src/pages/game/LevelComplete.tsx) and [`TimesUp.tsx`](../../src/pages/game/TimesUp.tsx) load persisted results by run ID. | Missing Legacy geometry makes correct event IDs untrustworthy, so gameplay completion/scoring cannot be certified. Results are server-backed, but a result screen alone does not validate the artwork or answer mapping. |

Related Local checks cover request routing, gate parsing, asset-pair parsing, and result parsing in `tests/unit/compatibilityContracts.test.mjs`, `tests/unit/dynamicGameplayGate.test.mjs`, `tests/unit/levelAssets.test.mjs`, and `tests/unit/gameRunResults.test.mjs`. These are not Legacy gameplay End-to-End tests; UI tests with mocks do not verify deployed authorization, signed URLs, or Storage.

## 5. Gameplay Test Plan

Run only after a separately approved, isolated non-Production target and its fixtures are available. This plan is not permission to apply migrations, create content, approve a score policy, or open the Dynamic Gate. Capture target identity and build/version with each report; redact user identifiers and signed URLs.

### Legacy Gameplay

| Test | Preconditions / action | Expected result | Evidence to retain |
|---|---|---|---|
| L1. Asset and answer review | Approved source pair and measured geometry for one Legacy ID; compare exact Original/Comparison hashes and review every configured spot ID. | Every ID maps to one visible difference in the exact pair; pair dimensions/aspect match; no coordinate is accepted without reviewer sign-off. | Source/provenance approval, hashes, dimensions, annotated pair, per-spot sign-off. |
| L2. Catalog and route | Only after a reviewed Legacy catalog/runtime adapter is implemented, open each Legacy level from the Player catalog and direct route. | Correct Legacy ID/title/config loads; no Dynamic identity or artwork is substituted. Until that adapter/content exists, record BLOCKED rather than passing. | Screen/route record and resolved identity for all eight IDs. |
| L3. Legacy Start isolation | With verified Legacy identity, start each level while Dynamic is not enabled; inspect the request contract and returned run identity. | `start_game_run` receives the exact Legacy `p_level_id` and request ID; response remains Legacy identity with no Dynamic content/rule-version identity. | Redacted RPC name/argument summary, returned identity, run correlation ID. |
| L4. Hit testing and events | Use reviewed hit regions, adjacent negative controls, and every configured ID; test both supported image interaction surfaces if the UI provides them. | Each correct spot is accepted once, wrong areas remain wrong, duplicate/replayed requests are idempotent, and event IDs match configured Legacy IDs. | Annotated coordinates, click/event matrix, duplicate-request outcomes. |
| L5. Pause, hints, timeout, finish | Exercise pause/resume, hint limit, wrong-click penalty, expiry, win/loss, and retry under the approved Legacy policy. | Server state is authoritative; only valid events affect counts/score; terminal Session/Profile/History values match the persisted Run. | Request/event trace, final result fields, history/profile comparison, policy version. |
| L6. Owner isolation and results refresh | Read a completed result as its owner, then try the same run ID as another authenticated user; refresh/direct-open result routes. | Owner receives only their terminal result; another user receives generic unavailable/not-found behavior; refresh uses persisted server data. | Redacted owner/other-owner outcomes and direct-refresh result screen. |

Current disposition: L1-L2 are **BLOCKED** by missing approved pairs, geometry, and Legacy catalog/runtime adapter. L3 has Local request-routing coverage only. L4-L6 require the approved fixture target and must not be reported as passed from the existing mock-based tests.

### Dynamic Gameplay

| Test | Preconditions / action | Expected result | Evidence to retain |
|---|---|---|---|
| D1. Migration/content prerequisites | Approved isolated target has a reconciled migration prefix, required tables/RPCs, private bucket/policies, Published parent Game/Level, active spots, and approved Dynamic score policy. | Every required dependency matches reviewed migration source; no Legacy rows or policy approvals are silently rewritten/created. | Target owner/reference, migration list, catalog/RLS/grant checks, data inventory and approval record. |
| D2. Gate fail-closed | In an isolated test only, test Gate disabled, missing/unreadable RPC, malformed payload, timeout, and unauthenticated access. Do not run these checks on Production. | Disabled/error/timeout/malformed states do not offer or start Dynamic gameplay; only an authenticated valid enabled response is considered enabled. | Test output for each state; prove no run/request ID persisted on blocked Start. |
| D3. Version-pinned artwork | Read the published Original/Comparison pair and its rule-version ID; verify both images decode, metadata/dimensions match, and DB-pinned asset IDs belong to that level/version. | Gameplay uses the same immutable pair/version returned by the read RPC; unavailable, mismatched, or stale assets fail closed. | Asset IDs/version ID, hashes/dimensions, signed-image decode result, published rule snapshot. |
| D4. Expected-version Start | Start with the exact loaded expected rule version, then repeat with a stale/different version and duplicate request ID. | Matching version starts idempotently; stale version is rejected without a persisted Dynamic run for the rejected request. | Redacted RPC arguments/results and before/after run count or equivalent isolated-fixture evidence. |
| D5. Authorization and lifecycle | Exercise unauthenticated start, another user's run/event/result ID, invalid spot IDs, hints, pause/resume, finish, and timeout. | Server authorizes by authenticated owner; foreign-user data is unavailable; invalid events do not alter authoritative counts or score. | Actor-role fixture, expected SQLSTATE/API outcomes, run/event/result audit. |
| D6. Score and Results refresh | Complete win and loss through gameplay, then refresh/direct-open result and history. | Score/result/timestamps/spot counts come from persisted server result; History/Profile agree; pinned title/difficulty/version are shown only for Dynamic identity. | Result response, UI refresh capture, session/history/profile consistency checks. |
| D7. Gate activation approval | Only after all preceding evidence and a separate release/security approval, use the approved audited gate mechanism in the isolated target. | No activation occurs without named approvers/operator, reason, before/after evidence, and tested disable/recovery process. | Change approval, actor/time/reason/build, verified pre/post state and recovery evidence. |

Current disposition: D2-D6 have Local contract/unit or source-test coverage only. Real authorization, Storage behavior, database persistence, and End-to-End results remain **NOT VERIFIED**. Dynamic Gameplay remains unavailable until approved migration, content, policy, test, and activation gates are complete.

## 6. Release Evidence and Stop Conditions

Do not call a level `Verified` until its content owner signs the exact Original/Comparison pair and annotated spot mapping. Do not call Legacy Gameplay End-to-End ready until L1-L6 pass on an approved non-Production target. Do not call Dynamic Gameplay ready until D1-D6 pass; D7 requires a separate activation approval. Missing assets, unknown provenance, unreviewed coordinates, unpinned versions, absent Gate objects, or incomplete owner-isolation evidence are stop conditions.

Required approvals before any future database work: target owner confirms a non-Production isolated target; DB/Release owner reconciles migration history/schema and data risks; Storage/security owners verify private bucket and policy design; content owners approve artwork and geometry; Product approves score policy; QA approves disposable fixture/reset and captures test evidence. Production Gate value remains NOT VERIFIED from current evidence and must not be described as `false`.
