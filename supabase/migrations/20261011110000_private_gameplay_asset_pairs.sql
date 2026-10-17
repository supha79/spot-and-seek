ALTER TABLE public.level_assets
  DROP CONSTRAINT IF EXISTS level_assets_asset_type_check,
  ADD CONSTRAINT level_assets_asset_type_check
    CHECK (asset_type IN ('original', 'comparison', 'thumbnail')),
  ADD CONSTRAINT level_assets_id_level_id_key UNIQUE (id, level_id);

DROP INDEX public.level_assets_primary_idx;
CREATE UNIQUE INDEX level_assets_primary_by_type_idx
  ON public.level_assets (level_id, asset_type)
  WHERE is_primary;

ALTER TABLE public.game_run_rule_versions
  ADD COLUMN original_asset_id uuid,
  ADD COLUMN comparison_asset_id uuid,
  ADD CONSTRAINT game_run_rule_versions_asset_pair_shape CHECK (
    (original_asset_id IS NULL AND comparison_asset_id IS NULL)
    OR (original_asset_id IS NOT NULL AND comparison_asset_id IS NOT NULL)
  ),
  ADD CONSTRAINT game_run_rule_versions_original_asset_fk
    FOREIGN KEY (original_asset_id, content_level_id)
    REFERENCES public.level_assets (id, level_id) ON DELETE RESTRICT,
  ADD CONSTRAINT game_run_rule_versions_comparison_asset_fk
    FOREIGN KEY (comparison_asset_id, content_level_id)
    REFERENCES public.level_assets (id, level_id) ON DELETE RESTRICT;

CREATE FUNCTION public.guard_pinned_level_asset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.game_run_rule_versions AS rule_version
    WHERE rule_version.original_asset_id = OLD.id
      OR rule_version.comparison_asset_id = OLD.id
  ) AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.level_id IS DISTINCT FROM OLD.level_id
    OR NEW.asset_type IS DISTINCT FROM OLD.asset_type
    OR NEW.bucket_name IS DISTINCT FROM OLD.bucket_name
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
    OR NEW.public_url IS DISTINCT FROM OLD.public_url
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
    OR NEW.width IS DISTINCT FROM OLD.width
    OR NEW.height IS DISTINCT FROM OLD.height
    OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'An asset pinned to a published rule version is immutable.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER level_assets_pinned_immutable
  BEFORE UPDATE ON public.level_assets
  FOR EACH ROW EXECUTE FUNCTION public.guard_pinned_level_asset();

REVOKE ALL ON FUNCTION public.guard_pinned_level_asset() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public._gameplay_asset_object_is_valid(
  p_level_id uuid,
  p_asset_type text,
  p_bucket_name text,
  p_asset jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_storage_path text;
  v_mime_type text;
  v_file_size_bytes bigint;
  v_path_pattern text;
BEGIN
  IF p_asset IS NULL OR pg_catalog.jsonb_typeof(p_asset) <> 'object'
    OR p_bucket_name IS DISTINCT FROM 'gameplay-assets'
    OR p_asset_type NOT IN ('original', 'comparison') THEN
    RETURN false;
  END IF;

  IF pg_catalog.jsonb_typeof(p_asset -> 'storage_path') IS DISTINCT FROM 'string'
    OR pg_catalog.jsonb_typeof(p_asset -> 'mime_type') IS DISTINCT FROM 'string'
    OR pg_catalog.jsonb_typeof(p_asset -> 'file_size_bytes') IS DISTINCT FROM 'number'
    OR pg_catalog.jsonb_typeof(p_asset -> 'width') IS DISTINCT FROM 'number'
    OR pg_catalog.jsonb_typeof(p_asset -> 'height') IS DISTINCT FROM 'number' THEN
    RETURN false;
  END IF;

  v_storage_path := p_asset ->> 'storage_path';
  v_mime_type := p_asset ->> 'mime_type';
  v_file_size_bytes := (p_asset ->> 'file_size_bytes')::bigint;
  IF v_file_size_bytes <= 0 OR v_file_size_bytes > 5242880
    OR (p_asset ->> 'width')::integer <= 0
    OR (p_asset ->> 'height')::integer <= 0
    OR v_mime_type NOT IN ('image/png', 'image/jpeg', 'image/webp') THEN
    RETURN false;
  END IF;

  v_path_pattern := '^' || p_level_id::text
    || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
    || p_asset_type || '\.(png|jpg|jpeg|webp)$';
  IF v_storage_path !~* v_path_pattern
    OR (v_mime_type = 'image/png' AND v_storage_path !~* '\.png$')
    OR (v_mime_type = 'image/jpeg' AND v_storage_path !~* '\.(jpg|jpeg)$')
    OR (v_mime_type = 'image/webp' AND v_storage_path !~* '\.webp$') THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets AS bucket
    WHERE bucket.id = 'gameplay-assets'
      AND bucket.public IS FALSE
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM storage.objects AS storage_object
    WHERE storage_object.bucket_id = 'gameplay-assets'
      AND storage_object.name = v_storage_path
      AND storage_object.metadata ->> 'mimetype' = v_mime_type
      AND CASE
        WHEN (storage_object.metadata ->> 'size') ~ '^[0-9]+$'
          THEN (storage_object.metadata ->> 'size')::bigint = v_file_size_bytes
        ELSE false
      END
  );
