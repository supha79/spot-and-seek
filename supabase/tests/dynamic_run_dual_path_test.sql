-- Exercises the Phase 1 RPCs in a disposable local database only.
-- Requires two auth users and a private gameplay-assets bucket.
-- A test-only policy/approval fixture exercises Dynamic success paths and rolls back with all other fixtures.

BEGIN;

SELECT no_plan();

DO $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
  v_game_id uuid := pg_catalog.gen_random_uuid();
  v_level_id uuid := pg_catalog.gen_random_uuid();
  v_upload_id uuid := pg_catalog.gen_random_uuid();
  v_policy_id uuid := pg_catalog.gen_random_uuid();
  v_suffix text := pg_catalog.replace(v_game_id::text, '-', '');
  v_level_key text := 'rpc-test-' || pg_catalog.left(v_suffix, 20);
  v_has_approved_policy boolean;
  v_legacy_start jsonb;
  v_legacy_timeout jsonb;
BEGIN
  SELECT auth_user.id INTO v_user_a
  FROM auth.users AS auth_user
  ORDER BY auth_user.created_at, auth_user.id
  LIMIT 1;
  SELECT auth_user.id INTO v_user_b
  FROM auth.users AS auth_user
  WHERE auth_user.id <> v_user_a
  ORDER BY auth_user.created_at, auth_user.id
  LIMIT 1;
  IF v_user_a IS NULL OR v_user_b IS NULL THEN
    RAISE EXCEPTION 'Create two local auth users before running this pgTAP file.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets AS bucket
    WHERE bucket.id = 'gameplay-assets' AND bucket.public IS FALSE
  ) THEN
    RAISE EXCEPTION 'Create a private gameplay-assets bucket before running this pgTAP file.';
  END IF;

  INSERT INTO public.game_run_score_policy_versions (
    id, version, time_weight, wrong_click_penalty, hint_penalty, created_by
  )
  VALUES (
    v_policy_id,
    'pgtap-dynamic-' || pg_catalog.left(v_suffix, 16),
    1200, 50, 100, v_user_a
  );
  INSERT INTO public.game_run_score_policy_approvals (policy_id, approved_by, approval_note)
  VALUES (v_policy_id, v_user_b, 'Rollback-only Dynamic pgTAP fixture; not a product approval.');
  v_has_approved_policy := true;

  PERFORM pg_catalog.set_config('spot_seek_test.user_a', v_user_a::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.user_b', v_user_b::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.game_id', v_game_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.level_id', v_level_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.level_key', v_level_key, true);
  PERFORM pg_catalog.set_config('spot_seek_test.has_approved_policy', v_has_approved_policy::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.first_start', '{}'::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.first_finalize', '{}'::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.second_start', '{}'::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.abandon_start', '{}'::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.timeout_start', '{}'::text, true);
  PERFORM pg_catalog.set_config(
    'spot_seek_test.first_rule_version_id',
    '00000000-0000-4000-8000-000000000001',
    true
  );
  PERFORM pg_catalog.set_config(
    'spot_seek_test.second_rule_version_id',
    '00000000-0000-4000-8000-000000000001',
    true
  );
  PERFORM pg_catalog.set_config('spot_seek_test.start_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.legacy_start_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.legacy_wrong_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.legacy_pause_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.legacy_resume_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.legacy_timeout_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.spot_one_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.spot_two_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.pause_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.resume_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.timeout_request_id', pg_catalog.gen_random_uuid()::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.abandon_request_id', pg_catalog.gen_random_uuid()::text, true);

  INSERT INTO public.games (id, slug, name, status, created_by)
  VALUES (
    v_game_id, 'pgtap-' || v_suffix, 'RPC Test Game', 'draft', v_user_a
  );
  INSERT INTO public.levels (
    id, game_id, level_key, difficulty, title, status, max_duration_seconds,
    max_hints, created_by
  )
  VALUES (
    v_level_id, v_game_id, v_level_key, 'easy', 'RPC Test Level', 'draft',
    120, 3, v_user_a
  );
  INSERT INTO public.level_spots (
    level_id, spot_key, label, shape, x_norm, y_norm, radius_norm, is_active
  )
  VALUES
    (v_level_id, 'spot-one', 'Spot One', 'circle', 0.2, 0.2, 0.05, true),
    (v_level_id, 'spot-two', 'Spot Two', 'circle', 0.7, 0.7, 0.05, true);
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
     NULL, 'image/png', 640, 480, 1024, true, v_user_a),
    (v_level_id, 'comparison', 'gameplay-assets',
     v_level_id::text || '/' || v_upload_id::text || '/comparison.webp',
     NULL, 'image/webp', 640, 480, 2048, true, v_user_a);

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_user_a, 'role', 'authenticated',
      'app_metadata', pg_catalog.jsonb_build_object('role', 'admin')
    )::text,
    true
  );
  PERFORM public.publish_game(v_game_id);

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_user_a, 'role', 'authenticated',
      'app_metadata', pg_catalog.jsonb_build_object('role', 'player')
    )::text,
    true
  );
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

  v_legacy_start := public.start_game_run(
    'cozy-cat-corner', current_setting('spot_seek_test.legacy_start_request_id')::uuid
  );
  PERFORM pg_catalog.set_config('spot_seek_test.legacy_start', v_legacy_start::text, true);
  PERFORM public.record_game_run_event(
    (v_legacy_start ->> 'run_id')::uuid,
    current_setting('spot_seek_test.legacy_wrong_request_id')::uuid,
    'wrong_click'
  );
  PERFORM public.pause_game_run(
    (v_legacy_start ->> 'run_id')::uuid,
    current_setting('spot_seek_test.legacy_pause_request_id')::uuid
  );
  PERFORM public.resume_game_run(
    (v_legacy_start ->> 'run_id')::uuid,
    current_setting('spot_seek_test.legacy_resume_request_id')::uuid
  );
  UPDATE public.game_runs
  SET started_at = pg_catalog.clock_timestamp() - interval '122 seconds',
      resumed_at = pg_catalog.clock_timestamp() - interval '121 seconds'
  WHERE id = (v_legacy_start ->> 'run_id')::uuid;
  v_legacy_timeout := public.record_game_run_event(
    (v_legacy_start ->> 'run_id')::uuid,
    current_setting('spot_seek_test.legacy_timeout_request_id')::uuid,
    'wrong_click'
  );
  PERFORM pg_catalog.set_config('spot_seek_test.legacy_timeout', v_legacy_timeout::text, true);
  PERFORM pg_catalog.set_config(
    'spot_seek_test.legacy_timeout_retry',
    public.record_game_run_event(
      (v_legacy_start ->> 'run_id')::uuid,
      current_setting('spot_seek_test.legacy_timeout_request_id')::uuid,
      'wrong_click'
    )::text,
    true
  );
