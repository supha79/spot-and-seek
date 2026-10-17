-- Backend run compatibility: Foundation + level publishing only. Run RPCs are unchanged.
-- Frontend impact: content reads/admin CRUD gain authenticated grants subject to existing RLS.
-- Level creation remains draft-only. Existing client-side publishLevel, unpublishLevel, and
-- archiveLevel direct UPDATE calls will be denied and must move to these RPCs in a follow-up.
-- No anon table privileges are granted. The later lifecycle migration requires published parents.
-- Score policy definitions and approvals are intentionally not seeded/approved by this migration.
--
-- Rollback: do not automatically drop this schema after any rule version/key registry row or
-- dynamic run/session has been created. Disable publishing and ship a forward migration instead.
-- A pre-usage rollback must first remove RPC grants/functions and triggers, then constraints and
-- added columns, restore game_runs.level_id NOT NULL, and finally drop the new tables in reverse
-- dependency order. Never rewrite or delete legacy runs/rules as part of rollback.

CREATE TABLE public.game_run_score_policy_versions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  version text NOT NULL UNIQUE,
  time_weight integer NOT NULL CHECK (time_weight >= 0),
  wrong_click_penalty integer NOT NULL CHECK (wrong_click_penalty >= 0),
  hint_penalty integer NOT NULL CHECK (hint_penalty >= 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  CONSTRAINT game_run_score_policy_versions_version_nonempty CHECK (btrim(version) <> ''),
  CONSTRAINT game_run_score_policy_versions_id_version_key UNIQUE (id, version)
);

