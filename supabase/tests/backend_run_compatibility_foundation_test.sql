-- pgTAP coverage for backend run compatibility, publish, and difficulty duration rules.
-- Also covers the session key identity FK introduced by 20261009133001.
-- Run only in a disposable database after migrations and before applying supabase/seed.sql.
-- Preconditions: at least one auth.users row exists and there are no score-policy approvals.
-- The test inserts its own policy and approval inside this transaction; final ROLLBACK removes both.

BEGIN;

SELECT no_plan();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.game_run_score_policy_approvals) THEN
    RAISE EXCEPTION 'Run this pgTAP file before seed.sql and with no approved score policy versions.';
  END IF;
END;
$$;

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid := pg_catalog.gen_random_uuid();
  v_level_id uuid := pg_catalog.gen_random_uuid();
  v_policy_id uuid := pg_catalog.gen_random_uuid();
  v_upload_id uuid := pg_catalog.gen_random_uuid();
  v_slug_suffix text := pg_catalog.replace(v_game_id::text, '-', '');
BEGIN
  SELECT auth_user.id
  INTO v_user_id
  FROM auth.users AS auth_user
  ORDER BY auth_user.created_at, auth_user.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Create a local auth user before running this pgTAP file.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets AS bucket
    WHERE bucket.id = 'gameplay-assets' AND bucket.public IS FALSE
  ) THEN
    RAISE EXCEPTION 'Create a private gameplay-assets bucket before running this pgTAP file.';
  END IF;

  PERFORM pg_catalog.set_config('spot_seek_test.user_id', v_user_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.game_id', v_game_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.level_id', v_level_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.policy_id', v_policy_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.level_key', 'compat-test-' || v_slug_suffix, true);

  INSERT INTO public.games (id, slug, name, status, created_by)
  VALUES (v_game_id, 'pgtap-' || v_slug_suffix, 'Compatibility Test Game', 'draft', v_user_id);

  INSERT INTO public.levels (
    id, game_id, level_key, difficulty, title, status,
    max_duration_seconds, max_hints, published_at, created_by
  )
  VALUES (
    v_level_id, v_game_id, 'compat-test-' || v_slug_suffix, 'easy',
    'Compatibility Test Level', 'draft', 120, 3, NULL, v_user_id
  );

  INSERT INTO public.level_spots (
    level_id, spot_key, label, shape, x_norm, y_norm, radius_norm, is_active
  )
  VALUES (v_level_id, 'test-spot', 'Test Spot', 'circle', 0.25, 0.35, 0.05, true);
  INSERT INTO storage.objects (bucket_id, name, metadata)
  VALUES
    ('gameplay-assets', v_level_id::text || '/' || v_upload_id::text || '/original.png',
     pg_catalog.jsonb_build_object('mimetype', 'image/png', 'size', 1024)),
    ('gameplay-assets', v_level_id::text || '/' || v_upload_id::text || '/comparison.webp',
     pg_catalog.jsonb_build_object('mimetype', 'image/webp', 'size', 2048));
  INSERT INTO public.level_assets (
    level_id, asset_type, bucket_name, storage_path, public_url,
    mime_type, width, height, file_size_bytes, is_primary, created_by
  )
  VALUES
    (v_level_id, 'original', 'gameplay-assets',
     v_level_id::text || '/' || v_upload_id::text || '/original.png',
     NULL, 'image/png', 640, 480, 1024, true, v_user_id),
    (v_level_id, 'comparison', 'gameplay-assets',
     v_level_id::text || '/' || v_upload_id::text || '/comparison.webp',
     NULL, 'image/webp', 640, 480, 2048, true, v_user_id);
END;
$$;

