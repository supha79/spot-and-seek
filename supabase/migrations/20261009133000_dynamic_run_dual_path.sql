-- Phase 1: retain the existing legacy RPC implementation and add a pinned dynamic path.
-- Dynamic gameplay is deliberately disabled until a separate reviewed enablement change.

CREATE TABLE public.game_run_feature_gates (
  gate_name text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT game_run_feature_gates_name_valid
    CHECK (gate_name = 'dynamic_gameplay')
);

INSERT INTO public.game_run_feature_gates (gate_name, is_enabled)
VALUES ('dynamic_gameplay', false);

ALTER TABLE public.game_run_feature_gates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_run_feature_gates FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.guard_game_run_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.start_request_id IS DISTINCT FROM OLD.start_request_id
    OR NEW.level_id IS DISTINCT FROM OLD.level_id
    OR NEW.content_level_id IS DISTINCT FROM OLD.content_level_id
    OR NEW.rule_version_id IS DISTINCT FROM OLD.rule_version_id THEN
    RAISE EXCEPTION 'Game run identity is immutable.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_runs_identity_immutable
  BEFORE UPDATE ON public.game_runs
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_run_identity();

REVOKE ALL ON FUNCTION public.guard_game_run_identity() FROM PUBLIC, anon, authenticated;

-- Keep the old bodies intact. Their helpers continue reading legacy rules and policy.
ALTER FUNCTION public.start_game_run(text, uuid) RENAME TO _legacy_start_game_run;
ALTER FUNCTION public.record_game_run_event(uuid, uuid, text, text)
  RENAME TO _legacy_record_game_run_event;
ALTER FUNCTION public.pause_game_run(uuid, uuid) RENAME TO _legacy_pause_game_run;
ALTER FUNCTION public.resume_game_run(uuid, uuid) RENAME TO _legacy_resume_game_run;
ALTER FUNCTION public.finish_game_run(uuid) RENAME TO _legacy_finish_game_run;
ALTER FUNCTION public.abandon_game_run(uuid, uuid) RENAME TO _legacy_abandon_game_run;

