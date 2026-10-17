CREATE FUNCTION public.get_game_run_result(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_run public.game_runs%ROWTYPE;
  v_session public.game_sessions%ROWTYPE;
  v_rule public.game_run_rule_versions%ROWTYPE;
  v_legacy_rule public.game_run_level_rules%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'Game result not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT game_run.* INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id
    AND game_run.user_id = v_user_id
    AND game_run.status IN ('won', 'lost');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game result not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT game_session.* INTO v_session
  FROM public.game_sessions AS game_session
  WHERE game_session.id = v_run.session_id
    AND game_session.user_id = v_user_id;
  IF NOT FOUND
    OR v_session.idempotency_key IS DISTINCT FROM v_run.id
    OR v_session.score IS DISTINCT FROM v_run.final_score
    OR v_session.result IS DISTINCT FROM (
      CASE
        WHEN v_run.status = 'won' THEN 'win'
        ELSE 'loss'
      END
    ) THEN
    RAISE EXCEPTION 'Game result not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_run.rule_version_id IS NOT NULL THEN
    SELECT rule_version.* INTO v_rule
    FROM public.game_run_rule_versions AS rule_version
    WHERE rule_version.id = v_run.rule_version_id
      AND rule_version.content_level_id = v_run.content_level_id;
    IF NOT FOUND
      OR v_session.level_id IS DISTINCT FROM v_rule.level_key
      OR v_session.content_level_id IS DISTINCT FROM v_run.content_level_id
      OR v_session.rule_version_id IS DISTINCT FROM v_run.rule_version_id THEN
      RAISE EXCEPTION 'Game result not found.' USING ERRCODE = 'P0002';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'run_id', v_run.id,
      'status', v_run.status,
      'result', v_session.result,
      'score', v_session.score,
      'session_id', v_session.id,
      'played_at', v_session.played_at,
      'started_at', v_run.started_at,
      'completed_at', v_run.completed_at,
      'ended_at', v_run.ended_at,
      'elapsed_active_seconds', v_run.elapsed_active_seconds,
      'wrong_clicks', v_run.wrong_click_count,
      'hints_used', v_run.hint_count,
      'found_count', v_run.found_spot_count,
      'total_spots', pg_catalog.jsonb_array_length(v_rule.active_spots),
      'level', pg_catalog.jsonb_build_object(
        'id', v_rule.level_key,
        'content_level_id', v_run.content_level_id,
        'level_key', v_rule.level_key,
        'rule_version_id', v_run.rule_version_id,
        'title', v_rule.title,
        'difficulty', v_rule.difficulty,
        'max_duration_seconds', v_rule.max_duration_seconds
      )
    );
  END IF;

  SELECT legacy_rule.* INTO v_legacy_rule
  FROM public.game_run_level_rules AS legacy_rule
  WHERE legacy_rule.level_id = v_run.level_id;
  IF NOT FOUND
    OR v_session.level_id IS DISTINCT FROM v_run.level_id
    OR v_session.content_level_id IS NOT NULL
    OR v_session.level_key IS NOT NULL
    OR v_session.rule_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'Game result not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'run_id', v_run.id,
    'status', v_run.status,
    'result', v_session.result,
    'score', v_session.score,
    'session_id', v_session.id,
    'played_at', v_session.played_at,
    'started_at', v_run.started_at,
    'completed_at', v_run.completed_at,
    'ended_at', v_run.ended_at,
    'elapsed_active_seconds', v_run.elapsed_active_seconds,
    'wrong_clicks', v_run.wrong_click_count,
    'hints_used', v_run.hint_count,
    'found_count', v_run.found_spot_count,
    'total_spots', pg_catalog.cardinality(v_legacy_rule.spot_ids),
    'level', pg_catalog.jsonb_build_object(
      'id', v_run.level_id,
      'content_level_id', NULL,
      'level_key', NULL,
      'rule_version_id', NULL,
      'title', NULL,
      'difficulty', NULL,
      'max_duration_seconds', v_legacy_rule.max_duration_seconds
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_game_run_result(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_run_result(uuid) TO authenticated;