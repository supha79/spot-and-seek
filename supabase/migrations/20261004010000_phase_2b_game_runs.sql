DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    LEFT JOIN (
      SELECT
        session.user_id,
        count(*) FILTER (WHERE session.result = 'win')::integer AS wins,
        max(session.score) AS best_score
      FROM public.game_sessions AS session
      GROUP BY session.user_id
    ) AS session_totals ON session_totals.user_id = profile.id
    WHERE profile.total_wins > COALESCE(session_totals.wins, 0)
      OR profile.best_score > COALESCE(session_totals.best_score, 0)
  ) THEN
    RAISE EXCEPTION 'Phase 2B backfill stopped: profiles contain wins or best scores not represented by game_sessions.'
      USING HINT = 'Reconcile the affected profiles with authoritative game session history before rerunning this migration.';
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN total_plays integer NOT NULL DEFAULT 0;

WITH session_totals AS (
  SELECT
    profile.id AS user_id,
    count(session.id)::integer AS plays,
    count(session.id) FILTER (WHERE session.result = 'win')::integer AS wins,
    max(session.score) AS best_score
  FROM public.profiles AS profile
  LEFT JOIN public.game_sessions AS session ON session.user_id = profile.id
  GROUP BY profile.id
)
UPDATE public.profiles AS profile
SET total_plays = session_totals.plays,
    total_wins = session_totals.wins,
    best_score = COALESCE(session_totals.best_score, 0)
FROM session_totals
WHERE session_totals.user_id = profile.id;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_total_plays_nonnegative CHECK (total_plays >= 0),
  ADD CONSTRAINT profiles_total_wins_lte_total_plays CHECK (total_wins <= total_plays),
  ADD COLUMN win_rate_percent numeric(5, 2)
    GENERATED ALWAYS AS (
      CASE
        WHEN total_plays = 0 THEN 0::numeric
        ELSE round(total_wins::numeric * 100 / total_plays, 2)
      END
    ) STORED;

GRANT SELECT (total_plays, win_rate_percent)
  ON TABLE public.profiles TO authenticated;

CREATE TABLE public.game_run_level_rules (
  level_id text PRIMARY KEY,
  max_duration_seconds integer NOT NULL,
  spot_ids text[] NOT NULL,
  max_hints integer NOT NULL DEFAULT 3,
  CONSTRAINT game_run_level_rules_level_id_valid CHECK (
    level_id IN (
      'cozy-cat-corner', 'sunny-picnic', 'balloon-hills',
      'greenhouse-garden', 'bakery-breeze', 'night-train',
      'stormy-shelf', 'forest-fable'
    )
  ),
  CONSTRAINT game_run_level_rules_duration_positive CHECK (max_duration_seconds > 0),
  CONSTRAINT game_run_level_rules_spots_nonempty CHECK (
    cardinality(spot_ids) > 0 AND array_position(spot_ids, NULL) IS NULL
  ),
  CONSTRAINT game_run_level_rules_hints_bounded CHECK (max_hints BETWEEN 0 AND 3)
);

INSERT INTO public.game_run_level_rules (level_id, max_duration_seconds, spot_ids)
VALUES
  ('cozy-cat-corner', 120, ARRAY['window', 'plant', 'teapot']::text[]),
  ('sunny-picnic', 120, ARRAY['umbrella', 'flower', 'basket']::text[]),
  ('balloon-hills', 120, ARRAY['balloon', 'hill', 'kite']::text[]),
  ('greenhouse-garden', 90, ARRAY['window', 'plant', 'lamp', 'bench', 'vase']::text[]),
  ('bakery-breeze', 90, ARRAY['window', 'plant', 'lamp', 'bench', 'vase']::text[]),
  ('night-train', 90, ARRAY['window', 'plant', 'lamp', 'bench', 'vase']::text[]),
  ('stormy-shelf', 60, ARRAY['window', 'plant', 'lamp', 'book', 'frame', 'mug', 'chair']::text[]),
  ('forest-fable', 60, ARRAY['window', 'plant', 'lamp', 'book', 'frame', 'mug', 'chair']::text[]);