SELECT ok(
  pg_catalog.to_regclass('public.game_run_rule_versions') IS NOT NULL,
  'rule version snapshot table exists'
);
SELECT ok(
  pg_catalog.to_regclass('public.game_run_score_policy_versions') IS NOT NULL,
  'versioned score policy table exists'
);
SELECT ok(
  pg_catalog.to_regclass('public.game_run_score_policy_approvals') IS NOT NULL,
  'score policy approval audit table exists'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.levels', 'SELECT'),
  'authenticated receives the level SELECT grant used by Player and Admin'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.levels', 'SELECT'),
  'anon receives no level table privilege'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.games', 'SELECT')
  AND has_table_privilege('authenticated', 'public.games', 'INSERT')
  AND has_table_privilege('authenticated', 'public.games', 'DELETE'),
  'authenticated retains Game SELECT/INSERT/DELETE table privileges subject to RLS'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.games', 'UPDATE')
  AND
  has_column_privilege('authenticated', 'public.games', 'name', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.games', 'description', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.games', 'sort_order', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.games', 'updated_at', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.games', 'status', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.games', 'published_at', 'UPDATE'),
  'authenticated can update Game metadata columns but lifecycle columns remain RPC-only'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.level_assets', 'SELECT')
  AND has_table_privilege('authenticated', 'public.level_assets', 'INSERT')
  AND has_table_privilege('authenticated', 'public.level_assets', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.level_assets', 'DELETE')
  AND has_table_privilege('authenticated', 'public.level_spots', 'SELECT')
  AND has_table_privilege('authenticated', 'public.level_spots', 'INSERT')
  AND has_table_privilege('authenticated', 'public.level_spots', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.level_spots', 'DELETE'),
  'authenticated receives asset and spot CRUD privileges subject to RLS/triggers'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.levels', 'status', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.levels', 'published_at', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.levels', 'level_key', 'UPDATE'),
  'authenticated cannot directly update level status, publish timestamp, or key'
);
SELECT ok(
  has_function_privilege(
    'authenticated', 'public.publish_level_with_runtime_rules(uuid)', 'EXECUTE'
  )
  AND has_function_privilege('authenticated', 'public.unpublish_level(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.archive_level(uuid)', 'EXECUTE'),
  'authenticated can execute the three level lifecycle RPCs'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.publish_level_with_runtime_rules(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.unpublish_level(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.archive_level(uuid)', 'EXECUTE'),
  'anon cannot execute the level lifecycle RPCs'
);

SELECT throws_ok(
  format(
    'INSERT INTO public.levels (game_id, level_key, difficulty, title, status, created_by) VALUES (%L::uuid, %L, %L, %L, %L, %L::uuid)',
    current_setting('spot_seek_test.game_id'), 'cozy-cat-corner', 'easy',
    'Reserved Key Test', 'draft', current_setting('spot_seek_test.user_id')
  ),
  '22023',
  'Legacy level keys are reserved.',
  'content level cannot claim a reserved legacy key'
);
SELECT throws_ok(
  format(
    'INSERT INTO public.levels (game_id, level_key, difficulty, title, status, published_at, created_by) VALUES (%L::uuid, %L, %L, %L, %L, pg_catalog.clock_timestamp(), %L::uuid)',
    current_setting('spot_seek_test.game_id'),
    'direct-publish-attempt', 'easy', 'Direct Publish Attempt', 'published',
    current_setting('spot_seek_test.user_id')
  ),
  '42501',
  'Levels must be inserted as unpublished drafts.',
  'direct INSERT cannot bypass the publish RPC'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);

SELECT throws_ok(
  format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.level_id')
  ),
  '42501',
  'Administrator role required.',
  'non-admin cannot publish a level'
);
SELECT throws_ok(
  format('SELECT public.unpublish_level(%L::uuid)', current_setting('spot_seek_test.level_id')),
  '42501',
  'Administrator role required.',
  'non-admin cannot unpublish a level'
);
SELECT throws_ok(
  format('SELECT public.archive_level(%L::uuid)', current_setting('spot_seek_test.level_id')),
  '42501',
  'Administrator role required.',
  'non-admin cannot archive a level'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'No approved game run score policy version exists.',
  'publish fails closed without an approved policy'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_rule_versions
   WHERE content_level_id = current_setting('spot_seek_test.level_id')::uuid),
  0,
  'failed publish with no approved policy created no snapshot'
);
SELECT is(
  (SELECT status FROM public.levels WHERE id = current_setting('spot_seek_test.level_id')::uuid),
  'draft',
  'failed publish with no approved policy left the level draft'
);
SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_level_key_registry
   WHERE content_level_id = current_setting('spot_seek_test.level_id')::uuid),
  0,
  'failed publish with no approved policy left no key registration'
);

INSERT INTO public.game_run_score_policy_versions (
  id, version, time_weight, wrong_click_penalty, hint_penalty, created_by
)
VALUES (
  current_setting('spot_seek_test.policy_id')::uuid,
  'pgtap-policy-v1', 1200, 50, 100,
  current_setting('spot_seek_test.user_id')::uuid
);
INSERT INTO public.game_run_score_policy_approvals (policy_id, approved_by, approval_note)
VALUES (
  current_setting('spot_seek_test.policy_id')::uuid,
  current_setting('spot_seek_test.user_id')::uuid,
  'pgTAP transaction-only approval'
);

SELECT throws_ok(
  format(
    'UPDATE public.game_run_score_policy_versions SET time_weight = 1 WHERE id = %L::uuid',
    current_setting('spot_seek_test.policy_id')
  ),
  '55000',
  'game_run_score_policy_versions rows are immutable and cannot be update.',
  'score policy definition cannot be changed'
);
SELECT throws_ok(
  format(
    'DELETE FROM public.game_run_score_policy_approvals WHERE policy_id = %L::uuid',
    current_setting('spot_seek_test.policy_id')
  ),
  '55000',
  'game_run_score_policy_approvals rows are immutable and cannot be delete.',
  'score policy approval audit cannot be deleted'
);
SELECT throws_ok(
  format(
    'UPDATE public.game_run_score_policy_approvals SET approval_note = %L WHERE policy_id = %L::uuid',
    'changed', current_setting('spot_seek_test.policy_id')
  ),
  '55000',
  'game_run_score_policy_approvals rows are immutable and cannot be update.',
  'score policy approval audit cannot be changed'
);

CREATE FUNCTION public.pgtap_fail_rule_version_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'pgTAP injected version insert failure.';
END;
$$;
CREATE TRIGGER pgtap_fail_rule_version_insert
  BEFORE INSERT ON public.game_run_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.pgtap_fail_rule_version_insert();

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.level_id')
  ),
  'P0001',
  'pgTAP injected version insert failure.',
  'failure after key registration aborts publish transaction'
);
RESET ROLE;

