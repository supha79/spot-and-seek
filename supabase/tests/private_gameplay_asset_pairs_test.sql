-- Source-only pgTAP coverage. Run only in an approved disposable Supabase database.
-- Requires the existing private gameplay-assets bucket; fixture objects roll back with this transaction.
BEGIN;

SELECT no_plan();

DO $$
DECLARE
  v_admin_id uuid;
  v_player_id uuid;
  v_game_id uuid := pg_catalog.gen_random_uuid();
  v_level_id uuid := pg_catalog.gen_random_uuid();
  v_upload_id uuid := pg_catalog.gen_random_uuid();
  v_orphan_upload_id uuid := pg_catalog.gen_random_uuid();
  v_policy_id uuid := pg_catalog.gen_random_uuid();
  v_level_key text := 'asset-pair-' || pg_catalog.left(pg_catalog.replace(v_game_id::text, '-', ''), 20);
BEGIN
  SELECT auth_user.id INTO v_admin_id
  FROM auth.users AS auth_user
  ORDER BY auth_user.created_at, auth_user.id
  LIMIT 1;
  SELECT auth_user.id INTO v_player_id
  FROM auth.users AS auth_user
  WHERE auth_user.id <> v_admin_id
  ORDER BY auth_user.created_at, auth_user.id
  LIMIT 1;
  IF v_admin_id IS NULL OR v_player_id IS NULL THEN
    RAISE EXCEPTION 'Create two local auth users before running this pgTAP file.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets AS bucket
    WHERE bucket.id = 'gameplay-assets' AND bucket.public IS FALSE
  ) THEN
    RAISE EXCEPTION 'Create a private gameplay-assets bucket before running this pgTAP file.';
  END IF;

  INSERT INTO public.games (id, slug, name, status, created_by)
  VALUES (v_game_id, v_level_key, 'Asset Pair Test Game', 'draft', v_admin_id);
  INSERT INTO public.levels (
    id, game_id, level_key, difficulty, title, status,
    max_duration_seconds, max_hints, created_by
  )
  VALUES (
    v_level_id, v_game_id, v_level_key, 'easy', 'Asset Pair Test Level', 'draft',
    120, 3, v_admin_id
  );
  INSERT INTO public.level_spots (
    level_id, spot_key, label, shape, x_norm, y_norm, radius_norm
  )
  VALUES (v_level_id, 'flower', 'Flower', 'circle', 0.5, 0.5, 0.05);
  INSERT INTO public.game_run_score_policy_versions (
    id, version, time_weight, wrong_click_penalty, hint_penalty, created_by
  )
  VALUES (v_policy_id, v_level_key, 1000, 10, 20, v_admin_id);
  INSERT INTO public.game_run_score_policy_approvals (policy_id, approved_by, approval_note)
  VALUES (v_policy_id, v_player_id, 'Private gameplay asset policy test fixture');

  PERFORM pg_catalog.set_config('spot_seek_test.asset_admin_id', v_admin_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.asset_player_id', v_player_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.asset_game_id', v_game_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.asset_level_id', v_level_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.asset_level_key', v_level_key, true);
  PERFORM pg_catalog.set_config('spot_seek_test.asset_upload_id', v_upload_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.asset_orphan_upload_id', v_orphan_upload_id::text, true);
END;
$$;

SELECT ok(
  has_function_privilege('authenticated', 'public.register_level_asset_pair(uuid,jsonb,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.register_level_asset_pair(uuid,jsonb,jsonb)', 'EXECUTE'),
  'only authenticated users can call the asset-pair registration RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.read_published_level_asset_pair(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.read_published_level_asset_pair(uuid)', 'EXECUTE')
  AND pg_catalog.to_regprocedure('public.get_published_level_asset_pair(uuid)') IS NULL,
  'the frontend Player read contract is the only published-pair RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gameplay_assets_admin_insert_draft'
      AND cmd = 'INSERT' AND roles = ARRAY['authenticated']::name[]
      AND with_check LIKE '%gameplay-assets%'
      AND with_check LIKE '%_can_insert_gameplay_asset_object%'
  )
  AND EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gameplay_assets_select_managed_or_published'
      AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%_can_select_gameplay_asset_object%'
  )
  AND EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gameplay_assets_admin_insert_draft_guard'
      AND cmd = 'INSERT' AND permissive = 'RESTRICTIVE'
      AND roles = ARRAY['public']::name[]
  )
  AND EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'gameplay_assets_select_managed_or_published_guard'
      AND cmd = 'SELECT' AND permissive = 'RESTRICTIVE'
      AND roles = ARRAY['public']::name[]
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'gameplay_assets_%'
      AND cmd IN ('UPDATE', 'DELETE')
  ),
  'gameplay asset storage policies permit scoped INSERT/SELECT only'
);

SELECT ok(
  pg_catalog.pg_get_functiondef('public._can_insert_gameplay_asset_object(text)'::regprocedure)
    NOT ILIKE '%storage.objects%'
  AND pg_catalog.pg_get_functiondef('public._can_select_gameplay_asset_object(text)'::regprocedure)
    NOT ILIKE '%storage.objects%',
  'storage policy helpers do not query storage.objects and cannot recurse through its RLS'
);

SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_admin_id'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_admin_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  pg_catalog.format(
    'INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (%L, %L, %L::jsonb)',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png',
    pg_catalog.jsonb_build_object('mimetype', 'image/png', 'size', 1024, 'width', 640, 'height', 480)::text
  ),
  'Admin can INSERT an image object under a Draft Level path'
);

SELECT throws_ok(
  pg_catalog.format(
    'INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (%L, %L, %L::jsonb)',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/thumbnail.png',
    pg_catalog.jsonb_build_object('mimetype', 'image/png', 'size', 1024)::text
  ),
  '42501',
  NULL,
  'Admin cannot INSERT an object with a path outside the allowed Original/Comparison format'
);

SELECT throws_ok(
  pg_catalog.format(
    'SELECT public.publish_level_with_runtime_rules(%L::uuid)',
    current_setting('spot_seek_test.asset_level_id')
  ),
  '55000',
  'A valid private Original and Comparison image pair is required to publish.',
  'a level without a verified image pair cannot be published'
);

INSERT INTO public.level_assets (
  level_id, asset_type, bucket_name, storage_path, public_url,
  mime_type, width, height, file_size_bytes, is_primary, created_by
)
VALUES (
  current_setting('spot_seek_test.asset_level_id')::uuid,
  'original', 'gameplay-assets',
  current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_orphan_upload_id') || '/original.png',
  NULL, 'image/png', 640, 480, 1024, true,
  current_setting('spot_seek_test.asset_admin_id')::uuid
);

SELECT throws_ok(
  pg_catalog.format(
    'INSERT INTO public.level_assets (
       level_id, asset_type, bucket_name, storage_path, public_url,
       mime_type, width, height, file_size_bytes, is_primary, created_by
     ) VALUES (%L::uuid, %L, %L, %L, NULL, %L, 640, 480, 1024, true, %L::uuid)',
    current_setting('spot_seek_test.asset_level_id'),
    'original',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/another-original.png',
    'image/png',
    current_setting('spot_seek_test.asset_admin_id')
  ),
  '23505',
  NULL,
  'a level cannot have two primary assets of the same type'
);

SELECT throws_ok(
  pg_catalog.format(
    'SELECT public.register_level_asset_pair(%L::uuid, %L::jsonb, %L::jsonb)',
    current_setting('spot_seek_test.asset_level_id'),
    pg_catalog.jsonb_build_object(
      'storage_path', current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png',
      'mime_type', 'image/png', 'width', 640, 'height', 480, 'file_size_bytes', 1024
    )::text,
    pg_catalog.jsonb_build_object(
      'storage_path', current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/comparison.webp',
      'mime_type', 'image/webp', 'width', 640, 'height', 480, 'file_size_bytes', 2048
    )::text
  ),
  '22023',
  'Both artwork files must be valid, private, and have matching dimensions.',
  'missing Storage objects do not register a partial pair'
);

SELECT ok(
  (SELECT asset.is_primary
   FROM public.level_assets AS asset
   WHERE asset.level_id = current_setting('spot_seek_test.asset_level_id')::uuid
     AND asset.asset_type = 'original'),
  'the existing primary remains selected after a rejected duplicate'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_player_id'),
    'role', 'authenticated'
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_player_id'), true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  pg_catalog.format(
    'INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (%L, %L, %L::jsonb)',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/comparison.webp',
    pg_catalog.jsonb_build_object('mimetype', 'image/webp', 'size', 2048)::text
  ),
  '42501',
  NULL,
  'Player cannot INSERT an image object even under a Draft Level path'
);

SELECT throws_ok(
  pg_catalog.format(
    'SELECT public.register_level_asset_pair(%L::uuid, %L::jsonb, %L::jsonb)',
    current_setting('spot_seek_test.asset_level_id'),
    pg_catalog.jsonb_build_object(
      'storage_path', current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png',
      'mime_type', 'image/png', 'width', 640, 'height', 480, 'file_size_bytes', 1024
    )::text,
    pg_catalog.jsonb_build_object(
      'storage_path', current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/comparison.webp',
      'mime_type', 'image/webp', 'width', 640, 'height', 480, 'file_size_bytes', 2048
    )::text
  ),
  '42501',
  'Administrator role required.',
  'a Player cannot register or replace the image pair'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_admin_id'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_admin_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  pg_catalog.format(
    'INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (%L, %L, %L::jsonb)',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/comparison.webp',
    pg_catalog.jsonb_build_object('mimetype', 'image/webp', 'size', 2048, 'width', 640, 'height', 480)::text
  ),
  'Admin can INSERT the Comparison object under a Draft Level path'
);

SELECT lives_ok(
  pg_catalog.format(
    'INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (%L, %L, %L::jsonb)',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_orphan_upload_id') || '/original.png',
    pg_catalog.jsonb_build_object('mimetype', 'image/png', 'size', 1024)::text
  ),
  'Admin can upload an object that remains unpinned for the Player denial case'
);

