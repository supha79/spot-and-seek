# Spot & Seek Staging Migration Preflight

Status: preparation only. No staging target is currently verified. No SQL, migration, seed, or pgTAP was executed while preparing this document.

## 1. Known Baseline and Target Gate

The previously supplied Cloud baseline reports Production migration history `20261004000000`, `20261004010000`, and `20261005000000`. It reports migrations after `20261005000000` absent from that Production history. This is historical evidence only; it is not evidence about a Staging project's history.

An earlier Supabase CLI metadata inquiry exposed two accessible projects, one matching the known Production reference and no project that could be verified as Staging. The latest user-supplied `migration list` result for an explicit project reference reports only `20261004000000`, `20261004010000`, and `20261005000000`; this matches the local first-three baseline, with all nine local candidates below absent from that reported history. This establishes migration-history rows for that reference only: it does not establish that the reference is an approved non-Production target or prove anything about its schema, existing objects, data, or safety. Do not link, query, or apply migrations until the environment owner confirms the exact reference is authorized and differs from Production. Never infer Staging from project ordering or an unfamiliar project name.

**Hard stop:** if the target reference, its environment owner, or separation from Production is not confirmed, stop with `BLOCKED: No verified staging target`. Do not run any SQL below against Production.

## 1.1 Production Evidence and Readiness (2026-10-12)

The operator-confirmed target for the recent catalog inspection is project `spot-and-seek`, reference `kymvfbusgisvxbrbwoso`, and the Dashboard labels it **PRODUCTION**. The operator reports that the Remote catalog does not contain `public.game_run_feature_gates` or `public.get_dynamic_gameplay_gate_status()`. The reported Remote migration history contains only the three baseline versions above; all nine local candidates are absent. These are supplied findings, not a fresh Remote inspection in this work; no Remote command or SQL was run while recording them.

Additional operator-confirmed observations: `public.start_game_run(text, uuid)` exists as `SECURITY DEFINER` with `EXECUTE` for `authenticated`, `service_role`, and `postgres`; no non-internal triggers were found on `game_runs` or `game_run_events`. The lack of those triggers alone does not establish an authorization defect: review the function body, grants, constraints, and owner checks together before changing a Production migration.

**Release decision:** Production is not an authorized target for the nine candidates, and applying them is prohibited. No non-Production Staging target is verified, so candidate migration application and Remote integration are **BLOCKED**. Do not enable Dynamic Gameplay. Production Gate state is **NOT VERIFIED**, not `false`: its table and read RPC are absent from the supplied catalog inspection. The local Dynamic client fails closed when the Gate RPC is unavailable, but that is not evidence of Remote integration. Legacy Start remains represented by the baseline RPC/rules; end-to-end Legacy readiness is **BLOCKED** because the repository does not provide authoritative Legacy artwork/spot geometry for Player gameplay. Do not claim either gameplay path is Production-ready from migration history or function privileges alone.

Before any future release, independently authorize a non-Production target, verify its actual migration history and schema, inventory existing Published Levels/assets and score-policy approvals, and run the disposable-database tests under the team's approved process. Do not infer catalog state or data safety from absent migration-history rows.

## 1.2 Production Update (2026-10-16)

The user explicitly approved proceeding with the previously presented plan. For Production project `kymvfbusgisvxbrbwoso`, a fresh `supabase migration list` showed the local chain synchronized through `20261012092053`, with only `20261016120000_difficulty_duration_tiers.sql` pending. `supabase db push --dry-run --project-ref kymvfbusgisvxbrbwoso --skip-vault` listed only that migration. It was applied with `supabase db push --project-ref kymvfbusgisvxbrbwoso --skip-vault`; a subsequent migration list confirmed the local and remote versions match through `20261016120000`.

The applied migration adds a trigger enforcing published-level duration tiers by difficulty. Post-apply authenticated read checks returned Dynamic Gameplay Gate `false`, 0 Games, and 0 Levels. Score policy versions and approval rows were also 0; the browser session is not an Admin. No Game, Level, spot, asset, score policy, approval, Run, or Session was created, and the Gate was not enabled.