DROP TRIGGER pgtap_fail_rule_version_insert ON public.game_run_rule_versions;
DROP FUNCTION public.pgtap_fail_rule_version_insert();

SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_level_key_registry
   WHERE content_level_id = current_setting('spot_seek_test.level_id')::uuid),
  0,
  'publish rollback removed the key registration inserted earlier in the transaction'
);
SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_rule_versions
   WHERE content_level_id = current_setting('spot_seek_test.level_id')::uuid),
  0,
  'publish rollback left no partial rule snapshot'
);
SELECT is(
  (SELECT status FROM public.levels WHERE id = current_setting('spot_seek_test.level_id')::uuid),
  'draft',
  'publish rollback left content unpublished'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'Parent game must be published before level can be published.',
  'level publish fails closed while the parent game is draft'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_rule_versions
   WHERE content_level_id = current_setting('spot_seek_test.level_id')::uuid),
  0,
  'parent-state rejection rolls back the runtime snapshot'
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'spot_seek_test.game_publish',
  public.publish_game(current_setting('spot_seek_test.game_id')::uuid)::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.game_publish')::jsonb ->> 'status',
  'published',
  'Game publish RPC makes the parent available before Level publish'
);
UPDATE public.levels
SET max_duration_seconds = 90
WHERE id = current_setting('spot_seek_test.level_id')::uuid;
SELECT throws_ok(
  format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.level_id')
  ),
  '22023',
  'Level duration does not match its difficulty tier.',
  'Easy level cannot publish with a Medium-tier duration'
);
UPDATE public.levels
SET difficulty = 'medium', max_duration_seconds = 91
WHERE id = current_setting('spot_seek_test.level_id')::uuid;
SELECT throws_ok(
  format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.level_id')
  ),
  '22023',
  'Level duration does not match its difficulty tier.',
  'Medium level cannot publish with an Easy-tier duration'
);
UPDATE public.levels
SET difficulty = 'hard', max_duration_seconds = 61
WHERE id = current_setting('spot_seek_test.level_id')::uuid;
SELECT throws_ok(
  format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.level_id')
  ),
  '22023',
  'Level duration does not match its difficulty tier.',
  'Hard level cannot publish with a Medium-tier duration'
);
UPDATE public.levels
SET difficulty = 'easy', max_duration_seconds = 120
WHERE id = current_setting('spot_seek_test.level_id')::uuid;
SELECT set_config(
  'spot_seek_test.first_publish',
  public.publish_level_with_runtime_rules(current_setting('spot_seek_test.level_id')::uuid)::text,
  true
);
SELECT is(
  (current_setting('spot_seek_test.first_publish')::jsonb ->> 'rule_version')::integer,
  1,
  'first publish creates version 1'
);
SELECT is(
  (SELECT status FROM public.levels WHERE id = current_setting('spot_seek_test.level_id')::uuid),
  'published',
  'level is published in the same successful RPC'
);
SELECT is(
  (SELECT status FROM public.games WHERE id = current_setting('spot_seek_test.game_id')::uuid),
  'published',
  'level publish retains the published parent state'
);
SELECT throws_ok(
  format('SELECT public.unpublish_game(%L::uuid)', current_setting('spot_seek_test.game_id')),
  '55000',
  'Unpublish or archive published levels before changing the parent game.',
  'Game cannot be unpublished while a Level remains published'
);

