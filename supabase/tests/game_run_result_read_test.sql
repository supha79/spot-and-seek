-- Source-only pgTAP coverage. Run only in an approved disposable database.
BEGIN;

SELECT no_plan();

DO $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
  v_game_id uuid := pg_catalog.gen_random_uuid();
  v_level_id uuid := pg_catalog.gen_random_uuid();
  v_policy_id uuid := pg_catalog.gen_random_uuid();
  v_rule_id uuid := pg_catalog.gen_random_uuid();
  v_run_id uuid := pg_catalog.gen_random_uuid();
  v_session_id uuid := pg_catalog.gen_random_uuid();
  v_legacy_run_id uuid := pg_catalog.gen_random_uuid();
  v_legacy_session_id uuid := pg_catalog.gen_random_uuid();
  v_mismatch_link_run_id uuid := pg_catalog.gen_random_uuid();
  v_mismatch_link_session_id uuid := pg_catalog.gen_random_uuid();
  v_mismatch_link_key uuid := pg_catalog.gen_random_uuid();
  v_mismatch_score_run_id uuid := pg_catalog.gen_random_uuid();
  v_mismatch_score_session_id uuid := pg_catalog.gen_random_uuid();
  v_other_run_id uuid := pg_catalog.gen_random_uuid();
  v_other_session_id uuid := pg_catalog.gen_random_uuid();
  v_active_run_id uuid := pg_catalog.gen_random_uuid();
  v_level_key text := 'result-read-' || pg_catalog.left(pg_catalog.replace(v_game_id::text, '-', ''), 20);
  v_legacy_level_id text;
  v_now timestamptz := pg_catalog.clock_timestamp();
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
  SELECT legacy_rule.level_id INTO v_legacy_level_id
  FROM public.game_run_level_rules AS legacy_rule
  ORDER BY legacy_rule.level_id
  LIMIT 1;
  IF v_user_a IS NULL OR v_user_b IS NULL OR v_legacy_level_id IS NULL THEN
    RAISE EXCEPTION 'Create two auth users and apply the Legacy run rules before running this pgTAP file.';
  END IF;

  INSERT INTO public.games (id, slug, name, status, created_by)
  VALUES (v_game_id, v_level_key, 'Result Read Test Game', 'draft', v_user_a);
  INSERT INTO public.levels (
    id, game_id, level_key, difficulty, title, status,
    max_duration_seconds, max_hints, created_by
  )
  VALUES (
    v_level_id, v_game_id, v_level_key, 'easy', 'Pinned Result Level', 'draft',
    120, 3, v_user_a
  );
  INSERT INTO public.game_run_level_key_registry (level_key, content_level_id, created_by)
  VALUES (v_level_key, v_level_id, v_user_a);
  INSERT INTO public.game_run_score_policy_versions (
    id, version, time_weight, wrong_click_penalty, hint_penalty, created_by
  )
  VALUES (v_policy_id, v_level_key, 1000, 10, 20, v_user_a);
  INSERT INTO public.game_run_score_policy_approvals (policy_id, approved_by, approval_note)
  VALUES (v_policy_id, v_user_b, 'Result-read test fixture');
  INSERT INTO public.game_run_rule_versions (
    id, content_level_id, game_id, version, level_key, title, difficulty,
    max_duration_seconds, max_hints, active_spots, score_policy_id,
    score_policy_version, time_weight, wrong_click_penalty, hint_penalty,
    content_hash, created_by
  )
  VALUES (
    v_rule_id, v_level_id, v_game_id, 1, v_level_key, 'Pinned Result Level', 'easy',
    120, 3,
    '[{"spot_key":"flower","label":"Flower","shape":"circle","x_norm":0.5,"y_norm":0.5,"width_norm":null,"height_norm":null,"radius_norm":0.05,"tolerance_norm":0.03,"sort_order":0}]'::jsonb,
    v_policy_id, v_level_key, 1000, 10, 20, pg_catalog.repeat('a', 64), v_user_a
  );

  INSERT INTO public.game_sessions (
    id, user_id, level_id, score, result, idempotency_key, played_at,
    content_level_id, level_key, rule_version_id
  )
  VALUES
    (v_session_id, v_user_a, v_level_key, 940, 'win', v_run_id, v_now, v_level_id, v_level_key, v_rule_id),
    (v_legacy_session_id, v_user_a, v_legacy_level_id, 0, 'loss', v_legacy_run_id, v_now, NULL, NULL, NULL),
    (v_mismatch_link_session_id, v_user_a, v_level_key, 940, 'win', v_mismatch_link_key, v_now, v_level_id, v_level_key, v_rule_id),
    (v_mismatch_score_session_id, v_user_a, v_level_key, 939, 'win', v_mismatch_score_run_id, v_now, v_level_id, v_level_key, v_rule_id),
    (v_other_session_id, v_user_b, v_legacy_level_id, 0, 'loss', v_other_run_id, v_now, NULL, NULL, NULL);

  INSERT INTO public.game_runs (
    id, user_id, level_id, content_level_id, rule_version_id, start_request_id,
    status, started_at, resumed_at, completed_at, ended_at, elapsed_active_seconds,
    wrong_click_count, hint_count, found_spot_count, last_event_number,
    final_score, session_id, updated_at
  )
  VALUES
    (v_run_id, v_user_a, NULL, v_level_id, v_rule_id, pg_catalog.gen_random_uuid(),
     'won', v_now - interval '120 seconds', NULL, v_now - interval '1 second', v_now,
     119, 1, 0, 1, 3, 940, v_session_id, v_now),
    (v_legacy_run_id, v_user_a, v_legacy_level_id, NULL, NULL, pg_catalog.gen_random_uuid(),
     'lost', v_now - interval '120 seconds', NULL, v_now - interval '1 second', v_now,
     120, 2, 1, 0, 3, 0, v_legacy_session_id, v_now),
    (v_mismatch_link_run_id, v_user_a, NULL, v_level_id, v_rule_id, pg_catalog.gen_random_uuid(),
     'won', v_now - interval '120 seconds', NULL, v_now - interval '1 second', v_now,
     119, 1, 0, 1, 3, 940, v_mismatch_link_session_id, v_now),
    (v_mismatch_score_run_id, v_user_a, NULL, v_level_id, v_rule_id, pg_catalog.gen_random_uuid(),
     'won', v_now - interval '120 seconds', NULL, v_now - interval '1 second', v_now,
     119, 1, 0, 1, 3, 940, v_mismatch_score_session_id, v_now),
    (v_other_run_id, v_user_b, v_legacy_level_id, NULL, NULL, pg_catalog.gen_random_uuid(),
     'lost', v_now - interval '120 seconds', NULL, v_now - interval '1 second', v_now,
     120, 2, 1, 0, 3, 0, v_other_session_id, v_now),
    (v_active_run_id, v_user_a, v_legacy_level_id, NULL, NULL, pg_catalog.gen_random_uuid(),
     'active', v_now - interval '10 seconds', v_now - interval '10 seconds', NULL, NULL,
     0, 0, 0, 0, 1, NULL, NULL, v_now);

  PERFORM pg_catalog.set_config('spot_seek_test.result_user_a', v_user_a::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_user_b', v_user_b::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_dynamic_run_id', v_run_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_dynamic_session_id', v_session_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_legacy_run_id', v_legacy_run_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_mismatch_link_run_id', v_mismatch_link_run_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_mismatch_score_run_id', v_mismatch_score_run_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_other_run_id', v_other_run_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_active_run_id', v_active_run_id::text, true);
  PERFORM pg_catalog.set_config('spot_seek_test.result_dynamic_updated_at', v_now::text, true);