This operation does not complete the release checklist: backup/PITR coverage was not independently verified, SQL/pgTAP tests were not run against a disposable database, the Playground coordinate candidates remain `needs_verification`, and the current session cannot perform Admin content/policy workflows. Do not bypass the Admin, two-person score-policy approval, asset QA, or Gate activation controls. The earlier Production/target statements above are historical as of 2026-10-12; this subsection is the newer migration-state evidence.

## 1.3 Local Audit Update (2026-10-17)

The repository contains 16 migrations. A fresh read-only migration-list check confirms all 16 versions, through `20261016150000`, are present both locally and on the linked Production project. This audit applied no Remote migrations. Docker is available for the local stack; all 16 migrations are applied locally and the pgTAP suite passed all 177 checks. Dynamic positive-path assertions used a test-only policy/approval fixture inside the rollback transaction; no assertions were skipped. Fixtures rolled back, the local gate remains closed, and no test Games or approvals remain. A read-only Production catalog preflight was also run; its findings and limits are in Section 1.4.

Production remains an explicitly identified live target, not a substitute for Staging. Do not apply or repair migrations based only on local source or this migration-list result. Any future Production database change requires its own reviewed authorization and release procedure.

## 1.4 Read-only Production Snapshot (2026-10-17)

Read-only Production checks report Dynamic Gameplay gate `true`, 1 Game, 9 Published Levels, 1 score-policy version with 1 approval, and one private `gameplay-assets` bucket. Each Published Level has a latest rule version with an approved policy, 5 or 6 active spots, paired asset metadata with matching dimensions and sizes within the 5 MiB limit, and corresponding `storage.objects` metadata rows.

This is structural catalog evidence only; remote object bytes were not downloaded or decoded, signed image-transform URLs and authenticated browser gameplay were not exercised, and Vercel project settings were not inspected. No player rows were queried and no Production rows were changed. The Production gate is already enabled. Do not infer from the historical sections above that it is closed, and do not toggle it as part of this audit; any gate change requires a separate authorized release/incident decision.

## 2. Migration Inventory and Proposed Order

At the time of the initial 2026-10-12 inventory, the repository contained 12 migration files in this chain. The first three are the **reported historical Production baseline**; they are not evidence of Staging history and must not be assumed to be applied to any target. The remaining nine were **candidate migrations** at that time. The current local and read-only Production migration states are recorded in Sections 1.3 and 1.4.

### Reported baseline (3)

1. `20261004000000_phase_2a_database_foundation.sql`
2. `20261004010000_phase_2b_game_runs.sql`
3. `20261005000000_phase_2b_resume_timeout_request_guard.sql`

### Candidate migrations (9), proposed dependency order

4. `20261008000000_game_content_foundation.sql` — creates Games, Levels, assets, and spots; depends on the Supabase Auth schema/users.
5. `20261009000000_backend_run_compatibility_foundation_publish.sql` — adds immutable rule/policy/level-key records and Level lifecycle publishing; depends on the content tables and base game-run/session tables.
6. `20261009133000_dynamic_run_dual_path.sql` — adds the disabled Dynamic Gate and replaces public Run RPCs while retaining Legacy helpers; depends on the run identity columns and rule-version tables.
7. `20261009133001_game_session_level_key_identity_guard.sql` — validates the composite session-to-level-key registry FK; depends on the registry and session identity columns from 090.
8. `20261009133004_lifecycle_and_score_policy_rpcs.sql` — adds Game lifecycle and score-policy workflow RPCs plus the published-parent guard; depends on Games/Levels and the Level publish RPC from 090.
9. `20261011090000_dynamic_gameplay_gate_read_rpc.sql` — exposes read-only gate status; depends on the Gate table from 09133000.
10. `20261011100000_game_run_result_read_rpc.sql` — exposes owner-checked results for Legacy and Dynamic runs; depends on base Run/Session/Legacy-rule tables and Dynamic rule-version/identity tables.
11. `20261011110000_private_gameplay_asset_pairs.sql` — adds Comparison assets, pinned asset IDs, private Storage policies, pair-registration/read RPCs, and replaces Level publishing; depends on the content/runtime/lifecycle objects above and Supabase `storage` schema/bucket facilities.
12. `20261012092053_dynamic_start_expected_rule_version.sql` — binds Dynamic Start to the artwork's expected published rule version, rejects direct Dynamic calls to the unguarded Legacy-compatible RPC, and preserves Legacy Start; depends on all prior candidates, especially the dual-path Start RPC and pinned asset pairs.