SELECT set_config(
  'spot_seek_test.same_hash_publish',
  public.publish_level_with_runtime_rules(current_setting('spot_seek_test.level_id')::uuid)::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.same_hash_publish')::jsonb ->> 'rule_version_id',
  current_setting('spot_seek_test.first_publish')::jsonb ->> 'rule_version_id',
  'publishing an identical hash returns the existing version'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_rule_versions
   WHERE content_level_id = current_setting('spot_seek_test.level_id')::uuid),
  1,
  'identical publish does not insert a duplicate version'
);
SET LOCAL ROLE authenticated;

SELECT public.unpublish_level(current_setting('spot_seek_test.level_id')::uuid);
SELECT is(
  (SELECT published_at IS NULL AND status = 'draft'
   FROM public.levels WHERE id = current_setting('spot_seek_test.level_id')::uuid),
  true,
  'unpublish clears published_at and returns to draft'
);
RESET ROLE;

UPDATE public.level_spots
SET score_value = score_value + 1
WHERE level_id = current_setting('spot_seek_test.level_id')::uuid
  AND spot_key = 'test-spot';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'spot_seek_test.score_value_only_publish',
  public.publish_level_with_runtime_rules(current_setting('spot_seek_test.level_id')::uuid)::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.score_value_only_publish')::jsonb ->> 'rule_version_id',
  current_setting('spot_seek_test.first_publish')::jsonb ->> 'rule_version_id',
  'changing score_value alone does not create a scoring/runtime version'
);
SELECT public.unpublish_level(current_setting('spot_seek_test.level_id')::uuid);
RESET ROLE;

