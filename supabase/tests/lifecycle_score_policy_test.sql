BEGIN;

SELECT no_plan();

DO $$
DECLARE
  v_creator uuid;
  v_approver uuid;
  v_game_id uuid := pg_catalog.gen_random_uuid();
  v_level_id uuid := pg_catalog.gen_random_uuid();
  v_upload_id uuid := pg_catalog.gen_random_uuid();
  v_slug_suffix text := pg_catalog.replace(v_game_id::text, '-', '');
BEGIN
  SELECT auth_user.id INTO v_creator
  FROM auth.users AS auth_user
  ORDER BY auth_user.created_at, auth_user.id
  LIMIT 1;

  SELECT auth_user.id INTO v_approver
  FROM auth.users AS auth_user
  WHERE auth_user.id <> v_creator
  ORDER BY auth_user.created_at, auth_user.id
  LIMIT 1;

  IF v_creator IS NULL OR v_approver IS NULL THEN
    RAISE EXCEPTION 'Create two local auth users to run this authorization test.';
  END IF;
  UPDATE auth.users AS auth_user
  SET raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb) - 'role';
  UPDATE auth.users AS auth_user
  SET raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb)
    || pg_catalog.jsonb_build_object('role', 'admin')
  WHERE auth_user.id = v_creator;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets AS bucket
    WHERE bucket.id = 'gameplay-assets' AND bucket.public IS FALSE
  ) THEN
    RAISE EXCEPTION 'Create a private gameplay-assets bucket before running this pgTAP file.';
  END IF;

  PERFORM pg_catalog.set_config('spot_seek_test.creator_id', v_creator::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.approver_id', v_approver::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.game_id', v_game_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.level_id', v_level_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.game_slug', 'lifecycle-test-' || v_slug_suffix, true);
  PERFORM pg_catalog.set_config('spot_seek_test.level_key', 'lifecycle-level-' || v_slug_suffix, true);

  INSERT INTO public.games (id, slug, name, status, created_by)
  VALUES (v_game_id, 'lifecycle-test-' || v_slug_suffix, 'Lifecycle Test Game', 'draft', v_creator);
  INSERT INTO public.levels (id, game_id, level_key, difficulty, title, status, created_by)
  VALUES (v_level_id, v_game_id, 'lifecycle-level-' || v_slug_suffix, 'easy', 'Lifecycle Test Level', 'draft', v_creator);
  INSERT INTO public.level_spots (level_id, spot_key, label, shape, x_norm, y_norm, radius_norm)
  VALUES (v_level_id, 'target', 'Target', 'circle', 0.4, 0.5, 0.05);
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
     NULL, 'image/png', 640, 480, 1024, true, v_creator),
    (v_level_id, 'comparison', 'gameplay-assets',
     v_level_id::text || '/' || v_upload_id::text || '/comparison.webp',
     NULL, 'image/webp', 640, 480, 2048, true, v_creator);
END;
$$;

SELECT ok(
  has_function_privilege('authenticated', 'public.publish_game(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.unpublish_game(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.archive_game(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_game_run_score_policy_version(text,integer,integer,integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.approve_game_run_score_policy(uuid,text)', 'EXECUTE'),
  'authenticated can call lifecycle and score-policy workflow RPCs'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.publish_game(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.create_game_run_score_policy_version(text,integer,integer,integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.approve_game_run_score_policy(uuid,text)', 'EXECUTE'),
  'anon cannot call lifecycle or score-policy workflow RPCs'
);
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.games', 'status', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.games', 'published_at', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.games', 'name', 'UPDATE'),
  'authenticated can edit Game metadata but cannot directly publish'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.game_run_score_policy_approvals', 'SELECT'),
  'anon cannot read policy approval audit data'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.creator_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.creator_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT throws_ok(
  format(
    'SELECT public.create_game_run_score_policy_version(%L, -1, 0, 0)',
    'invalid-negative-policy'
  ),
  '22023',
  'Score policy weights must be non-negative integers.',
  'policy creation rejects invalid scoring coefficients'
);
SELECT set_config(
  'spot_seek_test.policy',
  public.create_game_run_score_policy_version('approved-by-workflow-test', 1200, 50, 100)::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.policy')::jsonb ->> 'is_approved',
  'false',
  'policy creation creates an unapproved immutable definition'
);

SELECT throws_ok(
  format(
    'SELECT public.approve_game_run_score_policy(%L::uuid, %L)',
    current_setting('spot_seek_test.policy')::jsonb ->> 'policy_id', '   '
  ),
  '22023',
  'An approval note is required for the audit record.',
  'approval requires a non-empty audit note'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM auth.users WHERE raw_app_meta_data ->> 'role' = 'admin'),
  1,
  'fixture has exactly one Admin before sole-admin approval'
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'spot_seek_test.solo_approval',
  public.approve_game_run_score_policy(
    (current_setting('spot_seek_test.policy')::jsonb ->> 'policy_id')::uuid,
    'Sole Admin approved v1 with the reviewed coefficients.'
  )::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.solo_approval')::jsonb ->> 'approved_by',
  current_setting('spot_seek_test.creator_id'),
  'the sole Admin can approve their own policy and is recorded as approver'
);
SELECT set_config(
  'spot_seek_test.policy_two',
  public.create_game_run_score_policy_version('two-admin-review-test', 1200, 50, 100)::text,
  true
);
RESET ROLE;

UPDATE auth.users AS auth_user
SET raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb)
  || pg_catalog.jsonb_build_object('role', 'admin')