This sequence is a **source-derived plan, not confirmation that any candidate can be applied**. Before proposing a pending suffix, compare actual target history and schema with the full chain. For a genuinely new project, verify platform roles, `auth` and `storage` schemas, and the required private bucket before deciding whether a full chain is valid. If history is unknown, partial, out of order, or contains an unexpected version, stop for reconciliation. Never use `migration repair` to make history appear consistent.

Migration `20261011110000` adds nullable `original_asset_id`/`comparison_asset_id` columns to existing rule versions and does not backfill them. Its new Player pair-read RPC requires both IDs, so existing Published Levels whose rule versions predate this migration will not have readable pinned pairs by default. Inventory those Levels before Apply. If any exist, do not proceed without an approved maintenance/remediation plan: after 111100, each affected Level must be unpublished, receive a valid registered private Original/Comparison pair, and be republished to create a new rule version that pins both asset IDs. This requires a Published parent Game and an approved score-policy version; preserve prior immutable rule versions and history. If the team cannot accept temporary unavailability or cannot safely perform this sequence, stop and design/review a separate forward-only data migration first.

The base chain is not data-neutral for a populated project: `04000000` creates `profiles` from existing `auth.users`; `04010000` backfills profile aggregates from `game_sessions` and has an explicit stop guard for wins/best scores not represented by session history. For a Staging database containing Auth users, profiles, sessions, or runs, do not treat it as empty. Verify ownership and satisfy the migration's reconciliation requirements before applying; never infer or overwrite history.

## 3. Safe Apply Procedure

Run from a cleanly identified repository checkout. Use the exact independently approved Staging project reference in every remote command; do not use `supabase link` or rely on a previously linked project. `--skip-vault` prevents the CLI from updating Vault secrets from `config.toml`.

```powershell
supabase migration list --project-ref <APPROVED_STAGING_PROJECT_REF>
supabase db push --dry-run --project-ref <APPROVED_STAGING_PROJECT_REF> --skip-vault
```

Before applying, verify the linked reference independently against the approved Staging reference and verify the dry-run lists exactly the expected pending suffix from Section 2. The reported first-three baseline is not an expected starting point for Staging until its history is freshly verified. If the CLI does not support dry-run for the installed version, stop and use the team's approved migration review procedure; do not improvise SQL Editor execution or history repair.

Only after an authorized Staging operator approves the target and dry-run:

```powershell
supabase db push --project-ref <APPROVED_STAGING_PROJECT_REF> --skip-vault
supabase migration list --project-ref <APPROVED_STAGING_PROJECT_REF>
```

The standard CLI applies pending migrations in version order and records migration history. It applies the pending set as one operation; it does not provide a supported pause between each file. Do not copy migration SQL into SQL Editor and do not manually write migration-history rows. If policy requires an observation/approval checkpoint after every individual migration, use the team's established staged release process that packages one approved migration boundary at a time. Recheck the target and pending list at every boundary.

Never run seed as part of this preparation. `supabase/seed.sql` intentionally creates no content or Dynamic score policy. No Game, Level, spot, policy version, or approval is created by this runbook.

### Failure, Rollback, and Recovery

Do not treat this migration chain as generally reversible. There are no approved down migrations; rule versions, Runs, Sessions, profile aggregates, and registered assets can become data-bearing or immutable. Before Apply, the DB Owner must confirm the target's backup/restore or point-in-time recovery coverage and record pre-Apply counts/identities for existing Legacy rules, Runs, Sessions, Published Games/Levels, latest rule versions, and assets. If that evidence is unavailable, stop before Apply.

If an Apply command fails or stops partway through, stop further writes. Preserve the full operator output and target identity. After separate authorization, inspect actual migration history and schema before deciding whether any earlier migration committed; do not assume the whole command rolled back. Do not rerun blindly, edit an applied migration, use `migration repair`, or manually change schema/history in SQL Editor. Reconcile with the DB Owner and use a reviewed forward-only migration when the catalog and history differ.

If post-Apply verification fails, keep Dynamic Gameplay unavailable and pause affected content workflows. Do not drop or rewrite immutable rules, Runs, Sessions, or history. For Levels lacking newly pinned asset pairs, use the approved content recovery sequence: unpublish the affected Level, register a valid private Original/Comparison pair, then republish to create a new rule version; retain earlier versions. Any application rollback must be separately reviewed for compatibility with the already-applied schema. Production recovery is outside this runbook and requires an independent incident/change approval.