ALTER TABLE public.game_run_level_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_run_level_rules FROM PUBLIC, anon, authenticated;

CREATE TABLE public.game_run_score_policy (
  policy_id boolean PRIMARY KEY DEFAULT true CHECK (policy_id),
  is_approved boolean NOT NULL DEFAULT false,
  version text NOT NULL,
  time_weight integer NOT NULL CHECK (time_weight >= 0),
  wrong_click_penalty integer NOT NULL CHECK (wrong_click_penalty >= 0),
  hint_penalty integer NOT NULL CHECK (hint_penalty >= 0),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
  CONSTRAINT game_run_score_policy_approval_fields CHECK (
    (is_approved AND approved_at IS NOT NULL AND approved_by IS NOT NULL)
    OR (NOT is_approved AND approved_at IS NULL AND approved_by IS NULL)
  )
);

INSERT INTO public.game_run_score_policy (
  policy_id, is_approved, version, time_weight, wrong_click_penalty, hint_penalty
)
VALUES (true, false, 'proposed-v1', 1200, 50, 100);

ALTER TABLE public.game_run_score_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_run_score_policy FROM PUBLIC, anon, authenticated;

CREATE TABLE public.game_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  level_id text NOT NULL REFERENCES public.game_run_level_rules (level_id),
  start_request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resumed_at timestamptz,
  completed_at timestamptz,
  ended_at timestamptz,
  elapsed_active_seconds numeric(12, 3) NOT NULL DEFAULT 0,
  wrong_click_count integer NOT NULL DEFAULT 0,
  hint_count integer NOT NULL DEFAULT 0,
  found_spot_count integer NOT NULL DEFAULT 0,
  last_event_number bigint NOT NULL DEFAULT 1,
  final_score integer,
  session_id uuid UNIQUE REFERENCES public.game_sessions (id),
  timeout_request_id uuid,
  timeout_request_type text,
  timeout_request_spot_id text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT game_runs_user_start_request_key UNIQUE (user_id, start_request_id),
  CONSTRAINT game_runs_status_valid CHECK (
    status IN ('active', 'paused', 'completed', 'won', 'lost', 'abandoned')
  ),
  CONSTRAINT game_runs_elapsed_nonnegative CHECK (elapsed_active_seconds >= 0),
  CONSTRAINT game_runs_wrong_clicks_nonnegative CHECK (wrong_click_count >= 0),
  CONSTRAINT game_runs_hints_nonnegative CHECK (hint_count >= 0),
  CONSTRAINT game_runs_found_nonnegative CHECK (found_spot_count >= 0),
  CONSTRAINT game_runs_event_number_positive CHECK (last_event_number >= 1),
  CONSTRAINT game_runs_final_score_nonnegative CHECK (final_score IS NULL OR final_score >= 0),
  CONSTRAINT game_runs_timeout_request_shape CHECK (
    (timeout_request_id IS NULL AND timeout_request_type IS NULL
      AND timeout_request_spot_id IS NULL)
    OR (
      status = 'lost'
      AND timeout_request_id IS NOT NULL
      AND timeout_request_type IS NOT NULL
      AND timeout_request_type IN (
        'record:wrong_click', 'record:hint_used', 'record:spot_found', 'pause', 'abandon'
      )
      AND (
        (timeout_request_type = 'record:spot_found' AND timeout_request_spot_id IS NOT NULL)
        OR (timeout_request_type <> 'record:spot_found' AND timeout_request_spot_id IS NULL)
      )
    )
  ),
  CONSTRAINT game_runs_state_fields_consistent CHECK (
    (status = 'active' AND resumed_at IS NOT NULL AND completed_at IS NULL
      AND ended_at IS NULL AND final_score IS NULL AND session_id IS NULL)
    OR (status = 'paused' AND resumed_at IS NULL AND completed_at IS NULL
      AND ended_at IS NULL AND final_score IS NULL AND session_id IS NULL)
    OR (status = 'completed' AND resumed_at IS NULL AND completed_at IS NOT NULL
      AND ended_at IS NULL AND final_score IS NULL AND session_id IS NULL)
    OR (status IN ('won', 'lost') AND resumed_at IS NULL AND completed_at IS NOT NULL
      AND ended_at IS NOT NULL AND final_score IS NOT NULL AND session_id IS NOT NULL)
    OR (status = 'abandoned' AND resumed_at IS NULL AND ended_at IS NOT NULL
      AND final_score IS NULL AND session_id IS NULL)
  ),
  CONSTRAINT game_runs_timestamps_ordered CHECK (
    (resumed_at IS NULL OR resumed_at >= started_at)
    AND (completed_at IS NULL OR completed_at >= started_at)
    AND (ended_at IS NULL OR ended_at >= started_at)
  )
);