UPDATE public.level_spots
SET x_norm = 0.30
WHERE level_id = current_setting('spot_seek_test.level_id')::uuid
  AND spot_key = 'test-spot';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'spot_seek_test.second_publish',
  public.publish_level_with_runtime_rules(current_setting('spot_seek_test.level_id')::uuid)::text,
  true
);
SELECT is(
  (current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version')::integer,
  2,
  'changed runtime content creates the next immutable version'
);
SELECT isnt(
  current_setting('spot_seek_test.second_publish')::jsonb ->> 'content_hash',
  current_setting('spot_seek_test.first_publish')::jsonb ->> 'content_hash',
  'changed runtime content produces a different content hash'
);

SELECT throws_ok(
  format(
    'UPDATE public.levels SET title = title || %L WHERE id = %L::uuid',
    ' direct edit', current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'Runtime fields cannot change while a level is published; unpublish it first.',
  'published level runtime fields are frozen'
);
SELECT throws_ok(
  format(
    'UPDATE public.levels SET difficulty = %L WHERE id = %L::uuid',
    'hard', current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'Runtime fields cannot change while a level is published; unpublish it first.',
  'published difficulty is frozen'
);
SELECT throws_ok(
  format(
    'UPDATE public.levels SET max_duration_seconds = max_duration_seconds + 1 WHERE id = %L::uuid',
    current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'Runtime fields cannot change while a level is published; unpublish it first.',
  'published duration is frozen'
);
SELECT throws_ok(
  format(
    'UPDATE public.levels SET max_hints = max_hints - 1 WHERE id = %L::uuid',
    current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'Runtime fields cannot change while a level is published; unpublish it first.',
  'published hint limit is frozen'
);
SELECT throws_ok(
  format(
    'UPDATE public.levels SET game_id = pg_catalog.gen_random_uuid() WHERE id = %L::uuid',
    current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'Runtime fields cannot change while a level is published; unpublish it first.',
  'published parent game identity is frozen'
);
SELECT throws_ok(
  format(
    'UPDATE public.level_spots SET x_norm = 0.31 WHERE level_id = %L::uuid AND spot_key = %L',
    current_setting('spot_seek_test.level_id'), 'test-spot'
  ),
  '55000',
  'Level spots cannot be inserted, updated, or deleted while a level is published.',
  'published spot updates are frozen'
);
SELECT throws_ok(
  format(
    'INSERT INTO public.level_spots (level_id, spot_key, label, shape, x_norm, y_norm, radius_norm) VALUES (%L::uuid, %L, %L, %L, 0.5, 0.5, 0.05)',
    current_setting('spot_seek_test.level_id'), 'late-spot', 'Late Spot', 'circle'
  ),
  '55000',
  'Level spots cannot be inserted, updated, or deleted while a level is published.',
  'published spot inserts are frozen'
);
SELECT throws_ok(
  format(
    'DELETE FROM public.level_spots WHERE level_id = %L::uuid AND spot_key = %L',
    current_setting('spot_seek_test.level_id'), 'test-spot'
  ),
  '55000',
  'Level spots cannot be inserted, updated, or deleted while a level is published.',
  'published spot deletes are frozen'
);

RESET ROLE;
SELECT throws_ok(
  format(
    'UPDATE public.game_run_rule_versions SET title = title WHERE id = %L::uuid',
    current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id'
  ),
  '55000',
  'game_run_rule_versions rows are immutable and cannot be update.',
  'compiled rule snapshots cannot be updated'
);
SELECT throws_ok(
  format(
    'DELETE FROM public.game_run_rule_versions WHERE id = %L::uuid',
    current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id'
  ),
  '55000',
  'game_run_rule_versions rows are immutable and cannot be delete.',
  'compiled rule snapshots cannot be deleted'
);

RESET ROLE;
SELECT throws_ok(
  format(
    'UPDATE public.levels SET status = %L, published_at = NULL WHERE id = %L::uuid',
    'draft', current_setting('spot_seek_test.level_id')
  ),
  '42501',
  'Level publish state can only be changed through an authorized RPC.',
  'level status cannot be changed by a direct update'
);

SET LOCAL ROLE authenticated;
SELECT public.unpublish_level(current_setting('spot_seek_test.level_id')::uuid);
RESET ROLE;

SELECT throws_ok(
  format(
    'UPDATE public.levels SET level_key = %L WHERE id = %L::uuid',
    'compat-renamed-' || pg_catalog.replace(current_setting('spot_seek_test.level_id'), '-', ''),
    current_setting('spot_seek_test.level_id')
  ),
  '55000',
  'A level key cannot change after the level has been published.',
  'level key stays immutable after unpublish clears published_at'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'spot_seek_test.republish_same_hash',
  public.publish_level_with_runtime_rules(current_setting('spot_seek_test.level_id')::uuid)::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.republish_same_hash')::jsonb ->> 'rule_version_id',
  current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id',
  'republishing unchanged content after unpublish reuses the existing version'
);
RESET ROLE;

SELECT throws_ok(
  format(
    'INSERT INTO public.game_runs (user_id, level_id, content_level_id, rule_version_id, start_request_id, status, started_at, resumed_at) VALUES (%L::uuid, NULL, %L::uuid, %L::uuid, %L::uuid, %L, pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp())',
    current_setting('spot_seek_test.user_id'),
    current_setting('spot_seek_test.level_id'),
    '00000000-0000-0000-0000-000000000001',
    pg_catalog.gen_random_uuid(), 'active'
  ),
  '23503',
  NULL,
  'composite run FK rejects a version from another content identity or a missing version'
);

SELECT throws_ok(
  format(
    'INSERT INTO public.game_runs (user_id, level_id, content_level_id, rule_version_id, start_request_id, status, started_at, resumed_at) VALUES (%L::uuid, NULL, %L::uuid, NULL, %L::uuid, %L, pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp())',
    current_setting('spot_seek_test.user_id'),
    current_setting('spot_seek_test.level_id'),
    pg_catalog.gen_random_uuid(), 'active'
  ),
  '23514',
  NULL,
  'run identity CHECK rejects a partial dynamic identity'
);

SELECT throws_ok(
  format(
    'INSERT INTO public.game_runs (user_id, level_id, content_level_id, rule_version_id, start_request_id, status, started_at, resumed_at) VALUES (%L::uuid, %L, %L::uuid, %L::uuid, %L::uuid, %L, pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp())',
    current_setting('spot_seek_test.user_id'),
    'cozy-cat-corner',
    current_setting('spot_seek_test.level_id'),
    current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id',
    pg_catalog.gen_random_uuid(), 'active'
  ),
  '23514',
  NULL,
  'run identity CHECK rejects mixing legacy and dynamic identifiers'
);

INSERT INTO public.game_runs (
  user_id, level_id, content_level_id, rule_version_id,
  start_request_id, status, started_at, resumed_at
)
VALUES (
  current_setting('spot_seek_test.user_id')::uuid,
  'cozy-cat-corner', NULL, NULL,
  pg_catalog.gen_random_uuid(), 'active', pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp()
);
SELECT ok(true, 'legacy run identity remains valid under the new CHECK');

INSERT INTO public.game_runs (
  user_id, level_id, content_level_id, rule_version_id,
  start_request_id, status, started_at, resumed_at
)
VALUES (
  current_setting('spot_seek_test.user_id')::uuid,
  NULL,
  current_setting('spot_seek_test.level_id')::uuid,
  (current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id')::uuid,
  pg_catalog.gen_random_uuid(), 'active', pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp()
);
SELECT ok(true, 'dynamic run identity with a matching pinned version is valid');

SELECT throws_ok(
  format(
    'INSERT INTO public.game_sessions (user_id, level_id, score, result, content_level_id, level_key, rule_version_id) VALUES (%L::uuid, %L, 0, %L, %L::uuid, %L, %L::uuid)',
    current_setting('spot_seek_test.user_id'),
    'not-the-level-key', 'loss',
    current_setting('spot_seek_test.level_id'),
    current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id'
  ),
  '23514',
  NULL,
  'dynamic session level_id must equal the pinned level_key'
);

INSERT INTO public.game_sessions (
  user_id, level_id, score, result, content_level_id, level_key, rule_version_id
)
VALUES (
  current_setting('spot_seek_test.user_id')::uuid,
  current_setting('spot_seek_test.level_key'), 0, 'loss',
  current_setting('spot_seek_test.level_id')::uuid,
  current_setting('spot_seek_test.level_key'),
  (current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id')::uuid
);
SELECT ok(true, 'dynamic session stores the pinned level_key in legacy-compatible level_id');
SELECT throws_ok(
  format(
    'INSERT INTO public.game_sessions (user_id, level_id, score, result, content_level_id, level_key, rule_version_id) VALUES (%L::uuid, %L, 0, %L, %L::uuid, %L, %L::uuid)',
    current_setting('spot_seek_test.user_id'),
    'mismatched-' || current_setting('spot_seek_test.level_key'), 'loss',
    current_setting('spot_seek_test.level_id'),
    'mismatched-' || current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.second_publish')::jsonb ->> 'rule_version_id'
  ),
  '23503',
  NULL,
  'dynamic session level_key must match its content identity registry entry'
);

SET LOCAL ROLE authenticated;
SELECT public.archive_level(current_setting('spot_seek_test.level_id')::uuid);
RESET ROLE;
SELECT is(
  (SELECT status FROM public.levels WHERE id = current_setting('spot_seek_test.level_id')::uuid),
  'archived',
  'archive RPC transitions a level to archived'
);
SELECT is(
  (SELECT published_at IS NULL
   FROM public.levels WHERE id = current_setting('spot_seek_test.level_id')::uuid),
  true,
  'archive RPC clears published_at'
);

SELECT * FROM finish();
ROLLBACK;