CREATE OR REPLACE FUNCTION public.approve_game_run_score_policy(p_policy_id uuid, p_approval_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_policy public.game_run_score_policy_versions%ROWTYPE;
  v_approval public.game_run_score_policy_approvals%ROWTYPE;
  v_admin_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;
  IF p_approval_note IS NULL OR btrim(p_approval_note) = '' THEN
    RAISE EXCEPTION 'An approval note is required for the audit record.' USING ERRCODE = '22023';
  END IF;

  SELECT policy.* INTO v_policy
  FROM public.game_run_score_policy_versions AS policy
  WHERE policy.id = p_policy_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Score policy version not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_policy.created_by = v_user_id THEN
    LOCK TABLE auth.users IN SHARE MODE;
    SELECT count(*)::integer INTO v_admin_count
    FROM auth.users AS auth_user
    WHERE auth_user.raw_app_meta_data ->> 'role' = 'admin';

    IF v_admin_count <> 1 OR NOT EXISTS (
      SELECT 1
      FROM auth.users AS auth_user
      WHERE auth_user.id = v_user_id
        AND auth_user.raw_app_meta_data ->> 'role' = 'admin'
    ) THEN
      RAISE EXCEPTION 'A score policy creator can only approve their own policy when they are the sole administrator.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT approval.* INTO v_approval
  FROM public.game_run_score_policy_approvals AS approval
  WHERE approval.policy_id = v_policy.id;
  IF NOT FOUND THEN
    INSERT INTO public.game_run_score_policy_approvals (policy_id, approved_by, approval_note)
    VALUES (v_policy.id, v_user_id, btrim(p_approval_note))
    RETURNING * INTO v_approval;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'policy_id', v_policy.id,
    'version', v_policy.version,
    'created_by', v_policy.created_by,
    'approved_at', v_approval.approved_at,
    'approved_by', v_approval.approved_by,
    'approval_note', v_approval.approval_note,
    'is_approved', true
  );
END;
$$;