CREATE INDEX game_runs_user_started_at_idx
  ON public.game_runs (user_id, started_at DESC);

CREATE TABLE public.game_run_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.game_runs (id) ON DELETE CASCADE,
  event_request_id uuid NOT NULL,
  event_number bigint NOT NULL,
  event_type text NOT NULL,
  spot_id text,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT game_run_events_type_valid CHECK (
    event_type IN (
      'started', 'wrong_click', 'hint_used', 'spot_found',
      'paused', 'resumed', 'won', 'timed_out', 'abandoned'
    )
  ),
  CONSTRAINT game_run_events_spot_shape CHECK (
    (event_type = 'spot_found' AND spot_id IS NOT NULL)
    OR (event_type <> 'spot_found' AND spot_id IS NULL)
  ),
  CONSTRAINT game_run_events_request_unique UNIQUE (run_id, event_request_id),
  CONSTRAINT game_run_events_number_unique UNIQUE (run_id, event_number)
);

CREATE UNIQUE INDEX game_run_events_spot_once_idx
  ON public.game_run_events (run_id, spot_id)
  WHERE event_type = 'spot_found';

CREATE INDEX game_run_events_run_time_idx
  ON public.game_run_events (run_id, accepted_at);

ALTER TABLE public.game_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_run_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.game_run_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.game_runs, public.game_run_events TO authenticated;

CREATE POLICY game_runs_select_owner_or_admin
  ON public.game_runs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

CREATE POLICY game_run_events_select_owner_or_admin
  ON public.game_run_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_runs AS game_run
      WHERE game_run.id = game_run_events.run_id
        AND (
          game_run.user_id = (SELECT auth.uid())
          OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
        )
    )
  );