END;
$$;

CREATE FUNCTION public.register_level_asset_pair(
  p_level_id uuid,
  p_original_asset jsonb,
  p_comparison_asset jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_level public.levels%ROWTYPE;
  v_original public.level_assets%ROWTYPE;
  v_comparison public.level_assets%ROWTYPE;
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
  IF NOT FOUND OR v_level.status <> 'draft' THEN
    RAISE EXCEPTION 'Unpublish the level before replacing its artwork.' USING ERRCODE = '55000';
  END IF;

  IF NOT public._gameplay_asset_object_is_valid(p_level_id, 'original', 'gameplay-assets', p_original_asset)
    OR NOT public._gameplay_asset_object_is_valid(p_level_id, 'comparison', 'gameplay-assets', p_comparison_asset)
    OR p_original_asset ->> 'storage_path' = p_comparison_asset ->> 'storage_path'
    OR p_original_asset ->> 'width' IS DISTINCT FROM p_comparison_asset ->> 'width'
    OR p_original_asset ->> 'height' IS DISTINCT FROM p_comparison_asset ->> 'height' THEN
    RAISE EXCEPTION 'Both artwork files must be valid, private, and have matching dimensions.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.level_assets AS asset
  SET is_primary = false
  WHERE asset.level_id = p_level_id
    AND asset.asset_type IN ('original', 'comparison')
    AND asset.is_primary;

  INSERT INTO public.level_assets (
    level_id, asset_type, bucket_name, storage_path, public_url,
    mime_type, width, height, file_size_bytes, is_primary, created_by
  )
  VALUES (
    p_level_id, 'original', 'gameplay-assets', p_original_asset ->> 'storage_path', NULL,
    p_original_asset ->> 'mime_type', (p_original_asset ->> 'width')::integer,
    (p_original_asset ->> 'height')::integer, (p_original_asset ->> 'file_size_bytes')::bigint,
    true, v_user_id
  )
  RETURNING * INTO v_original;

  INSERT INTO public.level_assets (
    level_id, asset_type, bucket_name, storage_path, public_url,
    mime_type, width, height, file_size_bytes, is_primary, created_by
  )
  VALUES (
    p_level_id, 'comparison', 'gameplay-assets', p_comparison_asset ->> 'storage_path', NULL,
    p_comparison_asset ->> 'mime_type', (p_comparison_asset ->> 'width')::integer,
    (p_comparison_asset ->> 'height')::integer, (p_comparison_asset ->> 'file_size_bytes')::bigint,
    true, v_user_id
  )
  RETURNING * INTO v_comparison;

  RETURN pg_catalog.jsonb_build_object(
    'level_id', p_level_id,
    'original_asset_id', v_original.id,
    'comparison_asset_id', v_comparison.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public._gameplay_asset_object_is_valid(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_level_asset_pair(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_level_asset_pair(uuid, jsonb, jsonb) TO authenticated;

CREATE FUNCTION public.read_published_level_asset_pair(p_level_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rule public.game_run_rule_versions%ROWTYPE;
  v_original public.level_assets%ROWTYPE;
  v_comparison public.level_assets%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT rule_version.* INTO v_rule
  FROM public.game_run_rule_versions AS rule_version
  INNER JOIN public.levels AS level
    ON level.id = rule_version.content_level_id
  INNER JOIN public.games AS game
    ON game.id = level.game_id
  WHERE rule_version.content_level_id = p_level_id
    AND level.status = 'published'
    AND game.status = 'published'
  ORDER BY rule_version.version DESC
  LIMIT 1;
  IF NOT FOUND OR v_rule.original_asset_id IS NULL OR v_rule.comparison_asset_id IS NULL THEN
    RAISE EXCEPTION 'Published level artwork is unavailable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT asset.* INTO v_original
  FROM public.level_assets AS asset
  WHERE asset.id = v_rule.original_asset_id
    AND asset.level_id = p_level_id
    AND asset.asset_type = 'original';
  SELECT asset.* INTO v_comparison
  FROM public.level_assets AS asset
  WHERE asset.id = v_rule.comparison_asset_id
    AND asset.level_id = p_level_id
    AND asset.asset_type = 'comparison';
  IF v_original.id IS NULL
    OR v_comparison.id IS NULL
    OR v_original.width IS DISTINCT FROM v_comparison.width
    OR v_original.height IS DISTINCT FROM v_comparison.height
    OR NOT public._gameplay_asset_object_is_valid(
      p_level_id, 'original', v_original.bucket_name, pg_catalog.jsonb_build_object(
        'storage_path', v_original.storage_path,
        'mime_type', v_original.mime_type,
        'file_size_bytes', v_original.file_size_bytes,
        'width', v_original.width,
        'height', v_original.height
      )
    )
    OR NOT public._gameplay_asset_object_is_valid(
      p_level_id, 'comparison', v_comparison.bucket_name, pg_catalog.jsonb_build_object(
        'storage_path', v_comparison.storage_path,
        'mime_type', v_comparison.mime_type,
        'file_size_bytes', v_comparison.file_size_bytes,
        'width', v_comparison.width,
        'height', v_comparison.height
      )
    ) THEN
    RAISE EXCEPTION 'Published level artwork is unavailable.' USING ERRCODE = 'P0002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'level_id', p_level_id,
    'rule_version_id', v_rule.id,
    'original', pg_catalog.jsonb_build_object(
      'id', v_original.id,
      'bucket_name', v_original.bucket_name,
      'storage_path', v_original.storage_path,
      'mime_type', v_original.mime_type,
      'width', v_original.width,
      'height', v_original.height,
      'file_size_bytes', v_original.file_size_bytes
    ),
    'comparison', pg_catalog.jsonb_build_object(
      'id', v_comparison.id,
      'bucket_name', v_comparison.bucket_name,
      'storage_path', v_comparison.storage_path,
      'mime_type', v_comparison.mime_type,
      'width', v_comparison.width,
      'height', v_comparison.height,
      'file_size_bytes', v_comparison.file_size_bytes
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.read_published_level_asset_pair(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_published_level_asset_pair(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_level_with_runtime_rules(p_level_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_level public.levels%ROWTYPE;
  v_game_status text;
  v_policy public.game_run_score_policy_versions%ROWTYPE;
  v_original_asset public.level_assets%ROWTYPE;
  v_comparison_asset public.level_assets%ROWTYPE;
  v_spot_count bigint;
  v_distinct_spot_count bigint;
  v_active_spots jsonb;
  v_content_json jsonb;
  v_content_hash text;
  v_registered_key text;
  v_rule_version public.game_run_rule_versions%ROWTYPE;
  v_next_version integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
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

  SELECT game.status INTO v_game_status
  FROM public.games AS game
  WHERE game.id = v_level.game_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent game not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_level.status = 'archived' OR v_game_status = 'archived' THEN
    RAISE EXCEPTION 'Archived levels or parent games cannot be published.' USING ERRCODE = '55000';
  END IF;
  IF v_level.title IS NULL OR btrim(v_level.title) = '' THEN
    RAISE EXCEPTION 'A non-empty level title is required.' USING ERRCODE = '22023';
  END IF;
  IF v_level.difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'Level difficulty is invalid.' USING ERRCODE = '22023';
  END IF;
  IF v_level.max_duration_seconds <= 0 OR v_level.max_hints NOT BETWEEN 0 AND 3 THEN
    RAISE EXCEPTION 'Level duration or hint limit is invalid.' USING ERRCODE = '22023';
  END IF;
  IF v_level.level_key IS NULL
    OR v_level.level_key <> lower(v_level.level_key)
    OR v_level.level_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Level key must be a lowercase slug.' USING ERRCODE = '22023';
  END IF;
  IF v_level.level_key IN (
    'cozy-cat-corner', 'sunny-picnic', 'balloon-hills', 'greenhouse-garden',
    'bakery-breeze', 'night-train', 'stormy-shelf', 'forest-fable'
  ) THEN
    RAISE EXCEPTION 'Legacy level keys are reserved.' USING ERRCODE = '22023';
  END IF;

  SELECT asset.* INTO v_original_asset
  FROM public.level_assets AS asset
  WHERE asset.level_id = v_level.id
    AND asset.asset_type = 'original'
    AND asset.is_primary
  FOR SHARE;
  SELECT asset.* INTO v_comparison_asset
  FROM public.level_assets AS asset
  WHERE asset.level_id = v_level.id
    AND asset.asset_type = 'comparison'
    AND asset.is_primary
  FOR SHARE;
  IF NOT FOUND
    OR v_original_asset.id IS NULL
    OR v_comparison_asset.id IS NULL
    OR v_original_asset.width IS DISTINCT FROM v_comparison_asset.width
    OR v_original_asset.height IS DISTINCT FROM v_comparison_asset.height
    OR NOT public._gameplay_asset_object_is_valid(
      v_level.id, 'original', v_original_asset.bucket_name, pg_catalog.jsonb_build_object(
        'storage_path', v_original_asset.storage_path,
        'mime_type', v_original_asset.mime_type,
        'file_size_bytes', v_original_asset.file_size_bytes,
        'width', v_original_asset.width,
        'height', v_original_asset.height
      )
    )
    OR NOT public._gameplay_asset_object_is_valid(
      v_level.id, 'comparison', v_comparison_asset.bucket_name, pg_catalog.jsonb_build_object(
        'storage_path', v_comparison_asset.storage_path,
        'mime_type', v_comparison_asset.mime_type,
        'file_size_bytes', v_comparison_asset.file_size_bytes,
        'width', v_comparison_asset.width,
        'height', v_comparison_asset.height
      )
    ) THEN
    RAISE EXCEPTION 'A valid private Original and Comparison image pair is required to publish.'
      USING ERRCODE = '55000';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('spot_seek.level_key:' || lower(v_level.level_key), 0)
  );
  IF EXISTS (
    SELECT 1 FROM public.levels AS other_level
    WHERE other_level.id <> v_level.id
      AND lower(other_level.level_key) = lower(v_level.level_key)
  ) THEN
    RAISE EXCEPTION 'Level key is already in use.' USING ERRCODE = '23505';
  END IF;

  SELECT registry.level_key INTO v_registered_key
  FROM public.game_run_level_key_registry AS registry
  WHERE lower(registry.level_key) = lower(v_level.level_key)
    AND registry.content_level_id <> v_level.id;
  IF FOUND THEN
    RAISE EXCEPTION 'Level key is already permanently registered.' USING ERRCODE = '23505';
  END IF;

  SELECT registry.level_key INTO v_registered_key
  FROM public.game_run_level_key_registry AS registry
  WHERE registry.content_level_id = v_level.id
  FOR UPDATE;
  IF FOUND AND v_registered_key IS DISTINCT FROM v_level.level_key THEN
    RAISE EXCEPTION 'A level key cannot change after its first publish.' USING ERRCODE = '55000';
  END IF;

  SELECT count(*), count(DISTINCT spot.spot_key)
  INTO v_spot_count, v_distinct_spot_count
  FROM public.level_spots AS spot
  WHERE spot.level_id = v_level.id AND spot.is_active;
  IF v_spot_count < 1 THEN
    RAISE EXCEPTION 'A level needs at least one active spot.' USING ERRCODE = '22023';
  END IF;
  IF v_spot_count <> v_distinct_spot_count THEN
    RAISE EXCEPTION 'Active spot keys must be unique.' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'spot_key', spot.spot_key,
      'label', spot.label,
      'shape', spot.shape,
      'x_norm', spot.x_norm,
      'y_norm', spot.y_norm,
      'width_norm', spot.width_norm,
      'height_norm', spot.height_norm,
      'radius_norm', spot.radius_norm,
      'tolerance_norm', spot.tolerance_norm,
      'sort_order', spot.sort_order
    ) ORDER BY spot.sort_order, spot.spot_key
  ) INTO v_active_spots
  FROM public.level_spots AS spot
  WHERE spot.level_id = v_level.id AND spot.is_active;

  SELECT policy.* INTO v_policy
  FROM public.game_run_score_policy_versions AS policy
  INNER JOIN public.game_run_score_policy_approvals AS approval
    ON approval.policy_id = policy.id
  ORDER BY approval.approved_at DESC, policy.id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No approved game run score policy version exists.' USING ERRCODE = '55000';
  END IF;

  v_content_json := pg_catalog.jsonb_build_object(
    'snapshot_schema_version', 2,
    'level', pg_catalog.jsonb_build_object(
      'game_id', v_level.game_id,
      'level_key', v_level.level_key,
      'title', v_level.title,
      'difficulty', v_level.difficulty,
      'max_duration_seconds', v_level.max_duration_seconds,
      'max_hints', v_level.max_hints
    ),
    'assets', pg_catalog.jsonb_build_object(
      'original', pg_catalog.jsonb_build_object(
        'id', v_original_asset.id,
        'bucket_name', v_original_asset.bucket_name,
        'storage_path', v_original_asset.storage_path,
        'mime_type', v_original_asset.mime_type,
        'width', v_original_asset.width,
        'height', v_original_asset.height,
        'file_size_bytes', v_original_asset.file_size_bytes
      ),
      'comparison', pg_catalog.jsonb_build_object(
        'id', v_comparison_asset.id,
        'bucket_name', v_comparison_asset.bucket_name,
        'storage_path', v_comparison_asset.storage_path,
        'mime_type', v_comparison_asset.mime_type,
        'width', v_comparison_asset.width,
        'height', v_comparison_asset.height,
        'file_size_bytes', v_comparison_asset.file_size_bytes
      )
    ),
    'active_spots', v_active_spots,
    'score_policy', pg_catalog.jsonb_build_object(
      'version', v_policy.version,
      'time_weight', v_policy.time_weight,
      'wrong_click_penalty', v_policy.wrong_click_penalty,
      'hint_penalty', v_policy.hint_penalty
    )
  );
  v_content_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(v_content_json::text, 'UTF8')),
    'hex'
  );

  SELECT rule_version.* INTO v_rule_version
  FROM public.game_run_rule_versions AS rule_version
  WHERE rule_version.content_level_id = v_level.id
  ORDER BY rule_version.version DESC
  LIMIT 1;
  IF FOUND AND v_rule_version.content_hash = v_content_hash THEN
    v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
    PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
    UPDATE public.levels AS level
    SET status = 'published', published_at = COALESCE(level.published_at, v_now), updated_at = v_now
    WHERE level.id = v_level.id;
    PERFORM pg_catalog.set_config(
      'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
    );
    RETURN pg_catalog.jsonb_build_object(
      'level_id', v_level.id, 'level_key', v_level.level_key, 'status', 'published',
      'rule_version_id', v_rule_version.id, 'rule_version', v_rule_version.version,
      'content_hash', v_rule_version.content_hash
    );
  END IF;

  IF NOT FOUND THEN
    v_next_version := 1;
  ELSE
    v_next_version := v_rule_version.version + 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_run_level_key_registry AS registry
    WHERE registry.content_level_id = v_level.id
  ) THEN
    INSERT INTO public.game_run_level_key_registry (level_key, content_level_id, created_by)
    VALUES (v_level.level_key, v_level.id, v_user_id);
  END IF;

  INSERT INTO public.game_run_rule_versions (
    content_level_id, game_id, version, level_key, title, difficulty,
    max_duration_seconds, max_hints, active_spots,
    score_policy_id, score_policy_version,
    time_weight, wrong_click_penalty, hint_penalty,
    original_asset_id, comparison_asset_id, content_hash, created_by
  )
  VALUES (
    v_level.id, v_level.game_id, v_next_version, v_level.level_key, v_level.title, v_level.difficulty,
    v_level.max_duration_seconds, v_level.max_hints, v_active_spots,
    v_policy.id, v_policy.version,
    v_policy.time_weight, v_policy.wrong_click_penalty, v_policy.hint_penalty,
    v_original_asset.id, v_comparison_asset.id, v_content_hash, v_user_id
  )
  RETURNING * INTO v_rule_version;

  v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
  PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
  UPDATE public.levels AS level
  SET status = 'published', published_at = COALESCE(level.published_at, v_now), updated_at = v_now
  WHERE level.id = v_level.id;
  PERFORM pg_catalog.set_config(
    'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
  );

  RETURN pg_catalog.jsonb_build_object(
    'level_id', v_level.id, 'level_key', v_level.level_key, 'status', 'published',
    'rule_version_id', v_rule_version.id, 'rule_version', v_rule_version.version,
    'content_hash', v_rule_version.content_hash
  );
END;
$$;

CREATE FUNCTION public._can_insert_gameplay_asset_object(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    AND p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(original|comparison)\.(png|jpg|jpeg|webp)$'
    AND EXISTS (
      SELECT 1
      FROM public.levels AS level
      WHERE level.id = split_part(p_name, '/', 1)::uuid
        AND level.status = 'draft'
    )
    AND EXISTS (
      SELECT 1
      FROM storage.buckets AS bucket
      WHERE bucket.id = 'gameplay-assets'
        AND bucket.public IS FALSE
    );
$$;

CREATE FUNCTION public._can_select_gameplay_asset_object(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(original|comparison)\.(png|jpg|jpeg|webp)$'
    AND EXISTS (
      SELECT 1
      FROM storage.buckets AS bucket
      WHERE bucket.id = 'gameplay-assets'
        AND bucket.public IS FALSE
    )
    AND (
      (
        COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
        AND EXISTS (
          SELECT 1
          FROM public.level_assets AS asset
          WHERE asset.storage_path = p_name
            AND asset.bucket_name = 'gameplay-assets'
            AND asset.asset_type IN ('original', 'comparison')
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.levels AS level
        INNER JOIN public.games AS game
          ON game.id = level.game_id
        INNER JOIN public.game_run_rule_versions AS rule_version
          ON rule_version.content_level_id = level.id
        INNER JOIN public.level_assets AS asset
          ON asset.level_id = level.id
         AND asset.id IN (rule_version.original_asset_id, rule_version.comparison_asset_id)
        WHERE level.id = split_part(p_name, '/', 1)::uuid
          AND level.status = 'published'
          AND game.status = 'published'
          AND rule_version.id = (
            SELECT latest.id
            FROM public.game_run_rule_versions AS latest
            WHERE latest.content_level_id = level.id
            ORDER BY latest.version DESC
            LIMIT 1
          )
          AND asset.bucket_name = 'gameplay-assets'
          AND asset.storage_path = p_name
          AND asset.asset_type = split_part(split_part(p_name, '/', 3), '.', 1)
          AND COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'player', false)
      )
    );
$$;

REVOKE ALL ON FUNCTION public._can_insert_gameplay_asset_object(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._can_select_gameplay_asset_object(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._can_insert_gameplay_asset_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._can_select_gameplay_asset_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._can_insert_gameplay_asset_object(text) TO anon;
GRANT EXECUTE ON FUNCTION public._can_select_gameplay_asset_object(text) TO anon;

CREATE POLICY gameplay_assets_admin_insert_draft
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'gameplay-assets'
    AND public._can_insert_gameplay_asset_object(name)
  );

CREATE POLICY gameplay_assets_admin_insert_draft_guard
  ON storage.objects
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'gameplay-assets'
    AND public._can_insert_gameplay_asset_object(name)
  );

CREATE POLICY gameplay_assets_select_managed_or_published
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gameplay-assets'
    AND public._can_select_gameplay_asset_object(name)
  );

CREATE POLICY gameplay_assets_select_managed_or_published_guard
  ON storage.objects
  AS RESTRICTIVE
  FOR SELECT
  TO public
  USING (
    bucket_id = 'gameplay-assets'
    AND public._can_select_gameplay_asset_object(name)
  );