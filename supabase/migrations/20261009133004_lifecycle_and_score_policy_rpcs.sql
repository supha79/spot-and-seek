CREATE FUNCTION public.guard_game_publish_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Games must be inserted as unpublished drafts.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    IF current_setting('spot_seek.content_status_rpc', true) IS DISTINCT FROM 'on'
      OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Game publish state can only be changed through an authorized RPC.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER games_restrict_initial_publish
  BEFORE INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_publish_state();
CREATE TRIGGER games_guard_publish_state_update
  BEFORE UPDATE OF status, published_at ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_publish_state();

CREATE FUNCTION public.guard_level_parent_game_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_game_status text;
BEGIN
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  SELECT game.status
  INTO v_game_status
  FROM public.games AS game
  WHERE game.id = NEW.game_id
  FOR SHARE;

  IF NOT FOUND OR v_game_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Parent game must be published before level can be published.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER levels_require_published_parent
  BEFORE UPDATE OF status, published_at ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_level_parent_game_published();

CREATE FUNCTION public._set_game_lifecycle(p_game_id uuid, p_target_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_game public.games%ROWTYPE;
  v_published_at timestamptz;
  v_previous_guard_setting text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;
  IF p_target_status NOT IN ('published', 'draft', 'archived') THEN
    RAISE EXCEPTION 'Unsupported Game lifecycle action.' USING ERRCODE = '22023';
  END IF;

  SELECT game.* INTO v_game
  FROM public.games AS game
  WHERE game.id = p_game_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_game.status = 'archived' THEN
    IF p_target_status <> 'archived' THEN
      RAISE EXCEPTION 'Archived games cannot be republished.' USING ERRCODE = '55000';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'game_id', v_game.id, 'status', 'archived', 'published_at', NULL
    );
  END IF;

  IF v_game.status = p_target_status THEN
    RETURN pg_catalog.jsonb_build_object(
      'game_id', v_game.id,
      'status', v_game.status,
      'published_at', v_game.published_at
    );
  END IF;

  IF p_target_status IN ('draft', 'archived') AND EXISTS (
    SELECT 1
    FROM public.levels AS level
    WHERE level.game_id = v_game.id AND level.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Unpublish or archive published levels before changing the parent game.'
      USING ERRCODE = '55000';
  END IF;

  v_published_at := CASE
    WHEN p_target_status = 'published' THEN COALESCE(v_game.published_at, pg_catalog.clock_timestamp())
    ELSE NULL
  END;
  v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
  PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
  UPDATE public.games AS game
  SET status = p_target_status,
      published_at = v_published_at,
      updated_at = pg_catalog.clock_timestamp()
  WHERE game.id = v_game.id;
  PERFORM pg_catalog.set_config(
    'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
  );

  RETURN pg_catalog.jsonb_build_object(
    'game_id', v_game.id,
    'status', p_target_status,
    'published_at', v_published_at
  );
END;
$$;

CREATE FUNCTION public.publish_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public._set_game_lifecycle(p_game_id, 'published');
$$;

CREATE FUNCTION public.unpublish_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public._set_game_lifecycle(p_game_id, 'draft');
$$;

CREATE FUNCTION public.archive_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public._set_game_lifecycle(p_game_id, 'archived');
$$;

CREATE FUNCTION public.create_game_run_score_policy_version(
  p_version text,
  p_time_weight integer,
  p_wrong_click_penalty integer,
  p_hint_penalty integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_policy public.game_run_score_policy_versions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;
  IF p_version IS NULL OR btrim(p_version) = '' THEN
    RAISE EXCEPTION 'Policy version is required.' USING ERRCODE = '22023';
  END IF;
  IF p_time_weight IS NULL OR p_time_weight < 0
    OR p_wrong_click_penalty IS NULL OR p_wrong_click_penalty < 0
    OR p_hint_penalty IS NULL OR p_hint_penalty < 0 THEN
    RAISE EXCEPTION 'Score policy weights must be non-negative integers.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.game_run_score_policy_versions (
    version, time_weight, wrong_click_penalty, hint_penalty, created_by
  )
  VALUES (
    btrim(p_version), p_time_weight, p_wrong_click_penalty, p_hint_penalty, v_user_id
  )
  RETURNING * INTO v_policy;

  RETURN pg_catalog.jsonb_build_object(
    'policy_id', v_policy.id,
    'version', v_policy.version,
    'time_weight', v_policy.time_weight,
    'wrong_click_penalty', v_policy.wrong_click_penalty,
    'hint_penalty', v_policy.hint_penalty,
    'created_at', v_policy.created_at,
    'created_by', v_policy.created_by,
    'is_approved', false
  );
END;
$$;

CREATE FUNCTION public.approve_game_run_score_policy(p_policy_id uuid, p_approval_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_policy public.game_run_score_policy_versions%ROWTYPE;
  v_approval public.game_run_score_policy_approvals%ROWTYPE;
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
    RAISE EXCEPTION 'A score policy creator cannot approve their own policy.' USING ERRCODE = '42501';
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

CREATE POLICY game_run_score_policy_versions_admin_select
  ON public.game_run_score_policy_versions
  FOR SELECT TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));
CREATE POLICY game_run_score_policy_approvals_admin_select
  ON public.game_run_score_policy_approvals
  FOR SELECT TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

GRANT SELECT ON TABLE public.game_run_score_policy_versions TO authenticated;
GRANT SELECT ON TABLE public.game_run_score_policy_approvals TO authenticated;

REVOKE UPDATE ON TABLE public.games FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name, description, sort_order, updated_at) ON TABLE public.games TO authenticated;

REVOKE ALL ON FUNCTION public.guard_game_publish_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_level_parent_game_published() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._set_game_lifecycle(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_game(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unpublish_game(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_game(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_game_run_score_policy_version(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_game_run_score_policy(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.publish_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_run_score_policy_version(text, integer, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_game_run_score_policy(uuid, text) TO authenticated;