END;
$$;

SELECT is(
  (current_setting('spot_seek_test.legacy_start')::jsonb ->> 'level_id'),
  'cozy-cat-corner',
  'legacy start still uses the legacy level key'
);
SELECT is(
  (current_setting('spot_seek_test.legacy_timeout')::jsonb ->> 'status'),
  'lost',
  'legacy event after deadline finalizes through the legacy timeout path'
);
SELECT is(
  (current_setting('spot_seek_test.legacy_timeout')::jsonb ->> 'session_id'),
  (current_setting('spot_seek_test.legacy_timeout_retry')::jsonb ->> 'session_id'),
  'retrying the legacy timeout request returns the same terminal session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.game_run_events
   WHERE run_id = (current_setting('spot_seek_test.legacy_start')::jsonb ->> 'run_id')::uuid
     AND event_type = 'timed_out'),
  1,
  'legacy timeout retry does not create another terminal event'
);
SELECT is(
  (public.start_game_run(
    'cozy-cat-corner', current_setting('spot_seek_test.legacy_start_request_id')::uuid
  ) ->> 'run_id'),
  (current_setting('spot_seek_test.legacy_start')::jsonb ->> 'run_id'),
  'legacy start retry with the same key returns its original run'
);
SELECT throws_ok(
  format(
    'SELECT public.start_game_run(%L, %L::uuid)',
    'sunny-picnic', current_setting('spot_seek_test.legacy_start_request_id')
  ),
  '22023',
  'Request ID was already used to start a different level.',
  'legacy start request ID cannot be reused for a different key'
);

SELECT is(
  (SELECT is_enabled FROM public.game_run_feature_gates WHERE gate_name = 'dynamic_gameplay'),
  false,
  'dynamic gameplay is disabled by default'
);