REVOKE ALL ON FUNCTION public._legacy_start_game_run(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._legacy_record_game_run_event(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._legacy_pause_game_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._legacy_resume_game_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._legacy_finish_game_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._legacy_abandon_game_run(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public._dynamic_game_run_response(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.game_runs%ROWTYPE;
  v_rule public.game_run_rule_versions%ROWTYPE;
  v_elapsed numeric(12, 3);
BEGIN
  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_rule_versions AS rule_version
  WHERE rule_version.id = v_run.rule_version_id
    AND rule_version.content_level_id = v_run.content_level_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pinned game run rules not found.' USING ERRCODE = 'P0002';
  END IF;

  v_elapsed := v_run.elapsed_active_seconds;
  IF v_run.status = 'active' THEN
    v_elapsed := v_elapsed + GREATEST(
      EXTRACT(EPOCH FROM (pg_catalog.clock_timestamp() - v_run.resumed_at)), 0
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'run_id', v_run.id,
    'level_id', v_rule.level_key,
    'level_key', v_rule.level_key,
    'content_level_id', v_run.content_level_id,
    'rule_version_id', v_run.rule_version_id,
    'status', v_run.status,
    'result', CASE
      WHEN v_run.status = 'won' THEN 'win'
      WHEN v_run.status = 'lost' THEN 'loss'
      ELSE NULL
    END,
    'elapsed_active_seconds', pg_catalog.round(v_elapsed, 3),
    'time_remaining_seconds', pg_catalog.round(
      GREATEST(v_rule.max_duration_seconds - v_elapsed, 0), 3
    ),
    'wrong_clicks', v_run.wrong_click_count,
    'hints_used', v_run.hint_count,
    'found_count', v_run.found_spot_count,
    'total_spots', pg_catalog.jsonb_array_length(v_rule.active_spots),
    'score', v_run.final_score,
    'session_id', v_run.session_id
  );
END;
$$;

CREATE FUNCTION public._dynamic_finalize_game_run(
  p_run_id uuid,
  p_user_id uuid,
  p_timeout_request_id uuid DEFAULT NULL,
  p_timeout_request_type text DEFAULT NULL,
  p_timeout_request_spot_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.game_runs%ROWTYPE;
  v_rule public.game_run_rule_versions%ROWTYPE;
  v_now timestamptz;
  v_elapsed numeric(12, 3);
  v_remaining numeric(12, 3);
  v_result text;
  v_score integer;
  v_session_id uuid;
BEGIN
  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id
    AND game_run.user_id = p_user_id
    AND game_run.rule_version_id IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;
  v_now := pg_catalog.clock_timestamp();

  IF v_run.status IN ('won', 'lost', 'abandoned') THEN
    RETURN public._dynamic_game_run_response(v_run.id);
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_rule_versions AS rule_version
  WHERE rule_version.id = v_run.rule_version_id
    AND rule_version.content_level_id = v_run.content_level_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pinned game run rules not found.' USING ERRCODE = 'P0002';
  END IF;

  v_elapsed := v_run.elapsed_active_seconds;
  IF v_run.status = 'active' THEN
    v_elapsed := v_elapsed + GREATEST(
      EXTRACT(EPOCH FROM (v_now - v_run.resumed_at)), 0
    );
  END IF;

  IF v_run.status = 'completed'
    OR v_run.found_spot_count = pg_catalog.jsonb_array_length(v_rule.active_spots) THEN
    v_result := 'win';
    v_elapsed := LEAST(v_elapsed, v_rule.max_duration_seconds);
  ELSIF v_elapsed >= v_rule.max_duration_seconds THEN
    v_result := 'loss';
    v_elapsed := v_rule.max_duration_seconds;
  ELSE
    RAISE EXCEPTION 'Game run is not complete and has not timed out.'
      USING ERRCODE = '55000';
  END IF;

  IF v_result = 'win' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.game_run_score_policy_versions AS policy
      INNER JOIN public.game_run_score_policy_approvals AS approval
        ON approval.policy_id = policy.id
      WHERE policy.id = v_rule.score_policy_id
        AND policy.version = v_rule.score_policy_version
        AND policy.time_weight = v_rule.time_weight
        AND policy.wrong_click_penalty = v_rule.wrong_click_penalty
        AND policy.hint_penalty = v_rule.hint_penalty
    ) THEN
      RAISE EXCEPTION 'Winning score policy has not been approved.'
        USING ERRCODE = '55000';
    END IF;

    v_remaining := GREATEST(v_rule.max_duration_seconds - v_elapsed, 0);
    v_score := GREATEST(
      0::numeric,
      pg_catalog.round(
        v_rule.time_weight::numeric * v_remaining / v_rule.max_duration_seconds
        - v_rule.wrong_click_penalty::numeric * v_run.wrong_click_count
        - v_rule.hint_penalty::numeric * v_run.hint_count
      )
    )::integer;
  ELSE
    v_score := 0;
  END IF;

  INSERT INTO public.game_sessions (
    user_id, level_id, score, result, idempotency_key,
    content_level_id, level_key, rule_version_id
  )
  VALUES (
    v_run.user_id, v_rule.level_key, v_score, v_result, v_run.id,
    v_run.content_level_id, v_rule.level_key, v_run.rule_version_id
  )
  RETURNING id INTO v_session_id;

  UPDATE public.profiles AS profile
  SET best_score = GREATEST(profile.best_score, v_score),
      total_wins = profile.total_wins + CASE WHEN v_result = 'win' THEN 1 ELSE 0 END,
      total_plays = profile.total_plays + 1
  WHERE profile.id = v_run.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game profile not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.game_runs AS game_run
  SET status = CASE WHEN v_result = 'win' THEN 'won' ELSE 'lost' END,
      resumed_at = NULL,
      completed_at = COALESCE(game_run.completed_at, v_now),
      ended_at = v_now,
      elapsed_active_seconds = v_elapsed,
      final_score = v_score,
      session_id = v_session_id,
      timeout_request_id = CASE WHEN v_result = 'loss' THEN p_timeout_request_id ELSE NULL END,
      timeout_request_type = CASE WHEN v_result = 'loss' THEN p_timeout_request_type ELSE NULL END,
      timeout_request_spot_id = CASE WHEN v_result = 'loss' THEN p_timeout_request_spot_id ELSE NULL END,
      last_event_number = game_run.last_event_number + 1,
      updated_at = v_now
  WHERE game_run.id = v_run.id
  RETURNING * INTO v_run;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, accepted_at
  )
  VALUES (
    v_run.id,
    pg_catalog.gen_random_uuid(),
    v_run.last_event_number,
    CASE WHEN v_result = 'win' THEN 'won' ELSE 'timed_out' END,
    v_now
  );

  RETURN public._dynamic_game_run_response(v_run.id);
END;
$$;

CREATE FUNCTION public._dynamic_mutate_game_run(
  p_run_id uuid,
  p_request_id uuid,
  p_operation text,
  p_event_type text DEFAULT NULL,
  p_spot_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_run public.game_runs%ROWTYPE;
  v_rule public.game_run_rule_versions%ROWTYPE;
  v_existing public.game_run_events%ROWTYPE;
  v_elapsed numeric(12, 3);
  v_next_found_count integer;
  v_event_number bigint;
  v_expected_event_type text;
  v_timeout_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;

  IF p_operation = 'record' THEN
    IF p_event_type IS NULL
      OR p_event_type NOT IN ('wrong_click', 'hint_used', 'spot_found') THEN
      RAISE EXCEPTION 'Unsupported event type.' USING ERRCODE = '22023';
    END IF;
    IF (p_event_type = 'spot_found') <> (p_spot_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Spot ID must be present only for spot_found events.'
        USING ERRCODE = '22023';
    END IF;
    v_expected_event_type := p_event_type;
    v_timeout_type := 'record:' || p_event_type;
  ELSIF p_operation IN ('pause', 'resume', 'abandon') AND p_spot_id IS NULL
    AND p_event_type IS NULL THEN
    v_expected_event_type := CASE p_operation
      WHEN 'pause' THEN 'paused'
      WHEN 'resume' THEN 'resumed'
      ELSE 'abandoned'
    END;
    v_timeout_type := p_operation;
  ELSE
    RAISE EXCEPTION 'Unsupported game run operation.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id
    AND game_run.user_id = v_user_id
    AND game_run.rule_version_id IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;
  v_now := pg_catalog.clock_timestamp();

  SELECT * INTO v_existing
  FROM public.game_run_events AS event
  WHERE event.run_id = p_run_id AND event.event_request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.event_type <> v_expected_event_type
      OR v_existing.spot_id IS DISTINCT FROM p_spot_id THEN
      RAISE EXCEPTION 'Request ID was already used for a different event.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._dynamic_game_run_response(p_run_id);
  END IF;

  IF v_run.timeout_request_id = p_request_id THEN
    IF v_run.timeout_request_type IS DISTINCT FROM v_timeout_type
      OR v_run.timeout_request_spot_id IS DISTINCT FROM p_spot_id THEN
      RAISE EXCEPTION 'Request ID was already used for a different timeout-triggering request.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._dynamic_game_run_response(p_run_id);
  END IF;

  IF v_run.status IN ('completed', 'won', 'lost', 'abandoned') THEN
    RETURN public._dynamic_game_run_response(p_run_id);
  END IF;
  IF p_operation = 'record' AND v_run.status <> 'active' THEN
    RAISE EXCEPTION 'Game run is not active.' USING ERRCODE = '55000';
  ELSIF p_operation = 'pause' AND v_run.status <> 'active' THEN
    RAISE EXCEPTION 'Only an active game run can be paused.' USING ERRCODE = '55000';
  ELSIF p_operation = 'resume' AND v_run.status <> 'paused' THEN
    RAISE EXCEPTION 'Only a paused game run can be resumed.' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_rule_versions AS rule_version
  WHERE rule_version.id = v_run.rule_version_id
    AND rule_version.content_level_id = v_run.content_level_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pinned game run rules not found.' USING ERRCODE = 'P0002';
  END IF;

  v_elapsed := v_run.elapsed_active_seconds;
  IF v_run.status = 'active' THEN
    v_elapsed := v_elapsed + GREATEST(
      EXTRACT(EPOCH FROM (v_now - v_run.resumed_at)), 0
    );
    IF v_elapsed >= v_rule.max_duration_seconds THEN
      RETURN public._dynamic_finalize_game_run(
        p_run_id, v_user_id, p_request_id, v_timeout_type,
        CASE WHEN p_operation = 'record' THEN p_spot_id ELSE NULL END
      );
    END IF;
  END IF;

  IF p_operation = 'record' THEN
    IF p_event_type = 'spot_found' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(v_rule.active_spots) AS spot(value)
        WHERE spot.value ->> 'spot_key' = p_spot_id
      ) THEN
        RAISE EXCEPTION 'Spot ID is not valid for this level.' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.game_run_events AS event
        WHERE event.run_id = p_run_id
          AND event.event_type = 'spot_found'
          AND event.spot_id = p_spot_id
      ) THEN
        RAISE EXCEPTION 'Spot was already accepted for this run.' USING ERRCODE = '23505';
      END IF;
      v_next_found_count := v_run.found_spot_count + 1;
    ELSE
      v_next_found_count := v_run.found_spot_count;
    END IF;

    IF p_event_type = 'hint_used' AND v_run.hint_count >= v_rule.max_hints THEN
      RAISE EXCEPTION 'No hints remain for this run.' USING ERRCODE = '22023';
    END IF;

    v_event_number := v_run.last_event_number + 1;
    UPDATE public.game_runs AS game_run
    SET wrong_click_count = game_run.wrong_click_count
          + CASE WHEN p_event_type = 'wrong_click' THEN 1 ELSE 0 END,
        hint_count = game_run.hint_count
          + CASE WHEN p_event_type = 'hint_used' THEN 1 ELSE 0 END,
        found_spot_count = v_next_found_count,
        elapsed_active_seconds = CASE
          WHEN v_next_found_count = pg_catalog.jsonb_array_length(v_rule.active_spots)
            THEN v_elapsed
          ELSE game_run.elapsed_active_seconds
        END,
        status = CASE
          WHEN v_next_found_count = pg_catalog.jsonb_array_length(v_rule.active_spots)
            THEN 'completed'
          ELSE game_run.status
        END,
        resumed_at = CASE
          WHEN v_next_found_count = pg_catalog.jsonb_array_length(v_rule.active_spots)
            THEN NULL
          ELSE game_run.resumed_at
        END,
        completed_at = CASE
          WHEN v_next_found_count = pg_catalog.jsonb_array_length(v_rule.active_spots)
            THEN v_now
          ELSE game_run.completed_at
        END,
        last_event_number = v_event_number,
        updated_at = v_now
    WHERE game_run.id = p_run_id;

    INSERT INTO public.game_run_events (
      run_id, event_request_id, event_number, event_type, spot_id, accepted_at
    )
    VALUES (p_run_id, p_request_id, v_event_number, p_event_type, p_spot_id, v_now);
  ELSIF p_operation = 'pause' THEN
    UPDATE public.game_runs AS game_run
    SET status = 'paused', resumed_at = NULL, elapsed_active_seconds = v_elapsed,
        last_event_number = game_run.last_event_number + 1, updated_at = v_now
    WHERE game_run.id = p_run_id
    RETURNING * INTO v_run;
    INSERT INTO public.game_run_events (
      run_id, event_request_id, event_number, event_type, accepted_at
    )
    VALUES (p_run_id, p_request_id, v_run.last_event_number, 'paused', v_now);
  ELSIF p_operation = 'resume' THEN
    UPDATE public.game_runs AS game_run
    SET status = 'active', resumed_at = v_now,
        last_event_number = game_run.last_event_number + 1, updated_at = v_now
    WHERE game_run.id = p_run_id
    RETURNING * INTO v_run;
    INSERT INTO public.game_run_events (
      run_id, event_request_id, event_number, event_type, accepted_at
    )
    VALUES (p_run_id, p_request_id, v_run.last_event_number, 'resumed', v_now);
  ELSE
    UPDATE public.game_runs AS game_run
    SET status = 'abandoned', resumed_at = NULL,
        elapsed_active_seconds = v_elapsed, ended_at = v_now,
        last_event_number = game_run.last_event_number + 1, updated_at = v_now
    WHERE game_run.id = p_run_id
    RETURNING * INTO v_run;
    INSERT INTO public.game_run_events (
      run_id, event_request_id, event_number, event_type, accepted_at
    )
    VALUES (p_run_id, p_request_id, v_run.last_event_number, 'abandoned', v_now);
  END IF;

  RETURN public._dynamic_game_run_response(p_run_id);
END;
$$;

CREATE FUNCTION public.start_game_run(p_level_id text, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_run public.game_runs%ROWTYPE;
  v_rule public.game_run_rule_versions%ROWTYPE;
  v_content_level_id uuid;
  v_game_id uuid;
  v_game_status text;
  v_feature_enabled boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.user_id = v_user_id
    AND game_run.start_request_id = p_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_run.level_id IS NOT DISTINCT FROM p_level_id THEN
      RETURN public._legacy_start_game_run(p_level_id, p_request_id);
    END IF;
    IF v_run.rule_version_id IS NOT NULL THEN
      SELECT rule_version.level_key INTO v_rule.level_key
      FROM public.game_run_rule_versions AS rule_version
      WHERE rule_version.id = v_run.rule_version_id;
      IF v_rule.level_key IS NOT DISTINCT FROM p_level_id THEN
        RETURN public._dynamic_game_run_response(v_run.id);
      END IF;
    END IF;
    RAISE EXCEPTION 'Request ID was already used to start a different level.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_run_level_rules AS legacy_rule
    WHERE legacy_rule.level_id = p_level_id
  ) THEN
    RETURN public._legacy_start_game_run(p_level_id, p_request_id);
  END IF;

  SELECT gate.is_enabled INTO v_feature_enabled
  FROM public.game_run_feature_gates AS gate
  WHERE gate.gate_name = 'dynamic_gameplay';
  IF NOT COALESCE(v_feature_enabled, false) THEN
    RAISE EXCEPTION 'Dynamic gameplay is disabled.' USING ERRCODE = '55000';
  END IF;

  SELECT registry.content_level_id INTO v_content_level_id
  FROM public.game_run_level_key_registry AS registry
  WHERE registry.level_key = p_level_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unsupported level ID.' USING ERRCODE = '22023';
  END IF;

  SELECT level.game_id, game.status
  INTO v_game_id, v_game_status
  FROM public.levels AS level
  INNER JOIN public.games AS game ON game.id = level.game_id
  WHERE level.id = v_content_level_id
    AND level.status = 'published'
    AND game.status = 'published'
  FOR SHARE OF level, game;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dynamic level is not currently playable.' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_rule_versions AS rule_version
  WHERE rule_version.content_level_id = v_content_level_id
  ORDER BY rule_version.version DESC
  LIMIT 1;
  IF NOT FOUND OR v_rule.game_id <> v_game_id OR v_rule.level_key <> p_level_id THEN
    RAISE EXCEPTION 'Dynamic level has no published runtime version.' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.game_run_score_policy_versions AS policy
    INNER JOIN public.game_run_score_policy_approvals AS approval
      ON approval.policy_id = policy.id
    WHERE policy.id = v_rule.score_policy_id
      AND policy.version = v_rule.score_policy_version
      AND policy.time_weight = v_rule.time_weight
      AND policy.wrong_click_penalty = v_rule.wrong_click_penalty
      AND policy.hint_penalty = v_rule.hint_penalty
  ) THEN
    RAISE EXCEPTION 'Dynamic level has no approved runtime score policy.'
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.game_runs (
    user_id, level_id, content_level_id, rule_version_id, start_request_id,
    status, started_at, resumed_at, last_event_number, updated_at
  )
  VALUES (
    v_user_id, NULL, v_content_level_id, v_rule.id, p_request_id,
    'active', v_now, v_now, 1, v_now
  )
  ON CONFLICT ON CONSTRAINT game_runs_user_start_request_key DO NOTHING
  RETURNING * INTO v_run;

  IF NOT FOUND THEN
    SELECT * INTO v_run
    FROM public.game_runs AS game_run
    WHERE game_run.user_id = v_user_id
      AND game_run.start_request_id = p_request_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Start request could not be resolved after an idempotency conflict.'
        USING ERRCODE = '40001';
    END IF;
    IF v_run.rule_version_id IS NOT NULL THEN
      SELECT rule_version.level_key INTO v_rule.level_key
      FROM public.game_run_rule_versions AS rule_version
      WHERE rule_version.id = v_run.rule_version_id;
    ELSE
      v_rule.level_key := NULL;
    END IF;
    IF COALESCE(v_rule.level_key, v_run.level_id) IS DISTINCT FROM p_level_id THEN
      RAISE EXCEPTION 'Request ID was already used to start a different level.'
        USING ERRCODE = '22023';
    END IF;
    IF v_run.rule_version_id IS NULL THEN
      RETURN public._legacy_start_game_run(p_level_id, p_request_id);
    END IF;
    RETURN public._dynamic_game_run_response(v_run.id);
  END IF;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, accepted_at
  )
  VALUES (v_run.id, p_request_id, 1, 'started', v_now);

  RETURN public._dynamic_game_run_response(v_run.id);
END;
$$;

CREATE FUNCTION public.record_game_run_event(
  p_run_id uuid,
  p_request_id uuid,
  p_event_type text,
  p_spot_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule_version_id uuid;
BEGIN
  SELECT game_run.rule_version_id INTO v_rule_version_id
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = auth.uid();
  IF NOT FOUND OR v_rule_version_id IS NULL THEN
    RETURN public._legacy_record_game_run_event(p_run_id, p_request_id, p_event_type, p_spot_id);
  END IF;
  RETURN public._dynamic_mutate_game_run(p_run_id, p_request_id, 'record', p_event_type, p_spot_id);
END;
$$;

CREATE FUNCTION public.pause_game_run(p_run_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule_version_id uuid;
BEGIN
  SELECT game_run.rule_version_id INTO v_rule_version_id
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = auth.uid();
  IF NOT FOUND OR v_rule_version_id IS NULL THEN
    RETURN public._legacy_pause_game_run(p_run_id, p_request_id);
  END IF;
  RETURN public._dynamic_mutate_game_run(p_run_id, p_request_id, 'pause');
END;
$$;

CREATE FUNCTION public.resume_game_run(p_run_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule_version_id uuid;
BEGIN
  SELECT game_run.rule_version_id INTO v_rule_version_id
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = auth.uid();
  IF NOT FOUND OR v_rule_version_id IS NULL THEN
    RETURN public._legacy_resume_game_run(p_run_id, p_request_id);
  END IF;
  RETURN public._dynamic_mutate_game_run(p_run_id, p_request_id, 'resume');
END;
$$;

CREATE FUNCTION public.finish_game_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rule_version_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  SELECT game_run.rule_version_id INTO v_rule_version_id
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = v_user_id;
  IF NOT FOUND OR v_rule_version_id IS NULL THEN
    RETURN public._legacy_finish_game_run(p_run_id);
  END IF;
  RETURN public._dynamic_finalize_game_run(p_run_id, v_user_id);
END;
$$;

CREATE FUNCTION public.abandon_game_run(p_run_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rule_version_id uuid;
BEGIN
  SELECT game_run.rule_version_id INTO v_rule_version_id
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = auth.uid();
  IF NOT FOUND OR v_rule_version_id IS NULL THEN
    RETURN public._legacy_abandon_game_run(p_run_id, p_request_id);
  END IF;
  RETURN public._dynamic_mutate_game_run(p_run_id, p_request_id, 'abandon');
END;
$$;

REVOKE ALL ON FUNCTION public._dynamic_game_run_response(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._dynamic_finalize_game_run(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._dynamic_mutate_game_run(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.start_game_run(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_game_run_event(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pause_game_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resume_game_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_game_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.abandon_game_run(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.start_game_run(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_game_run_event(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_game_run(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_game_run(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_game_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_game_run(uuid, uuid) TO authenticated;