END;
$$;

SELECT ok(
  has_function_privilege('authenticated', 'public.get_game_run_result(uuid)', 'EXECUTE'),
  'authenticated can execute the result-read RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_game_run_result(uuid)', 'EXECUTE'),
  'anon cannot execute the result-read RPC'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.game_run_rule_versions', 'SELECT'),
  'authenticated cannot select pinned rule snapshots directly'
);

SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.result_user_a'),
    'role', 'authenticated',
    'app_metadata', pg_catalog.jsonb_build_object('role', 'player')
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.result_user_a'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT is(
  public.get_game_run_result(current_setting('spot_seek_test.result_dynamic_run_id')::uuid) ->> 'score',
  '940',
  'dynamic result score comes from the persisted session'
);
SELECT is(
  public.get_game_run_result(current_setting('spot_seek_test.result_dynamic_run_id')::uuid) #>> '{level,title}',
  'Pinned Result Level',
  'dynamic result includes pinned level metadata'
);
SELECT throws_ok(
  'SELECT public.get_game_run_result(NULL::uuid)',
  'P0002',
  'Game result not found.',
  'a NULL run ID returns the generic not-found error'
);
SELECT throws_ok(
  'SELECT public.get_game_run_result(''00000000-0000-4000-8000-000000000000''::uuid)',
  'P0002',
  'Game result not found.',
  'a nonexistent run ID returns the generic not-found error'
);
SELECT ok(
  public.get_game_run_result(current_setting('spot_seek_test.result_legacy_run_id')::uuid) #>> '{level,title}' IS NULL,
  'legacy result does not invent unavailable pinned metadata'
);
SELECT throws_ok(
  pg_catalog.format(
    'SELECT public.get_game_run_result(%L::uuid)',
    current_setting('spot_seek_test.result_mismatch_link_run_id')
  ),
  'P0002',
  'Game result not found.',
  'a session with a different run idempotency key is not returned'
);
SELECT throws_ok(
  pg_catalog.format(
    'SELECT public.get_game_run_result(%L::uuid)',
    current_setting('spot_seek_test.result_mismatch_score_run_id')
  ),
  'P0002',
  'Game result not found.',
  'a session score that differs from the run score is not returned'
);
SELECT throws_ok(
  pg_catalog.format(
    'SELECT public.get_game_run_result(%L::uuid)',
    current_setting('spot_seek_test.result_other_run_id')
  ),
  'P0002',
  'Game result not found.',
  'another user’s run is indistinguishable from a missing result'
);
SELECT throws_ok(
  pg_catalog.format(
    'SELECT public.get_game_run_result(%L::uuid)',
    current_setting('spot_seek_test.result_active_run_id')
  ),
  'P0002',
  'Game result not found.',
  'an in-progress run is not exposed as a result'
);
SELECT is(
  (SELECT game_run.updated_at::text
   FROM public.game_runs AS game_run
   WHERE game_run.id = current_setting('spot_seek_test.result_dynamic_run_id')::uuid),
  current_setting('spot_seek_test.result_dynamic_updated_at'),
  'reading a result does not update the run'
);
SELECT is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.game_sessions AS game_session
   WHERE game_session.id = current_setting('spot_seek_test.result_dynamic_session_id')::uuid),
  1,
  'reading a result does not create another session'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;