SELECT throws_ok(
  format(
    'SELECT public.start_game_run(%L, %L::uuid)',
    current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.start_request_id')
  ),
  '55000',
  'Dynamic gameplay is disabled.',
  'dynamic start fails closed while the feature gate is off'
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player'),
    'user_metadata', jsonb_build_object('role', 'admin')
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
  'user_metadata role cannot grant Admin publishing authority'
);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.start_game_run(text,uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.start_game_run(text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.start_game_run_for_rule_version(text,uuid,uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.start_game_run_for_rule_version(text,uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public._start_game_run_without_version_guard(text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public._start_game_run_without_version_guard(text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public._dynamic_mutate_game_run(uuid,uuid,text,text,text)', 'EXECUTE'),
  'Start RPCs are authenticated-only; unchecked dispatcher and dynamic helper remain private'
);

SELECT * FROM skip(
  29,
  'Dynamic lifecycle assertions require an existing owner-approved score policy; this test creates none.'
)
WHERE NOT current_setting('spot_seek_test.has_approved_policy')::boolean;

DO $$
DECLARE
  v_publish_result jsonb;
BEGIN
  IF NOT current_setting('spot_seek_test.has_approved_policy')::boolean THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
      'app_metadata', pg_catalog.jsonb_build_object('role', 'admin')
    )::text,
    true
  );
  UPDATE public.game_run_feature_gates
  SET is_enabled = true
  WHERE gate_name = 'dynamic_gameplay';
  v_publish_result := public.publish_level_with_runtime_rules(
    current_setting('spot_seek_test.level_id')::uuid
  );
  PERFORM pg_catalog.set_config(
    'spot_seek_test.first_rule_version_id',
    v_publish_result ->> 'rule_version_id', true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_a'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT throws_ok(
  format(
    'SELECT public.start_game_run(%L, %L::uuid)',
    current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.start_request_id')
  ),
  '55000',
  'Dynamic Start requires an expected published rule version.',
  'direct Dynamic start cannot bypass the expected artwork version'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT throws_ok(
  format(
    'SELECT public.start_game_run_for_rule_version(%L, %L::uuid, %L::uuid)',
    current_setting('spot_seek_test.level_key'),
    '00000000-0000-4000-8000-000000000001',
    current_setting('spot_seek_test.start_request_id')
  ),
  '55000',
  'Published level rules changed. Reload artwork before starting.',
  'stale artwork rule version rejects and rolls back Dynamic start'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (SELECT count(*)::integer FROM public.game_runs
   WHERE user_id = current_setting('spot_seek_test.user_a')::uuid
     AND start_request_id = current_setting('spot_seek_test.start_request_id')::uuid),
  0,
  'mismatched artwork version leaves no Dynamic run or consumed request ID'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT CASE
  WHEN current_setting('spot_seek_test.has_approved_policy')::boolean THEN
    (public.start_game_run_for_rule_version(
      current_setting('spot_seek_test.level_key'),
      current_setting('spot_seek_test.first_rule_version_id')::uuid,
      current_setting('spot_seek_test.start_request_id')::uuid
    ) ->> 'run_id')
  ELSE 'skipped'
END AS dynamic_run_id;

SELECT CASE
  WHEN current_setting('spot_seek_test.has_approved_policy')::boolean THEN
    set_config(
      'spot_seek_test.first_start',
      public.start_game_run_for_rule_version(
        current_setting('spot_seek_test.level_key'),
        current_setting('spot_seek_test.first_rule_version_id')::uuid,
        current_setting('spot_seek_test.start_request_id')::uuid
      )::text,
      true
    )
  ELSE 'skipped'
END AS start_retry;

SELECT is(
  (SELECT count(*)::integer FROM public.game_runs
   WHERE id = (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid),
  1,
  'run owner can read their dynamic run'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_b'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_b'), true);
SELECT is(
  (SELECT count(*)::integer FROM public.game_runs
   WHERE id = (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid),
  0,
  'another player cannot read the run through RLS'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_b'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT is(
  (SELECT count(*)::integer FROM public.game_runs
   WHERE id = (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid),
  1,
  'Admin app_metadata can read another player run'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_b'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player'),
    'user_metadata', jsonb_build_object('role', 'admin')
  )::text,
  true
);
SELECT is(
  (SELECT count(*)::integer FROM public.game_runs
   WHERE id = (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid),
  0,
  'user_metadata role cannot bypass run RLS'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_a'), true);

SELECT is(
  (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id'),
  (SELECT id::text FROM public.game_runs
   WHERE user_id = current_setting('spot_seek_test.user_a')::uuid
     AND start_request_id = current_setting('spot_seek_test.start_request_id')::uuid),
  'dynamic start retry returns the original run'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (current_setting('spot_seek_test.first_start')::jsonb ->> 'rule_version_id'),
  current_setting('spot_seek_test.first_rule_version_id'),
  'dynamic run pins the published rule version'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT throws_ok(
  format(
    'SELECT public.start_game_run_for_rule_version(%L, %L::uuid, %L::uuid)',
    'different-' || current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.first_rule_version_id'),
    current_setting('spot_seek_test.start_request_id')
  ),
  '22023',
  'Request ID was already used to start a different level.',
  'start request ID cannot be reused for another level'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT throws_ok(
  format(
    'SELECT public.record_game_run_event(%L::uuid, %L::uuid, %L, NULL)',
    current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id',
    current_setting('spot_seek_test.spot_one_request_id'), 'spot_found'
  ),
  '22023',
  'Spot ID must be present only for spot_found events.',
  'spot event requires its server-validated key'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (public.record_game_run_event(
    (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid,
    current_setting('spot_seek_test.spot_one_request_id')::uuid,
    'spot_found', 'spot-one'
  ) ->> 'found_count'),
  '1',
  'dynamic event accepts a spot from the pinned snapshot'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT throws_ok(
  format(
    'SELECT public.record_game_run_event(%L::uuid, %L::uuid, %L, NULL)',
    current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id',
    current_setting('spot_seek_test.spot_one_request_id'), 'wrong_click'
  ),
  '22023',
  'Request ID was already used for a different event.',
  'event request payload conflict is rejected'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT throws_ok(
  format(
    'SELECT public.record_game_run_event(%L::uuid, %L::uuid, %L, %L)',
    current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id',
    current_setting('spot_seek_test.spot_two_request_id'), 'spot_found', 'not-in-snapshot'
  ),
  '22023',
  'Spot ID is not valid for this level.',
  'dynamic event rejects a spot outside the pinned snapshot'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (SELECT found_spot_count FROM public.game_runs
   WHERE id = (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid),
  1,
  'invalid spot failure leaves run counters unchanged'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT throws_ok(
  format(
    'SELECT public.record_game_run_event(%L::uuid, %L::uuid, %L, %L)',
    current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id',
    pg_catalog.gen_random_uuid(), 'spot_found', 'spot-one'
  ),
  '23505',
  'Spot was already accepted for this run.',
  'a spot cannot be counted twice with a fresh request ID'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT public.record_game_run_event(
  (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid,
  pg_catalog.gen_random_uuid(), 'hint_used'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT public.record_game_run_event(
  (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid,
  pg_catalog.gen_random_uuid(), 'hint_used'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT public.record_game_run_event(
  (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid,
  pg_catalog.gen_random_uuid(), 'hint_used'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT throws_ok(
  format(
    'SELECT public.record_game_run_event(%L::uuid, %L::uuid, %L)',
    current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id',
    pg_catalog.gen_random_uuid(), 'hint_used'
  ),
  '22023',
  'No hints remain for this run.',
  'dynamic hint counter cannot exceed the pinned maximum'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (public.pause_game_run(
    (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid,
    current_setting('spot_seek_test.pause_request_id')::uuid
  ) ->> 'status'),
  'paused',
  'dynamic run can pause'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (public.resume_game_run(
    (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid,
    current_setting('spot_seek_test.resume_request_id')::uuid
  ) ->> 'status'),
  'active',
  'dynamic run can resume without changing its pinned rules'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (SELECT count(*)::integer FROM public.game_runs
   WHERE id = (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid
     AND content_level_id = current_setting('spot_seek_test.level_id')::uuid
     AND rule_version_id = current_setting('spot_seek_test.first_rule_version_id')::uuid
     AND level_id IS NULL),
  1,
  'run stores dynamic content identity separately from legacy level_id'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

RESET ROLE;

DO $$
DECLARE
  v_run_id uuid;
  v_new_publish jsonb;
BEGIN
  IF NOT current_setting('spot_seek_test.has_approved_policy')::boolean THEN
    RETURN;
  END IF;

  v_run_id := (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid;
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
      'app_metadata', pg_catalog.jsonb_build_object('role', 'admin')
    )::text,
    true
  );
  PERFORM public.unpublish_level(current_setting('spot_seek_test.level_id')::uuid);
  UPDATE public.levels
  SET title = 'RPC Test Level Revised'
  WHERE id = current_setting('spot_seek_test.level_id')::uuid;
  v_new_publish := public.publish_level_with_runtime_rules(
    current_setting('spot_seek_test.level_id')::uuid
  );
  PERFORM pg_catalog.set_config('spot_seek_test.second_rule_version_id', v_new_publish ->> 'rule_version_id', true);
  IF v_new_publish ->> 'rule_version_id' = current_setting('spot_seek_test.first_rule_version_id') THEN
    RAISE EXCEPTION 'Changed runtime content did not create a new rule version.';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_a'), true);

SELECT is(
  (public.record_game_run_event(
    (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid,
    current_setting('spot_seek_test.spot_two_request_id')::uuid,
    'spot_found', 'spot-two'
  ) ->> 'status'),
  'completed',
  'active run continues on its pinned snapshot after republish'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT set_config(
  'spot_seek_test.first_finalize',
  public.finish_game_run(
    (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid
  )::text,
  true
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT is(
  (current_setting('spot_seek_test.first_finalize')::jsonb ->> 'status'),
  'won',
  'dynamic finalize scores using the approved policy pinned in its runtime version'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT is(
  (public.finish_game_run(
    (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid
  ) ->> 'session_id'),
  (current_setting('spot_seek_test.first_finalize')::jsonb ->> 'session_id'),
  'finalize retry returns the original session'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT is(
  (SELECT count(*)::integer FROM public.game_sessions
   WHERE id = (SELECT session_id FROM public.game_runs
               WHERE id = (current_setting('spot_seek_test.first_start')::jsonb ->> 'run_id')::uuid)
     AND content_level_id = current_setting('spot_seek_test.level_id')::uuid
     AND rule_version_id = current_setting('spot_seek_test.first_rule_version_id')::uuid),
  1,
  'finalized session records the pinned content and rule version'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT set_config(
  'spot_seek_test.second_start',
  public.start_game_run_for_rule_version(
    current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.second_rule_version_id')::uuid,
    pg_catalog.gen_random_uuid()
  )::text,
  true
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT is(
  (current_setting('spot_seek_test.second_start')::jsonb ->> 'rule_version_id'),
  current_setting('spot_seek_test.second_rule_version_id'),
  'a new run pins the latest published version'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT set_config(
  'spot_seek_test.abandon_start',
  public.start_game_run_for_rule_version(
    current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.second_rule_version_id')::uuid,
    pg_catalog.gen_random_uuid()
  )::text,
  true
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT is(
  (public.abandon_game_run(
    (current_setting('spot_seek_test.abandon_start')::jsonb ->> 'run_id')::uuid,
    current_setting('spot_seek_test.abandon_request_id')::uuid
  ) ->> 'status'),
  'abandoned',
  'dynamic run can be abandoned'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT is(
  (SELECT count(*)::integer FROM public.game_sessions
   WHERE id = (SELECT session_id FROM public.game_runs
               WHERE id = (current_setting('spot_seek_test.abandon_start')::jsonb ->> 'run_id')::uuid)),
  0,
  'abandon does not create a game session'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_a'), 'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_a'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'spot_seek_test.timeout_start',
  public.start_game_run_for_rule_version(
    current_setting('spot_seek_test.level_key'),
    current_setting('spot_seek_test.second_rule_version_id')::uuid,
    pg_catalog.gen_random_uuid()
  )::text,
  true
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

UPDATE public.game_runs
SET started_at = pg_catalog.clock_timestamp() - interval '122 seconds',
    resumed_at = pg_catalog.clock_timestamp() - interval '121 seconds'
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean
  AND id = CASE
    WHEN current_setting('spot_seek_test.has_approved_policy')::boolean THEN
      (current_setting('spot_seek_test.timeout_start')::jsonb ->> 'run_id')::uuid
    ELSE NULL::uuid
  END;

SET LOCAL ROLE authenticated;
SELECT is(
  (public.record_game_run_event(
    (current_setting('spot_seek_test.timeout_start')::jsonb ->> 'run_id')::uuid,
    current_setting('spot_seek_test.timeout_request_id')::uuid,
    'wrong_click'
  ) ->> 'status'),
  'lost',
  'dynamic event observing the server-side deadline finalizes as loss'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;
SELECT is(
  (public.record_game_run_event(
    (current_setting('spot_seek_test.timeout_start')::jsonb ->> 'run_id')::uuid,
    current_setting('spot_seek_test.timeout_request_id')::uuid,
    'wrong_click'
  ) ->> 'session_id'),
  (SELECT session_id::text FROM public.game_runs
   WHERE id = (current_setting('spot_seek_test.timeout_start')::jsonb ->> 'run_id')::uuid),
  'dynamic timeout request retry returns the same terminal session'
)
WHERE current_setting('spot_seek_test.has_approved_policy')::boolean;

SELECT * FROM finish();
ROLLBACK;