CREATE FUNCTION public._game_run_response(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.game_runs%ROWTYPE;
  v_max_duration integer;
  v_elapsed numeric(12, 3);
BEGIN
  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT rules.max_duration_seconds INTO v_max_duration
  FROM public.game_run_level_rules AS rules
  WHERE rules.level_id = v_run.level_id;

  v_elapsed := v_run.elapsed_active_seconds;
  IF v_run.status = 'active' THEN
    v_elapsed := v_elapsed + GREATEST(
      EXTRACT(EPOCH FROM (clock_timestamp() - v_run.resumed_at)), 0
    );
  END IF;

  RETURN jsonb_build_object(
    'run_id', v_run.id,
    'level_id', v_run.level_id,
    'status', v_run.status,
    'result', CASE
      WHEN v_run.status = 'won' THEN 'win'
      WHEN v_run.status = 'lost' THEN 'loss'
      ELSE NULL
    END,
    'elapsed_active_seconds', round(v_elapsed, 3),
    'time_remaining_seconds', round(GREATEST(v_max_duration - v_elapsed, 0), 3),
    'wrong_clicks', v_run.wrong_click_count,
    'hints_used', v_run.hint_count,
    'found_count', v_run.found_spot_count,
    'total_spots', (SELECT cardinality(rules.spot_ids)
                    FROM public.game_run_level_rules AS rules
                    WHERE rules.level_id = v_run.level_id),
    'score', v_run.final_score,
    'session_id', v_run.session_id
  );
END;
$$;

CREATE FUNCTION public._finalize_game_run(
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
  v_rule public.game_run_level_rules%ROWTYPE;
  v_policy public.game_run_score_policy%ROWTYPE;
  v_now timestamptz;
  v_elapsed numeric(12, 3);
  v_remaining numeric(12, 3);
  v_result text;
  v_score integer;
  v_session_id uuid;
BEGIN
  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;
  v_now := clock_timestamp();

  IF v_run.status IN ('won', 'lost', 'abandoned') THEN
    RETURN public._game_run_response(v_run.id);
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_level_rules AS rules
  WHERE rules.level_id = v_run.level_id;

  v_elapsed := v_run.elapsed_active_seconds;
  IF v_run.status = 'active' THEN
    v_elapsed := v_elapsed + GREATEST(
      EXTRACT(EPOCH FROM (v_now - v_run.resumed_at)), 0
    );
  END IF;

  IF v_run.status = 'completed'
    OR v_run.found_spot_count = cardinality(v_rule.spot_ids) THEN
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
    SELECT * INTO v_policy
    FROM public.game_run_score_policy AS policy
    WHERE policy.policy_id AND policy.is_approved;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Winning score policy has not been approved.'
        USING ERRCODE = '55000';
    END IF;

    v_remaining := GREATEST(v_rule.max_duration_seconds - v_elapsed, 0);
    v_score := GREATEST(
      0::numeric,
      round(
        v_policy.time_weight::numeric * v_remaining / v_rule.max_duration_seconds
        - v_policy.wrong_click_penalty::numeric * v_run.wrong_click_count
        - v_policy.hint_penalty::numeric * v_run.hint_count
      )
    )::integer;
  ELSE
    v_score := 0;
  END IF;

  INSERT INTO public.game_sessions (
    user_id, level_id, score, result, idempotency_key
  )
  VALUES (
    v_run.user_id,
    v_run.level_id,
    v_score,
    v_result,
    v_run.id
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
    gen_random_uuid(),
    v_run.last_event_number,
    CASE WHEN v_result = 'win' THEN 'won' ELSE 'timed_out' END,
    v_now
  );

  RETURN public._game_run_response(v_run.id);
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
  v_now timestamptz := clock_timestamp();
  v_run public.game_runs%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.game_run_level_rules AS rules
    WHERE rules.level_id = p_level_id
  ) THEN
    RAISE EXCEPTION 'Unsupported level ID.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.game_runs (
    user_id, level_id, start_request_id, status, started_at, resumed_at,
    last_event_number, updated_at
  )
  VALUES (
    v_user_id, p_level_id, p_request_id, 'active', v_now, v_now, 1, v_now
  )
  ON CONFLICT ON CONSTRAINT game_runs_user_start_request_key DO NOTHING
  RETURNING * INTO v_run;

  IF NOT FOUND THEN
    SELECT * INTO v_run
    FROM public.game_runs AS game_run
    WHERE game_run.user_id = v_user_id
      AND game_run.start_request_id = p_request_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Start request could not be resolved after an idempotency conflict.'
        USING ERRCODE = '40001';
    END IF;
    IF v_run.level_id IS DISTINCT FROM p_level_id THEN
      RAISE EXCEPTION 'Request ID was already used to start a different level.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(v_run.id);
  END IF;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, accepted_at
  )
  VALUES (v_run.id, p_request_id, 1, 'started', v_now);

  RETURN public._game_run_response(v_run.id);
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
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_run public.game_runs%ROWTYPE;
  v_rule public.game_run_level_rules%ROWTYPE;
  v_existing public.game_run_events%ROWTYPE;
  v_elapsed numeric(12, 3);
  v_next_found_count integer;
  v_event_number bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;
  IF p_event_type IS NULL OR p_event_type NOT IN ('wrong_click', 'hint_used', 'spot_found') THEN
    RAISE EXCEPTION 'Unsupported event type.' USING ERRCODE = '22023';
  END IF;
  IF (p_event_type = 'spot_found') <> (p_spot_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Spot ID must be present only for spot_found events.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;
  v_now := clock_timestamp();

  SELECT * INTO v_existing
  FROM public.game_run_events AS event
  WHERE event.run_id = p_run_id AND event.event_request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.event_type <> p_event_type
      OR v_existing.spot_id IS DISTINCT FROM p_spot_id THEN
      RAISE EXCEPTION 'Request ID was already used for a different event.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;

  IF v_run.timeout_request_id = p_request_id THEN
    IF v_run.timeout_request_type IS DISTINCT FROM ('record:' || p_event_type)
      OR v_run.timeout_request_spot_id IS DISTINCT FROM p_spot_id THEN
      RAISE EXCEPTION 'Request ID was already used for a different timeout-triggering request.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;

  IF v_run.status IN ('completed', 'won', 'lost', 'abandoned') THEN
    RETURN public._game_run_response(p_run_id);
  END IF;

  IF v_run.status <> 'active' THEN
    RAISE EXCEPTION 'Game run is not active.' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_level_rules AS rules
  WHERE rules.level_id = v_run.level_id;

  v_elapsed := v_run.elapsed_active_seconds + GREATEST(
    EXTRACT(EPOCH FROM (v_now - v_run.resumed_at)), 0
  );
  IF v_elapsed >= v_rule.max_duration_seconds THEN
    RETURN public._finalize_game_run(
      p_run_id,
      v_user_id,
      p_request_id,
      'record:' || p_event_type,
      p_spot_id
    );
  END IF;

  IF p_event_type = 'spot_found' THEN
    IF NOT (p_spot_id = ANY (v_rule.spot_ids)) THEN
      RAISE EXCEPTION 'Spot ID is not valid for this level.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.game_run_events AS event
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
        WHEN v_next_found_count = cardinality(v_rule.spot_ids) THEN v_elapsed
        ELSE game_run.elapsed_active_seconds
      END,
      status = CASE
        WHEN v_next_found_count = cardinality(v_rule.spot_ids) THEN 'completed'
        ELSE game_run.status
      END,
      resumed_at = CASE
        WHEN v_next_found_count = cardinality(v_rule.spot_ids) THEN NULL
        ELSE game_run.resumed_at
      END,
      completed_at = CASE
        WHEN v_next_found_count = cardinality(v_rule.spot_ids) THEN v_now
        ELSE game_run.completed_at
      END,
      last_event_number = v_event_number,
      updated_at = v_now
  WHERE game_run.id = p_run_id
  RETURNING * INTO v_run;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, spot_id, accepted_at
  )
  VALUES (p_run_id, p_request_id, v_event_number, p_event_type, p_spot_id, v_now);

  RETURN public._game_run_response(p_run_id);