SELECT lives_ok(
  pg_catalog.format(
    'SELECT public.register_level_asset_pair(%L::uuid, %L::jsonb, %L::jsonb)',
    current_setting('spot_seek_test.asset_level_id'),
    pg_catalog.jsonb_build_object(
      'storage_path', current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png',
      'mime_type', 'image/png', 'width', 640, 'height', 480, 'file_size_bytes', 1024
    )::text,
    pg_catalog.jsonb_build_object(
      'storage_path', current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/comparison.webp',
      'mime_type', 'image/webp', 'width', 640, 'height', 480, 'file_size_bytes', 2048
    )::text
  ),
  'Admin can register the uploaded pair before publishing'
);

SELECT is(
  (SELECT count(*)::integer
   FROM storage.objects AS storage_object
   WHERE storage_object.bucket_id = 'gameplay-assets'
     AND storage_object.name = current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png'),
  1,
  'Admin can SELECT a registered Draft image for the management preview'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_player_id'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_player_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer
   FROM storage.objects AS storage_object
   WHERE storage_object.bucket_id = 'gameplay-assets'
     AND storage_object.name = current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png'),
  0,
  'Player cannot SELECT a registered asset while its Level is Draft'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_admin_id'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_admin_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  pg_catalog.format('SELECT public.publish_game(%L::uuid)', current_setting('spot_seek_test.asset_game_id')),
  'Admin publishes the fixture Game through its lifecycle RPC'
);
SELECT lives_ok(
  pg_catalog.format('SELECT public.publish_level_with_runtime_rules(%L::uuid)', current_setting('spot_seek_test.asset_level_id')),
  'Admin publishes the fixture Level with its pinned asset pair'
);

SELECT is(
  (SELECT game.status FROM public.games AS game
   WHERE game.id = current_setting('spot_seek_test.asset_game_id')::uuid),
  'published',
  'fixture parent Game is Published for the Player SELECT case'
);

SELECT is(
  (SELECT level.status FROM public.levels AS level
   WHERE level.id = current_setting('spot_seek_test.asset_level_id')::uuid),
  'published',
  'fixture Level is Published for the Player SELECT case'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::integer
   FROM public.game_run_rule_versions AS rule_version
   WHERE rule_version.content_level_id = current_setting('spot_seek_test.asset_level_id')::uuid
     AND rule_version.original_asset_id IS NOT NULL
     AND rule_version.comparison_asset_id IS NOT NULL),
  1,
  'published rule version pins both registered assets'
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  pg_catalog.format(
    'INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (%L, %L, %L::jsonb)',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_orphan_upload_id') || '/comparison.webp',
    pg_catalog.jsonb_build_object('mimetype', 'image/webp', 'size', 2048)::text
  ),
  '42501',
  NULL,
  'Admin cannot INSERT new objects after the Level is Published'
);

SELECT is(
  (SELECT count(*)::integer
   FROM storage.objects AS storage_object
   WHERE storage_object.bucket_id = 'gameplay-assets'
     AND storage_object.name IN (
       current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png',
       current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/comparison.webp'
     )),
  2,
  'Admin can SELECT both registered Published assets for management preview'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_player_id'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_player_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer
   FROM storage.objects AS storage_object
   WHERE storage_object.bucket_id = 'gameplay-assets'
     AND storage_object.name IN (
       current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png',
       current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/comparison.webp'
     )),
  2,
  'an authenticated user without an app-role claim can SELECT only assets pinned to the Published Level/Game rule version'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_admin_id'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_admin_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer
   FROM storage.objects AS storage_object
   WHERE storage_object.bucket_id = 'gameplay-assets'
     AND storage_object.name = current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_orphan_upload_id') || '/original.png'),
  1,
  'Admin can SELECT the unpinned object before the Player denial check'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.asset_player_id'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.asset_player_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::integer
   FROM storage.objects AS storage_object
   WHERE storage_object.bucket_id = 'gameplay-assets'
     AND storage_object.name = current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_orphan_upload_id') || '/original.png'),
  0,
  'Player cannot SELECT an unpinned object under a Published Level path'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'role', 'anon',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;

SELECT is(
  (SELECT count(*)::integer
   FROM storage.objects AS storage_object
   WHERE storage_object.bucket_id = 'gameplay-assets'
     AND storage_object.name = current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_upload_id') || '/original.png'),
  0,
  'anonymous role cannot SELECT a Player-visible Published asset'
);

SELECT throws_ok(
  pg_catalog.format(
    'INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (%L, %L, %L::jsonb)',
    'gameplay-assets',
    current_setting('spot_seek_test.asset_level_id') || '/' || current_setting('spot_seek_test.asset_orphan_upload_id') || '/original.png',
    pg_catalog.jsonb_build_object('mimetype', 'image/png', 'size', 1024)::text
  ),
  '42501',
  NULL,
  'anonymous role cannot INSERT gameplay assets'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
