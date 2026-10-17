ALTER FUNCTION public.start_game_run(text, uuid)
  RENAME TO _start_game_run_without_version_guard;

REVOKE ALL ON FUNCTION public._start_game_run_without_version_guard(text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.start_game_run(p_level_id text, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dynamic_enabled boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.game_run_level_rules AS legacy_rule
    WHERE legacy_rule.level_id = p_level_id
  ) THEN
    RETURN public._start_game_run_without_version_guard(p_level_id, p_request_id);
  END IF;

  SELECT gate.is_enabled INTO v_dynamic_enabled
  FROM public.game_run_feature_gates AS gate
  WHERE gate.gate_name = 'dynamic_gameplay';
  IF COALESCE(v_dynamic_enabled, false) THEN
    RAISE EXCEPTION 'Dynamic Start requires an expected published rule version.'
      USING ERRCODE = '55000';
  END IF;

  RETURN public._start_game_run_without_version_guard(p_level_id, p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.start_game_run(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_run(text, uuid) TO authenticated;

CREATE FUNCTION public.start_game_run_for_rule_version(
  p_level_key text,
  p_expected_rule_version_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_response jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_expected_rule_version_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Expected rule version and request ID are required.' USING ERRCODE = '22023';
  END IF;

  v_response := public._start_game_run_without_version_guard(p_level_key, p_request_id);
  IF v_response ->> 'rule_version_id' IS DISTINCT FROM p_expected_rule_version_id::text THEN
    RAISE EXCEPTION 'Published level rules changed. Reload artwork before starting.'
      USING ERRCODE = '55000';
  END IF;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.start_game_run_for_rule_version(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_run_for_rule_version(text, uuid, uuid)
  TO authenticated;