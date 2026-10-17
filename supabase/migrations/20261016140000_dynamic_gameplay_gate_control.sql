CREATE TABLE public.game_run_feature_gate_audit (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  gate_name text NOT NULL CHECK (gate_name = 'dynamic_gameplay'),
  previous_enabled boolean NOT NULL,
  is_enabled boolean NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  change_note text NOT NULL CHECK (btrim(change_note) <> '')
);

ALTER TABLE public.game_run_feature_gate_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_run_feature_gate_audit FROM PUBLIC, anon, authenticated;

CREATE POLICY game_run_feature_gate_audit_admin_select
  ON public.game_run_feature_gate_audit
  FOR SELECT TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));
GRANT SELECT ON TABLE public.game_run_feature_gate_audit TO authenticated;

CREATE FUNCTION public.set_dynamic_gameplay_gate(p_is_enabled boolean, p_change_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_previous_enabled boolean;
  v_audit public.game_run_feature_gate_audit%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;
  IF p_is_enabled IS NULL THEN
    RAISE EXCEPTION 'A gate state is required.' USING ERRCODE = '22023';
  END IF;
  IF p_change_note IS NULL OR btrim(p_change_note) = '' THEN
    RAISE EXCEPTION 'A change note is required for the gate audit.' USING ERRCODE = '22023';
  END IF;

  SELECT gate.is_enabled INTO v_previous_enabled
  FROM public.game_run_feature_gates AS gate
  WHERE gate.gate_name = 'dynamic_gameplay'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dynamic gameplay gate status is missing or invalid.' USING ERRCODE = 'P0002';
  END IF;

  IF p_is_enabled AND (
    NOT EXISTS (
      SELECT 1
      FROM public.game_run_rule_versions AS rule
      INNER JOIN public.levels AS level ON level.id = rule.content_level_id
      INNER JOIN public.games AS game ON game.id = rule.game_id
      INNER JOIN public.game_run_score_policy_versions AS policy
        ON policy.id = rule.score_policy_id AND policy.version = rule.score_policy_version
      INNER JOIN public.game_run_score_policy_approvals AS approval
        ON approval.policy_id = policy.id
      WHERE level.status = 'published'
        AND game.status = 'published'
        AND rule.original_asset_id IS NOT NULL
        AND rule.comparison_asset_id IS NOT NULL
        AND pg_catalog.jsonb_array_length(rule.active_spots) > 0
        AND policy.time_weight = rule.time_weight
        AND policy.wrong_click_penalty = rule.wrong_click_penalty
        AND policy.hint_penalty = rule.hint_penalty
    )
    OR EXISTS (
      SELECT 1
      FROM public.levels AS level
      INNER JOIN public.games AS game ON game.id = level.game_id
      WHERE level.status = 'published'
        AND game.status = 'published'
        AND NOT EXISTS (
          SELECT 1
          FROM public.game_run_rule_versions AS rule
          INNER JOIN public.game_run_score_policy_versions AS policy
            ON policy.id = rule.score_policy_id AND policy.version = rule.score_policy_version
          INNER JOIN public.game_run_score_policy_approvals AS approval
            ON approval.policy_id = policy.id
          WHERE rule.content_level_id = level.id
            AND rule.game_id = game.id
            AND rule.level_key = level.level_key
            AND rule.original_asset_id IS NOT NULL
            AND rule.comparison_asset_id IS NOT NULL
            AND pg_catalog.jsonb_array_length(rule.active_spots) > 0
            AND policy.time_weight = rule.time_weight
            AND policy.wrong_click_penalty = rule.wrong_click_penalty
            AND policy.hint_penalty = rule.hint_penalty
        )
    )
  ) THEN
    RAISE EXCEPTION 'Published Dynamic content must have an approved runtime rule and complete asset pair before enabling the gate.'
      USING ERRCODE = '55000';
  END IF;

  IF v_previous_enabled IS DISTINCT FROM p_is_enabled THEN
    UPDATE public.game_run_feature_gates AS gate
    SET is_enabled = p_is_enabled
    WHERE gate.gate_name = 'dynamic_gameplay';
  END IF;

  INSERT INTO public.game_run_feature_gate_audit (
    gate_name, previous_enabled, is_enabled, changed_by, change_note
  )
  VALUES (
    'dynamic_gameplay', v_previous_enabled, p_is_enabled, v_user_id, btrim(p_change_note)
  )
  RETURNING * INTO v_audit;

  RETURN pg_catalog.jsonb_build_object(
    'gate_name', v_audit.gate_name,
    'previous_enabled', v_audit.previous_enabled,
    'is_enabled', v_audit.is_enabled,
    'audit_id', v_audit.id,
    'changed_by', v_audit.changed_by,
    'changed_at', v_audit.changed_at,
    'change_note', v_audit.change_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_dynamic_gameplay_gate(boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_dynamic_gameplay_gate(boolean, text) TO authenticated;