## 4. Read-only Preflight SQL

Run only after independently verifying the connection is the approved Staging database. These queries inspect migration metadata and schema catalogs; they do not select user rows or mutate data.

### 4.1 Migration history

```sql
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Before apply, compare the result with the expected starting point in Section 2. Stop on any unexpected, missing, partially applied, or out-of-order version.

### 4.2 Existing object inventory

```sql
SELECT expected.object_name,
       to_regclass('public.' || quote_ident(expected.object_name)) AS relation
FROM (VALUES
  ('profiles'), ('game_sessions'), ('game_run_level_rules'),
  ('game_run_score_policy'), ('game_runs'), ('game_run_events'),
  ('games'), ('levels'), ('level_assets'), ('level_spots'),
  ('game_run_score_policy_versions'), ('game_run_score_policy_approvals'),
  ('game_run_level_key_registry'), ('game_run_rule_versions'),
  ('game_run_feature_gates')
) AS expected(object_name)
ORDER BY expected.object_name;
```

For a fresh project after base migrations and before Content migration, the six base objects (`profiles`, `game_sessions`, `game_run_level_rules`, `game_run_score_policy`, `game_runs`, `game_run_events`) should exist; Content/Dynamic objects should not. For any other shape, stop and compare against the approved migration history before applying.

### 4.3 Platform role prerequisites

```sql
SELECT role_name, pg_catalog.to_regrole(role_name) IS NOT NULL AS role_exists
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS expected(role_name)
ORDER BY role_name;
```

Supabase-managed roles/schema must be provisioned by the platform. These migrations use PostgreSQL built-ins for UUID and SHA-256 generation; they do not require installing an extension. Do not create roles, extensions, or grants manually to make a migration pass. A missing platform prerequisite is a stop condition.

### 4.4 Private Storage and Existing Published Artwork (before 111100)

Run only after independently verifying the approved Staging target. The query below is read-only and inventories currently Published Levels and their primary Original assets before Comparison support is introduced. It does not prove that object bytes, metadata, or future pinned rule-version IDs are valid; those require the 111100 design checks and the disposable-database test. Do not infer that a Level is safe to retain as Published merely because it has an Original asset.

```sql
SELECT level.id AS level_id, level.level_key, game.id AS game_id,
       asset.id AS primary_original_asset_id, asset.storage_path,
       asset.bucket_name, asset.width, asset.height, asset.file_size_bytes
FROM public.levels AS level
JOIN public.games AS game ON game.id = level.game_id
LEFT JOIN public.level_assets AS asset
  ON asset.level_id = level.id
 AND asset.asset_type = 'original'
 AND asset.is_primary
WHERE level.status = 'published'
ORDER BY game.id, level.id;
```

Before 111100, verify out of band that `gameplay-assets` exists and `storage.buckets.public = false`, inspect existing `storage.objects` policies for conflicts/over-broad access, and inventory actual Primary Original objects. Comparison rows and pinned asset IDs cannot be assumed to exist under the pre-111100 schema. Stop if a private bucket or required Storage schema is absent, any storage policy is unexpected/conflicting, or Published content cannot be remediated under an approved plan.

No migration in the nine-candidate list creates an approved Dynamic score policy. The Level publish RPC requires one after the lifecycle/policy migration; Dynamic success paths in `dynamic_run_dual_path_test.sql` also require an already approved policy. Do not create or approve one as part of migration application. Product-approved coefficients and a distinct authorized approver are separate prerequisites for content republishing and positive Dynamic tests.

## 5. Read-only Checkpoints After Apply

Run the applicable checkpoint after the migration has been applied and recorded. Compare catalog results with the migration source. These checks do not prove runtime authorization; the pgTAP files require a separate approved disposable test database.

### After `20261004000000_phase_2a_database_foundation.sql`

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('profiles', 'game_sessions')
ORDER BY table_name;
```

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('profiles', 'game_sessions')
ORDER BY c.relname;
```

Expected: both tables exist with RLS enabled. This migration may create profiles for Auth users already present; only apply it to a verified Staging target.

### After `20261004010000_phase_2b_game_runs.sql`

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('game_run_level_rules', 'game_run_score_policy', 'game_runs', 'game_run_events')
ORDER BY table_name;
```