END;
$$;

CREATE FUNCTION public.pause_game_run(p_run_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_run public.game_runs%ROWTYPE;
  v_rule public.game_run_level_rules%ROWTYPE;
  v_existing public.game_run_events%ROWTYPE;
  v_elapsed numeric(12, 3);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;
  v_now := clock_timestamp();

  SELECT * INTO v_existing
  FROM public.game_run_events AS event
  WHERE event.run_id = p_run_id AND event.event_request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.event_type <> 'paused' THEN
      RAISE EXCEPTION 'Request ID was already used for a different event.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.timeout_request_id = p_request_id THEN
    IF v_run.timeout_request_type IS DISTINCT FROM 'pause' THEN
      RAISE EXCEPTION 'Request ID was already used for a different timeout-triggering request.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.status IN ('completed', 'won', 'lost', 'abandoned') THEN
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.status <> 'active' THEN
    RAISE EXCEPTION 'Only an active game run can be paused.' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_level_rules AS rules
  WHERE rules.level_id = v_run.level_id;
  v_elapsed := v_run.elapsed_active_seconds + GREATEST(
    EXTRACT(EPOCH FROM (v_now - v_run.resumed_at)), 0
  );
  IF v_elapsed >= v_rule.max_duration_seconds THEN
    RETURN public._finalize_game_run(p_run_id, v_user_id, p_request_id, 'pause');
  END IF;

  UPDATE public.game_runs AS game_run
  SET status = 'paused',
      resumed_at = NULL,
      elapsed_active_seconds = v_elapsed,
      last_event_number = game_run.last_event_number + 1,
      updated_at = v_now
  WHERE game_run.id = p_run_id
  RETURNING * INTO v_run;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, accepted_at
  )
  VALUES (p_run_id, p_request_id, v_run.last_event_number, 'paused', v_now);

  RETURN public._game_run_response(p_run_id);