CREATE TABLE public.game_run_score_policy_approvals (
  policy_id uuid PRIMARY KEY REFERENCES public.game_run_score_policy_versions (id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  approved_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  approval_note text NOT NULL DEFAULT ''
);

CREATE TABLE public.game_run_level_key_registry (
  level_key text PRIMARY KEY,
  content_level_id uuid NOT NULL UNIQUE REFERENCES public.levels (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  CONSTRAINT game_run_level_key_registry_identity_key UNIQUE (content_level_id, level_key),
  CONSTRAINT game_run_level_key_registry_slug CHECK (
    level_key = lower(level_key)
    AND level_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  CONSTRAINT game_run_level_key_registry_not_legacy CHECK (
    level_key NOT IN (
      'cozy-cat-corner', 'sunny-picnic', 'balloon-hills', 'greenhouse-garden',
      'bakery-breeze', 'night-train', 'stormy-shelf', 'forest-fable'
    )
  )
);

CREATE TABLE public.game_run_rule_versions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  content_level_id uuid NOT NULL REFERENCES public.levels (id) ON DELETE RESTRICT,
  game_id uuid NOT NULL REFERENCES public.games (id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version >= 1),
  level_key text NOT NULL,
  title text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  max_duration_seconds integer NOT NULL CHECK (max_duration_seconds > 0),
  max_hints integer NOT NULL CHECK (max_hints BETWEEN 0 AND 3),
  active_spots jsonb NOT NULL,
  score_policy_id uuid NOT NULL,
  score_policy_version text NOT NULL,
  time_weight integer NOT NULL CHECK (time_weight >= 0),
  wrong_click_penalty integer NOT NULL CHECK (wrong_click_penalty >= 0),
  hint_penalty integer NOT NULL CHECK (hint_penalty >= 0),
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  CONSTRAINT game_run_rule_versions_content_version_key UNIQUE (content_level_id, version),
  CONSTRAINT game_run_rule_versions_id_content_key UNIQUE (id, content_level_id),
  CONSTRAINT game_run_rule_versions_key_identity_fk
    FOREIGN KEY (content_level_id, level_key)
    REFERENCES public.game_run_level_key_registry (content_level_id, level_key)
    ON DELETE RESTRICT,
  CONSTRAINT game_run_rule_versions_policy_fk
    FOREIGN KEY (score_policy_id, score_policy_version)
    REFERENCES public.game_run_score_policy_versions (id, version)
    ON DELETE RESTRICT,
  CONSTRAINT game_run_rule_versions_spots_nonempty CHECK (
    jsonb_typeof(active_spots) = 'array' AND jsonb_array_length(active_spots) > 0
  ),
  CONSTRAINT game_run_rule_versions_hash_sha256 CHECK (content_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE public.game_run_level_key_registry IS
  'Permanent global mapping from a published level_key to one content UUID. Versions reuse this identity.';
COMMENT ON TABLE public.game_run_score_policy_versions IS
  'Immutable scoring definitions; approval is an append-only row in game_run_score_policy_approvals.';
COMMENT ON TABLE public.game_run_rule_versions IS
  'Immutable server-compiled runtime snapshots. score_value is intentionally excluded from scoring/hash inputs.';

ALTER TABLE public.game_run_score_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_run_score_policy_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_run_level_key_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_run_rule_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_run_score_policy_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.game_run_score_policy_approvals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.game_run_level_key_registry FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.game_run_rule_versions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.game_runs
  ALTER COLUMN level_id DROP NOT NULL,
  ADD COLUMN content_level_id uuid,
  ADD COLUMN rule_version_id uuid;

ALTER TABLE public.game_runs
  ADD CONSTRAINT game_runs_rule_version_level_fk
    FOREIGN KEY (rule_version_id, content_level_id)
    REFERENCES public.game_run_rule_versions (id, content_level_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT game_runs_level_identity_shape CHECK (
    (level_id IS NOT NULL AND content_level_id IS NULL AND rule_version_id IS NULL)
    OR (level_id IS NULL AND content_level_id IS NOT NULL AND rule_version_id IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.game_runs
  VALIDATE CONSTRAINT game_runs_level_identity_shape;

ALTER TABLE public.game_sessions
  ADD COLUMN content_level_id uuid,
  ADD COLUMN level_key text,
  ADD COLUMN rule_version_id uuid;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_rule_version_level_fk
    FOREIGN KEY (rule_version_id, content_level_id)
    REFERENCES public.game_run_rule_versions (id, content_level_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT game_sessions_level_identity_shape CHECK (
    (content_level_id IS NULL AND rule_version_id IS NULL AND level_key IS NULL)
    OR (
      content_level_id IS NOT NULL
      AND rule_version_id IS NOT NULL
      AND level_key IS NOT NULL
      AND level_id = level_key
    )
  ) NOT VALID;

ALTER TABLE public.game_sessions
  VALIDATE CONSTRAINT game_sessions_level_identity_shape;

COMMENT ON COLUMN public.game_sessions.level_id IS
  'Legacy level key for historical rows; dynamic-run finalization must store the pinned level_key here.';

CREATE INDEX game_runs_content_level_started_at_idx
  ON public.game_runs (content_level_id, started_at DESC)
  WHERE content_level_id IS NOT NULL;
CREATE INDEX game_runs_rule_version_idx
  ON public.game_runs (rule_version_id)
  WHERE rule_version_id IS NOT NULL;
CREATE INDEX game_sessions_level_key_played_at_idx
  ON public.game_sessions (level_key, played_at DESC)
  WHERE level_key IS NOT NULL;
CREATE INDEX game_sessions_content_level_played_at_idx
  ON public.game_sessions (content_level_id, played_at DESC)
  WHERE content_level_id IS NOT NULL;

-- Use a trigger rather than validating a CHECK/unique index against existing level_key data.
-- Existing rows are left untouched; new/changed keys and all publish attempts are checked.
CREATE FUNCTION public.guard_game_run_level_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_registered_key text;
BEGIN
  IF NEW.level_key IS NULL
    OR NEW.level_key <> lower(NEW.level_key)
    OR NEW.level_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Level key must be a lowercase slug.' USING ERRCODE = '22023';
  END IF;

  IF NEW.level_key IN (
    'cozy-cat-corner', 'sunny-picnic', 'balloon-hills', 'greenhouse-garden',
    'bakery-breeze', 'night-train', 'stormy-shelf', 'forest-fable'
  ) THEN
    RAISE EXCEPTION 'Legacy level keys are reserved.' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.level_key IS DISTINCT FROM OLD.level_key THEN
    IF lower(OLD.level_key) < lower(NEW.level_key) THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('spot_seek.level_key:' || lower(OLD.level_key), 0)
      );
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('spot_seek.level_key:' || lower(NEW.level_key), 0)
      );
    ELSE
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('spot_seek.level_key:' || lower(NEW.level_key), 0)
      );
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('spot_seek.level_key:' || lower(OLD.level_key), 0)
      );
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.game_run_level_key_registry AS registry
      WHERE registry.content_level_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'A level key cannot change after the level has been published.'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('spot_seek.level_key:' || lower(NEW.level_key), 0)
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.levels AS other_level
    WHERE other_level.id <> NEW.id
      AND lower(other_level.level_key) = lower(NEW.level_key)
  ) THEN
    RAISE EXCEPTION 'Level key is already in use.' USING ERRCODE = '23505';
  END IF;

  SELECT registry.level_key
  INTO v_registered_key
  FROM public.game_run_level_key_registry AS registry
  WHERE lower(registry.level_key) = lower(NEW.level_key)
    AND registry.content_level_id <> NEW.id;

  IF FOUND THEN
    RAISE EXCEPTION 'Level key is already permanently registered.' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER levels_guard_key_namespace
  BEFORE INSERT OR UPDATE OF level_key ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_run_level_key();

CREATE FUNCTION public.guard_immutable_backend_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable and cannot be %.', TG_TABLE_NAME, lower(TG_OP)
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER game_run_rule_versions_immutable
  BEFORE UPDATE OR DELETE ON public.game_run_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_backend_row();
CREATE TRIGGER game_run_score_policy_versions_immutable
  BEFORE UPDATE OR DELETE ON public.game_run_score_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_backend_row();
CREATE TRIGGER game_run_score_policy_approvals_immutable
  BEFORE UPDATE OR DELETE ON public.game_run_score_policy_approvals
  FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_backend_row();
CREATE TRIGGER game_run_level_key_registry_immutable
  BEFORE UPDATE OR DELETE ON public.game_run_level_key_registry
  FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_backend_row();

CREATE FUNCTION public.guard_level_runtime_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'published' AND (
    NEW.game_id IS DISTINCT FROM OLD.game_id
    OR NEW.level_key IS DISTINCT FROM OLD.level_key
    OR NEW.difficulty IS DISTINCT FROM OLD.difficulty
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.max_duration_seconds IS DISTINCT FROM OLD.max_duration_seconds
    OR NEW.max_hints IS DISTINCT FROM OLD.max_hints
  ) THEN
    RAISE EXCEPTION 'Runtime fields cannot change while a level is published; unpublish it first.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER levels_freeze_runtime_fields
  BEFORE UPDATE OF game_id, level_key, difficulty, title, max_duration_seconds, max_hints
  ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_level_runtime_fields();

CREATE FUNCTION public.guard_level_publish_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Levels must be inserted as unpublished drafts.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    IF current_setting('spot_seek.content_status_rpc', true) IS DISTINCT FROM 'on'
      OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Level publish state can only be changed through an authorized RPC.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER levels_restrict_initial_publish
  BEFORE INSERT ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_level_publish_state();
CREATE TRIGGER levels_guard_publish_state_update
  BEFORE UPDATE OF status, published_at ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_level_publish_state();

CREATE FUNCTION public.guard_published_level_spot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_level_ids uuid[] := ARRAY[]::uuid[];
  v_parent record;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_level_ids := pg_catalog.array_append(v_level_ids, OLD.level_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_level_ids := pg_catalog.array_append(v_level_ids, NEW.level_id);
  END IF;

  FOR v_parent IN
    SELECT level.id, level.status
    FROM public.levels AS level
    WHERE level.id = ANY (v_level_ids)
    ORDER BY level.id
    FOR SHARE
  LOOP
    IF v_parent.status = 'published' THEN
      RAISE EXCEPTION 'Level spots cannot be inserted, updated, or deleted while a level is published.'
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER level_spots_freeze_published_level
  BEFORE INSERT OR UPDATE OR DELETE ON public.level_spots
  FOR EACH ROW EXECUTE FUNCTION public.guard_published_level_spot_mutation();

REVOKE ALL ON FUNCTION public.guard_game_run_level_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_immutable_backend_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_level_runtime_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_level_publish_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_published_level_spot_mutation() FROM PUBLIC, anon, authenticated;

-- RLS policies from 20261008000000_game_content_foundation.sql remain authoritative.
-- The migration previously revoked table privileges without granting the frontend's needed access.
REVOKE ALL ON TABLE public.games FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.levels FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.level_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.level_spots FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (status, published_at, level_key)
  ON TABLE public.levels FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.games TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.levels TO authenticated;
GRANT UPDATE (
  game_id, difficulty, title, subtitle, description, sort_order,
  max_duration_seconds, max_hints, updated_at
) ON TABLE public.levels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.level_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.level_spots TO authenticated;

CREATE FUNCTION public.publish_level_with_runtime_rules(p_level_id uuid)
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

  SELECT level.*
  INTO v_level
  FROM public.levels AS level
  WHERE level.id = p_level_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Level not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT game.status
  INTO v_game_status
  FROM public.games AS game
  WHERE game.id = v_level.game_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent game not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_level.status = 'archived' OR v_game_status = 'archived' THEN
    RAISE EXCEPTION 'Archived levels or parent games cannot be published.' USING ERRCODE = '55000';
  END IF;
  -- TODO: enforce the approved primary-original artwork requirement here if product policy changes.
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('spot_seek.level_key:' || lower(v_level.level_key), 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.levels AS other_level
    WHERE other_level.id <> v_level.id
      AND lower(other_level.level_key) = lower(v_level.level_key)
  ) THEN
    RAISE EXCEPTION 'Level key is already in use.' USING ERRCODE = '23505';
  END IF;

  SELECT registry.level_key
  INTO v_registered_key
  FROM public.game_run_level_key_registry AS registry
  WHERE lower(registry.level_key) = lower(v_level.level_key)
    AND registry.content_level_id <> v_level.id;
  IF FOUND THEN
    RAISE EXCEPTION 'Level key is already permanently registered.' USING ERRCODE = '23505';
  END IF;

  SELECT registry.level_key
  INTO v_registered_key
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
  )
  INTO v_active_spots
  FROM public.level_spots AS spot
  WHERE spot.level_id = v_level.id AND spot.is_active;

  -- If several immutable policies are approved, use the most recently approved version.
  -- Product ownership should confirm this ordering before production approval workflows begin.
  SELECT policy.*
  INTO v_policy
  FROM public.game_run_score_policy_versions AS policy
  INNER JOIN public.game_run_score_policy_approvals AS approval
    ON approval.policy_id = policy.id
  ORDER BY approval.approved_at DESC, policy.id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No approved game run score policy version exists.' USING ERRCODE = '55000';
  END IF;

  v_content_json := pg_catalog.jsonb_build_object(
    'snapshot_schema_version', 1,
    'level', pg_catalog.jsonb_build_object(
      'game_id', v_level.game_id,
      'level_key', v_level.level_key,
      'title', v_level.title,
      'difficulty', v_level.difficulty,
      'max_duration_seconds', v_level.max_duration_seconds,
      'max_hints', v_level.max_hints
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

  SELECT rule_version.*
  INTO v_rule_version
  FROM public.game_run_rule_versions AS rule_version
  WHERE rule_version.content_level_id = v_level.id
  ORDER BY rule_version.version DESC
  LIMIT 1;

  IF FOUND AND v_rule_version.content_hash = v_content_hash THEN
    v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
    PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
    UPDATE public.levels AS level
    SET status = 'published',
        published_at = COALESCE(level.published_at, v_now),
        updated_at = v_now
    WHERE level.id = v_level.id;
    PERFORM pg_catalog.set_config(
      'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
    );

    RETURN pg_catalog.jsonb_build_object(
      'level_id', v_level.id,
      'level_key', v_level.level_key,
      'status', 'published',
      'rule_version_id', v_rule_version.id,
      'rule_version', v_rule_version.version,
      'content_hash', v_rule_version.content_hash
    );
  END IF;

  IF NOT FOUND THEN
    v_next_version := 1;
  ELSE
    v_next_version := v_rule_version.version + 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.game_run_level_key_registry AS registry
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
    content_hash, created_by
  )
  VALUES (
    v_level.id, v_level.game_id, v_next_version, v_level.level_key, v_level.title, v_level.difficulty,
    v_level.max_duration_seconds, v_level.max_hints, v_active_spots,
    v_policy.id, v_policy.version,
    v_policy.time_weight, v_policy.wrong_click_penalty, v_policy.hint_penalty,
    v_content_hash, v_user_id
  )
  RETURNING * INTO v_rule_version;

  v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
  PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
  UPDATE public.levels AS level
  SET status = 'published',
      published_at = COALESCE(level.published_at, v_now),
      updated_at = v_now
  WHERE level.id = v_level.id;
  PERFORM pg_catalog.set_config(
    'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
  );

  RETURN pg_catalog.jsonb_build_object(
    'level_id', v_level.id,
    'level_key', v_level.level_key,
    'status', 'published',
    'rule_version_id', v_rule_version.id,
    'rule_version', v_rule_version.version,
    'content_hash', v_rule_version.content_hash
  );
END;
$$;

CREATE FUNCTION public.unpublish_level(p_level_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_level public.levels%ROWTYPE;
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
  IF v_level.status = 'archived' THEN
    RAISE EXCEPTION 'Archived levels cannot be unpublished.' USING ERRCODE = '55000';
  END IF;

  IF v_level.status = 'published' THEN
    v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
    PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
    UPDATE public.levels AS level
    SET status = 'draft', published_at = NULL, updated_at = pg_catalog.clock_timestamp()
    WHERE level.id = v_level.id;
    PERFORM pg_catalog.set_config(
      'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'level_id', v_level.id,
    'level_key', v_level.level_key,
    'status', 'draft',
    'published_at', NULL
  );
END;
$$;

CREATE FUNCTION public.archive_level(p_level_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_level public.levels%ROWTYPE;
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
    v_previous_guard_setting := current_setting('spot_seek.content_status_rpc', true);
    PERFORM pg_catalog.set_config('spot_seek.content_status_rpc', 'on', true);
    UPDATE public.levels AS level
    SET status = 'archived', published_at = NULL, updated_at = pg_catalog.clock_timestamp()
    WHERE level.id = v_level.id;
    PERFORM pg_catalog.set_config(
      'spot_seek.content_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'level_id', v_level.id,
    'level_key', v_level.level_key,
    'status', 'archived',
    'published_at', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_level_with_runtime_rules(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unpublish_level(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_level(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.publish_level_with_runtime_rules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_level(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_level(uuid) TO authenticated;