```sql
SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.pg_get_function_result(p.oid) AS result
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'start_game_run', 'record_game_run_event', 'pause_game_run',
    'resume_game_run', 'finish_game_run', 'abandon_game_run'
  )
ORDER BY p.proname;
```

Expected: the Legacy rule/run tables and six public RPC signatures exist. This migration inserts Legacy rule definitions and an unapproved Legacy policy template, not Dynamic content or an approval. On a non-empty Staging target, stop unless its profile aggregate backfill guard passes against authoritative session history.

### After `20261005000000_phase_2b_resume_timeout_request_guard.sql`

```sql
SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'resume_game_run';
```

Expected: `resume_game_run(uuid,uuid)` remains executable by `authenticated` and not by `anon`; no session/run data should change.

### After `20261008000000_game_content_foundation.sql`

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('games', 'levels', 'level_assets', 'level_spots')
ORDER BY table_name;
```

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       p.policyname, p.cmd, p.roles, p.qual, p.with_check
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_policies AS p
  ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relname IN ('games', 'levels', 'level_assets', 'level_spots')
ORDER BY c.relname, p.policyname;
```

Expected: all four tables exist with RLS enabled and the Admin-write/Published-read policies defined in migration 080. Table grants remain revoked at this checkpoint; migration 090 supplies the authenticated grants, so the Frontend is not expected to load Games yet. No content is seeded.

### After `20261009000000_backend_run_compatibility_foundation_publish.sql`

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'game_run_score_policy_versions', 'game_run_score_policy_approvals',
    'game_run_level_key_registry', 'game_run_rule_versions'
  )
ORDER BY table_name;
```

```sql
SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.pg_get_function_result(p.oid) AS result
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('publish_level_with_runtime_rules', 'unpublish_level', 'archive_level')
ORDER BY p.proname;
```

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
       pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') AS anon_select
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('games', 'levels', 'level_assets', 'level_spots')
ORDER BY c.relname;
```

Expected: policy/version and identity tables exist; Level lifecycle RPC signatures match the source; `authenticated` has the intended catalog grants subject to RLS, and `anon` has no catalog reads. Do not expect any Dynamic policy or approval row.

### After `20261009133000_dynamic_run_dual_path.sql`

```sql
SELECT gate_name, is_enabled
FROM public.game_run_feature_gates
ORDER BY gate_name;
```

```sql
SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.pg_get_function_result(p.oid) AS result,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'start_game_run', 'record_game_run_event', 'pause_game_run',
    'resume_game_run', 'finish_game_run', 'abandon_game_run'
  )
ORDER BY p.proname;
```

Expected: `dynamic_gameplay` is `false`; public RPC signatures remain compatible, are executable by `authenticated`, and are not executable by `anon`. No policy approval is created.

### After `20261009133001_game_session_level_key_identity_guard.sql`

```sql
SELECT conname, convalidated, pg_catalog.pg_get_constraintdef(oid) AS definition
FROM pg_catalog.pg_constraint
WHERE conrelid = 'public.game_sessions'::regclass
  AND conname = 'game_sessions_content_level_key_fk';
```

Expected: exactly one validated FK. It must not rewrite Legacy session identifiers.

### After `20261009133004_lifecycle_and_score_policy_rpcs.sql`

```sql
SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.pg_get_function_result(p.oid) AS result,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'publish_game', 'unpublish_game', 'archive_game',
    'create_game_run_score_policy_version', 'approve_game_run_score_policy'
  )
ORDER BY p.proname;
```

```sql
SELECT c.relname AS table_name,
       pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_table_update,
       pg_catalog.has_column_privilege('authenticated', c.oid, 'status', 'UPDATE') AS authenticated_status_update,
       pg_catalog.has_column_privilege('authenticated', c.oid, 'published_at', 'UPDATE') AS authenticated_published_at_update
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('games', 'levels')
ORDER BY c.relname;
```

```sql
SELECT trigger_row.tgname, trigger_row.tgenabled
FROM pg_catalog.pg_trigger AS trigger_row
WHERE NOT trigger_row.tgisinternal
  AND trigger_row.tgrelid IN ('public.games'::regclass, 'public.levels'::regclass)
ORDER BY trigger_row.tgrelid, trigger_row.tgname;
```