END;
$$;

CREATE FUNCTION public.resume_game_run(p_run_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_run public.game_runs%ROWTYPE;
  v_existing public.game_run_events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;
  v_now := clock_timestamp();

  SELECT * INTO v_existing
  FROM public.game_run_events AS event
  WHERE event.run_id = p_run_id AND event.event_request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.event_type <> 'resumed' THEN
      RAISE EXCEPTION 'Request ID was already used for a different event.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.timeout_request_id = p_request_id THEN
    RAISE EXCEPTION 'Request ID was already used for a different timeout-triggering request.'
      USING ERRCODE = '22023';
  END IF;
  IF v_run.status IN ('completed', 'won', 'lost', 'abandoned') THEN
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.status <> 'paused' THEN
    RAISE EXCEPTION 'Only a paused game run can be resumed.' USING ERRCODE = '55000';
  END IF;

  UPDATE public.game_runs AS game_run
  SET status = 'active',
      resumed_at = v_now,
      last_event_number = game_run.last_event_number + 1,
      updated_at = v_now
  WHERE game_run.id = p_run_id
  RETURNING * INTO v_run;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, accepted_at
  )
  VALUES (p_run_id, p_request_id, v_run.last_event_number, 'resumed', v_now);

  RETURN public._game_run_response(p_run_id);
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  RETURN public._finalize_game_run(p_run_id, v_user_id);
END;
$$;

CREATE FUNCTION public.abandon_game_run(p_run_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_run public.game_runs%ROWTYPE;
  v_rule public.game_run_level_rules%ROWTYPE;
  v_existing public.game_run_events%ROWTYPE;
  v_elapsed numeric(12, 3);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;
  v_now := clock_timestamp();

  SELECT * INTO v_existing
  FROM public.game_run_events AS event
  WHERE event.run_id = p_run_id AND event.event_request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.event_type <> 'abandoned' THEN
      RAISE EXCEPTION 'Request ID was already used for a different event.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.timeout_request_id = p_request_id THEN
    IF v_run.timeout_request_type IS DISTINCT FROM 'abandon' THEN
      RAISE EXCEPTION 'Request ID was already used for a different timeout-triggering request.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.status = 'completed' THEN
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.status IN ('won', 'lost', 'abandoned') THEN
    RETURN public._game_run_response(p_run_id);
  END IF;

  SELECT * INTO v_rule
  FROM public.game_run_level_rules AS rules
  WHERE rules.level_id = v_run.level_id;
  v_elapsed := v_run.elapsed_active_seconds;
  IF v_run.status = 'active' THEN
    v_elapsed := v_elapsed + GREATEST(
      EXTRACT(EPOCH FROM (v_now - v_run.resumed_at)), 0
    );
    IF v_elapsed >= v_rule.max_duration_seconds THEN
      RETURN public._finalize_game_run(p_run_id, v_user_id, p_request_id, 'abandon');
    END IF;
  END IF;

  UPDATE public.game_runs AS game_run
  SET status = 'abandoned',
      resumed_at = NULL,
      elapsed_active_seconds = v_elapsed,
      ended_at = v_now,
      last_event_number = game_run.last_event_number + 1,
      updated_at = v_now
  WHERE game_run.id = p_run_id
  RETURNING * INTO v_run;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, accepted_at
  )
  VALUES (p_run_id, p_request_id, v_run.last_event_number, 'abandoned', v_now);

  RETURN public._game_run_response(p_run_id);
END;
$$;

REVOKE ALL ON FUNCTION public._game_run_response(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._finalize_game_run(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_game_run(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_game_run_event(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
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