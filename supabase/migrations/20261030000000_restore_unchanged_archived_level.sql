-- Restore only when the normal publish path reuses the same immutable snapshot.
CREATE FUNCTION public.restore_archived_level(p_level_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_level public.levels%ROWTYPE;
  v_game_status text;
  v_rule public.game_run_rule_versions%ROWTYPE;
  v_publish_result jsonb;
  v_previous_guard_setting text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;

  SELECT level.* INTO v_level
  FROM public.levels AS level
  WHERE level.id = p_level_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Level not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_level.status <> 'archived' THEN
    RAISE EXCEPTION 'Only archived levels can be restored.' USING ERRCODE = '55000';
  END IF;

  SELECT game.status INTO v_game_status
  FROM public.games AS game
  WHERE game.id = v_level.game_id
  FOR SHARE;
  IF NOT FOUND OR v_game_status <> 'published' THEN
    RAISE EXCEPTION 'The parent game must be published before restoring this level.' USING ERRCODE = '55000';
  END IF;

  SELECT rule_version.* INTO v_rule
  FROM public.game_run_rule_versions AS rule_version
  WHERE rule_version.content_level_id = v_level.id
  ORDER BY rule_version.version DESC
  LIMIT 1;
  IF NOT FOUND OR v_rule.original_asset_id IS NULL OR v_rule.comparison_asset_id IS NULL THEN
    RAISE EXCEPTION 'The archived level has no complete published gameplay snapshot to restore.' USING ERRCODE = '55000';
  END IF;

  v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
  PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
  UPDATE public.levels AS level
  SET status = 'draft', published_at = NULL, updated_at = pg_catalog.clock_timestamp()
  WHERE level.id = v_level.id;

  v_publish_result := public.publish_level_with_runtime_rules(v_level.id);
  IF v_publish_result ->> 'rule_version_id' IS DISTINCT FROM v_rule.id::text
    OR v_publish_result ->> 'rule_version' IS DISTINCT FROM v_rule.version::text
    OR v_publish_result ->> 'content_hash' IS DISTINCT FROM v_rule.content_hash THEN
    RAISE EXCEPTION 'The archived level no longer matches its last published gameplay snapshot.' USING ERRCODE = '55000';
  END IF;

  PERFORM pg_catalog.set_config(
    'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
  );
  RETURN v_publish_result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_archived_level(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_archived_level(uuid) TO authenticated;