```sql
SELECT gate_name, is_enabled
FROM public.game_run_feature_gates
ORDER BY gate_name;
```

Expected: Game lifecycle and score-policy RPCs have the expected signatures, are executable only by `authenticated`, direct status updates are unavailable, lifecycle guard triggers exist, and Dynamic Gate remains false. No policy version or approval is inserted by the migration.

### After `20261011090000_dynamic_gameplay_gate_read_rpc.sql`

Verify `get_dynamic_gameplay_gate_status()` exists with the expected `jsonb` return, is executable by `authenticated` but not `anon`, and direct table SELECT remains revoked. Confirm the RPC reports the stored value without changing it and that the gate row remains `false`. Stop if the Gate row is absent/duplicated or privilege/policy state differs from source.

### After `20261011100000_game_run_result_read_rpc.sql`

Verify `get_game_run_result(uuid)` exists and only `authenticated` can execute it. Confirm direct access to private rule snapshots remains revoked, and review that its Legacy and Dynamic result branches use the expected Run-to-Session and pinned-rule identity fields. Stop if required tables/columns/constraints are absent or existing Run/Session links fail the documented identity checks.

### Before and after `20261011110000_private_gameplay_asset_pairs.sql`

Before Apply, use Section 4.4 and the approved data-inventory procedure to identify every Published Level whose latest immutable rule version cannot have a pinned Original/Comparison pair. Stop if any affected content lacks an approved remediation/availability plan, if product has not approved a score policy required for republishing, or if the private bucket, object metadata, or existing Storage policies do not meet the migration design. This migration does not backfill asset IDs into old rule versions.

After Apply, verify the asset type constraint accepts `original`, `comparison`, and `thumbnail`; the per-level/per-type primary index and rule-version pair-shape/FKs exist and are validated; pair registration and published-pair read RPCs have only the intended authenticated grants; and all four scoped Storage policies match the source without unintended UPDATE/DELETE access. For each remediated Level, verify both private objects and metadata match, dimensions match, both asset IDs are pinned in a newly published rule version, and the parent Game remains Published. Stop on missing/unpinned objects, incomplete pairs, dimension/metadata mismatch, policy conflicts, or a failed content/history validation. Keep `dynamic_gameplay` disabled.

### After `20261012092053_dynamic_start_expected_rule_version.sql`

Verify `start_game_run(text,uuid)` remains authenticated-only and Legacy-compatible, the renamed internal dispatcher is not executable by `PUBLIC`, `anon`, or `authenticated`, and `start_game_run_for_rule_version(text,uuid,uuid)` is executable only by `authenticated`. In the disposable SQL test, direct Dynamic Start must fail when the Gate is enabled, a stale expected rule version must fail without persisting a run/request ID, and a matching version must start and retry idempotently. These checks are **NOT VERIFIED** until run against a separately approved disposable database after the complete migration chain is reconciled. Keep the Dynamic Gate disabled outside that isolated test transaction.

## 6. Home Verification and Remaining Gates

The Home query requires `authenticated` read access through RLS to `public.games` and filters to `status = 'published'`. After 080/090, no Games are seeded; an empty list is expected and is not a migration failure. To display a real Game, an authorized Admin must create approved real content through the UI and publish it through `publish_game`. A published Game with no published Levels may still result in an empty Level list. Do not fabricate test content on a shared Staging project without separate approval.

Do not open `dynamic_gameplay`. Dynamic gameplay requires an explicitly created, product-approved policy and approval by a different Admin; there is no automatic policy, content, or Legacy-to-Dynamic backfill. Required database runtime verification remains unperformed until an authorized, isolated Staging target and test identities are available. Production remains out of scope. This runbook is not authorization to execute any step.

## 7. Pre-Apply Evidence Checklist

This checklist is for an authorized operator to complete against the approved target. **Current target-specific status for every item below: NOT VERIFIED.** Evidence must be attached to the release/change record with collection time, target identity, and reviewer. Source review, historical Cloud baselines, and local test artifacts are not substitutes for target evidence.