WHERE auth_user.id = current_setting('spot_seek_test.approver_id')::uuid;
SELECT is(
  (SELECT count(*)::integer FROM auth.users WHERE raw_app_meta_data ->> 'role' = 'admin'),
  2,
  'fixture has two Admins before testing the distinct-approver rule'
);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.creator_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.creator_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  format(
    'SELECT public.approve_game_run_score_policy(%L::uuid, %L)',
    current_setting('spot_seek_test.policy_two')::jsonb ->> 'policy_id', 'self approval with two admins'
  ),
  '42501',
  'A score policy creator can only approve their own policy when they are the sole administrator.',
  'self-approval remains blocked when multiple Admins exist'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.approver_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.approver_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT set_config('spot_seek_test.policy', current_setting('spot_seek_test.policy_two'), true);
SELECT set_config(
  'spot_seek_test.approval',
  public.approve_game_run_score_policy(
    (current_setting('spot_seek_test.policy')::jsonb ->> 'policy_id')::uuid,
    'Reviewed under the local two-person approval test.'
  )::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.approval')::jsonb ->> 'approved_by',
  current_setting('spot_seek_test.approver_id'),
  'approval records the distinct authenticated approver'
);
SELECT is(
  current_setting('spot_seek_test.approval')::jsonb ->> 'approval_note',
  'Reviewed under the local two-person approval test.',
  'approval note is returned as an audit field'
);
SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_score_policy_approvals
   WHERE policy_id = (current_setting('spot_seek_test.policy')::jsonb ->> 'policy_id')::uuid),
  1,
  'approval audit is persisted exactly once'
);
SELECT is(
  public.approve_game_run_score_policy(
    (current_setting('spot_seek_test.policy')::jsonb ->> 'policy_id')::uuid,
    'retry must not rewrite audit'
  ) ->> 'approved_at',
  current_setting('spot_seek_test.approval')::jsonb ->> 'approved_at',
  'approval retry is idempotent and preserves the original audit row'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.creator_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.creator_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    'UPDATE public.games SET status = %L, published_at = pg_catalog.clock_timestamp() WHERE id = %L::uuid',
    'published', current_setting('spot_seek_test.game_id')
  ),
  '42501',
  NULL,
  'direct Game status updates are denied'
);
SELECT set_config(
  'spot_seek_test.game_publish',
  public.publish_game(current_setting('spot_seek_test.game_id')::uuid)::text,
  true
);
SELECT is(
  current_setting('spot_seek_test.game_publish')::jsonb ->> 'status',
  'published',
  'publish_game changes status through the authorized RPC'
);
SELECT is(
  public.publish_game(current_setting('spot_seek_test.game_id')::uuid) ->> 'published_at',
  current_setting('spot_seek_test.game_publish')::jsonb ->> 'published_at',
  'repeated Game publish is idempotent and preserves published_at'
);
SELECT set_config(
  'spot_seek_test.level_publish',
  public.publish_level_with_runtime_rules(current_setting('spot_seek_test.level_id')::uuid)::text,
  true
);
SELECT throws_ok(
  format('SELECT public.unpublish_game(%L::uuid)', current_setting('spot_seek_test.game_id')),
  '55000',
  'Unpublish or archive published levels before changing the parent game.',
  'Game cannot be unpublished while a child Level is published'
);
SELECT is(
  (SELECT status FROM public.games WHERE id = current_setting('spot_seek_test.game_id')::uuid),
  'published',
  'rejected parent transition leaves Game status unchanged'
);
SELECT public.unpublish_level(current_setting('spot_seek_test.level_id')::uuid);
SELECT public.unpublish_game(current_setting('spot_seek_test.game_id')::uuid);
SELECT is(
  (SELECT status FROM public.games WHERE id = current_setting('spot_seek_test.game_id')::uuid),
  'draft',
  'Game can be unpublished after its child Level is unpublished'
);
SELECT public.archive_game(current_setting('spot_seek_test.game_id')::uuid);
SELECT throws_ok(
  format('SELECT public.publish_game(%L::uuid)', current_setting('spot_seek_test.game_id')),
  '55000',
  'Archived games cannot be republished.',
  'archived Game cannot return to published state'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;