| Item | What to inspect and acceptable evidence | Owner / required access | PASS / BLOCK | Next step if blocked |
|---|---|---|---|---|
| 1. Target identity and migration history | Exact project reference from the approved environment record, named environment owner, confirmation it differs from Production, and timestamped `supabase migration list` output for the same reference. | Release Owner approves target; authorized Supabase/DB operator can read migration history. | PASS only when target identity and owner are confirmed and actual history is a recognized prefix of the 12-file chain with no unexpected/partial versions. Otherwise BLOCK. | Stop remote work; obtain owner confirmation and reconcile history before calculating the pending suffix. Never infer Staging from project names/order or use `migration repair`. |
| 2. Schema/object prerequisites and drift | Timestamped read-only catalog inventory for required base/content/run tables, columns, PK/FK/CHECK constraints, RPC signatures, triggers, RLS, grants, and required Auth/Storage schemas/platform roles; compare with each pending migration's source. | DB Owner/DBA with catalog-read privileges; security reviewer for RLS/grants. | PASS only when every prerequisite for the first pending migration exists, no unexpected object/constraint/policy conflict is present, and earlier migrations' expected outputs match. Otherwise BLOCK. | Stop; reconcile drift and existing data with the DB Owner. Design a reviewed forward-only migration if source history and schema disagree. |
| 3. Private bucket and Storage policies | Read-only evidence that `gameplay-assets` exists with `public = false`; inventory of `storage.objects` policies, roles, commands, permissiveness and predicates; evidence of Storage metadata/read permissions required by the pair RPCs. | Supabase Storage/DB administrator plus Security reviewer; bucket and policy catalog read access. | PASS only when the private bucket and `storage` schema exist and existing policies do not conflict with or broaden the four scoped policies in 111100. Otherwise BLOCK. | Stop before 111100; obtain the approved Storage owner decision and a reviewed policy-conflict/forward plan. Do not alter policies as an ad hoc preflight fix. |
| 4. Published Levels and artwork | Pre-111100 inventory of every Published Level, parent Game, primary Original asset reference, Storage object path and metadata; an explicit affected-Level/remediation list. Since asset-ID columns do not exist before 111100, record that fact rather than claiming IDs are pinned. After 111100, collect latest rule-version Original/Comparison IDs, pair dimensions, object metadata and publication status. | Content Owner/Admin and Storage operator produce inventory; DB Owner verifies row/object relationship and immutable rule-version effects. | PASS only if no currently Published Level is affected, or an approved maintenance/remediation plan covers each affected Level: unpublish, provide and register a valid private pair, then republish to create a new pinned version. Otherwise BLOCK. | Stop; obtain product/content approval for temporary unavailability or design a separate reviewed forward-only backfill. Do not modify immutable historical rule versions or assume migration 111100 backfills them. |
| 5. Score policy and two-person approval | Product-approved policy version and coefficients; audit evidence for `policy_id`, `created_by`, `approved_by`, timestamp/note, and proof creator and approver are distinct. Confirm the policy is approved before any Level republish or positive Dynamic test. | Product/Score Policy Owner approves coefficients; two distinct authorized Admins perform create/approve; DB/Release Owner verifies audit evidence. | PASS only for a policy explicitly approved under the product process with distinct creator/approver. Migration presence or a Legacy policy is not evidence. Otherwise BLOCK for republishing/positive Dynamic tests; do not enable Dynamic Gameplay. If a Gate exists on the approved target, verify it is `false`; an absent Gate is NOT VERIFIED, not `false`. | Obtain product approval and the authorized two-person workflow in an approved environment. Do not create approval rows through migration, seed, or test setup on a shared target. |
| 6. SQL test fixtures and disposable database | Disposable DB identity and reset/rollback procedure; artifact-specific fixture plan: Foundation test needs ≥1 auth user, private bucket and zero pre-existing Dynamic approvals; Dynamic dual-path needs 2 users with profiles, private bucket and an existing approved policy for positive cases (otherwise 29 assertions skip); lifecycle/asset-pair tests need 2 users and private bucket; result test needs 2 users and Legacy rules; Gate-read test needs the Gate row and authenticated subject. | QA/Test Owner and DB operator; permission to create isolated test users/fixtures only in the disposable DB. | PASS only when the DB is disposable, prerequisites match the selected artifact, and tests' transaction effects/rollback are understood. SQL/pgTAP results remain NOT VERIFIED until actually run under separate authorization. Otherwise BLOCK. | Provision/reset an isolated test DB and document fixture state; do not substitute Production or shared Staging. No approval or fixture setup is authorized by this checklist. |
| 7. Apply mechanism and checkpoints | Approved change record, exact pending suffix from target history, dry-run output, approved executor, and evidence capture plan after each version. Confirm whether the approved tool applies one migration at a time or batches the pending set. | Release Owner and DB Owner approve; authorized operator executes only after approval. | PASS only when the tool/process supports the team's required checkpoint/approval boundary and dry-run equals the reviewed suffix. Otherwise BLOCK. | Stop and use the team's approved per-migration packaging/checkpoint procedure; do not improvise SQL Editor application or claim post-migration verification before evidence exists. |

Completing this checklist does not itself authorize Apply. A reviewer must assess evidence freshness and approve the exact target, migration suffix, asset remediation window, policy state, and checkpoint mechanism in the release/change record.

## 8. Local Repository Findings and Verification

Local checks run on 2026-10-12; these results do not verify any deployed target:

| Area | Status | Evidence / exit criteria |
|---|---|---|
| Local source and automated checks | PASS (local only) | Node unit, UI, TypeScript/build, and whitespace checks pass as recorded below. No Remote integration is implied. |
| Legacy Gameplay | BLOCKED for end-to-end readiness | Baseline Legacy Start/rules exist, but `src/assets/README.md` identifies the assets folder as a placeholder; there is no authoritative Legacy artwork/spot-geometry catalog to validate gameplay. Supply and review those assets/coordinates, then test Legacy gameplay against an approved non-Production target. |
| Dynamic Gameplay | BLOCKED for release | Production lacks the Gate table/read RPC per supplied evidence; frontend maps lookup failure to `unknown` and blocks Start. Production Gate value is NOT VERIFIED. Keep the feature unavailable until migration/runtime checks and separate enablement approval pass. |
| Migration release | BLOCKED | Nine candidate migrations are absent from the reported Production history, Production is not an approved target, and no non-Production target is verified. Complete the Section 7 evidence checklist before planning Apply. |

| Status | Finding / evidence |
|---|---|
| PASS | The `.jpeg` parser defect is fixed: `src/services/levelAssets.ts` accepts JPEG paths with `image/jpeg`; `tests/unit/levelAssets.test.mjs` covers `.jpeg` Original and Comparison paths. `node --experimental-strip-types --test tests/unit/levelAssets.test.mjs`: 10 passed, 0 failed. |
| PASS (source) | Dynamic Start now sends the loaded artwork's `rule_version_id` through `start_game_run_for_rule_version`; the new migration rejects stale versions and blocks direct Dynamic use of the unguarded RPC. Unit/migration-contract coverage passed. The pgTAP regression was added but not executed. |
| PASS | `npm test`: 70 passed, 0 failed, including migration contract tests. |
| PASS | `npm run test:ui`: 30 passed, 0 failed. These Vitest/jsdom tests use mocked client behavior and do not exercise a real browser, Supabase Auth, Storage, or signed URLs. |
| PASS | `npm run build`: TypeScript and Vite production build completed. Vite reported a mixed static/dynamic import warning for `supabaseClient.ts` and a bundle-size warning for the main chunk (>500 kB). |
| PASS | `git diff --check` passed for tracked changes; a separate trailing-whitespace scan passed for this untracked release document. |
| NOT VERIFIED | Browser image decoding against real signed URLs, deployed Storage policies, migration history/schema, and SQL/pgTAP behavior. Migration `20261012092053` is repository-only and has not been applied. No SQL, migration, database, or Dashboard operation was run. |
| BLOCKED | Release remains blocked on target identity/history/schema, Storage policy/bucket evidence, published asset-pair inventory/remediation, approved score policy, disposable DB/pgTAP execution, and an authorized Apply process. Do not enable Dynamic Gameplay; Production Gate state is NOT VERIFIED because its table/RPC are absent. |

Source review found no fallback to incomplete artwork: missing/malformed pairs, signed-URL errors, decode failures, and dimension mismatches fail closed before Ready/Start. Registration/publication RPCs check the authenticated Admin role; run ownership and scoring remain server-side in the RPC contract. These are repository findings only, not deployed authorization evidence.