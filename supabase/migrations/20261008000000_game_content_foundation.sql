CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  CONSTRAINT games_name_nonempty CHECK (btrim(name) <> ''),
  CONSTRAINT games_published_state CHECK (
    (status <> 'published' AND published_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL)
  )
);

CREATE TABLE public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
  level_key text NOT NULL UNIQUE CHECK (btrim(level_key) <> ''),
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  title text NOT NULL,
  subtitle text,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  max_duration_seconds integer NOT NULL DEFAULT 120 CHECK (max_duration_seconds > 0),
  max_hints integer NOT NULL DEFAULT 3 CHECK (max_hints BETWEEN 0 AND 3),
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  CONSTRAINT levels_title_nonempty CHECK (btrim(title) <> ''),
  CONSTRAINT levels_published_state CHECK (
    (status <> 'published' AND published_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL)
  )
);

CREATE TABLE public.level_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.levels (id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('original', 'thumbnail')),
  bucket_name text NOT NULL CHECK (btrim(bucket_name) <> ''),
  storage_path text NOT NULL CHECK (btrim(storage_path) <> ''),
  public_url text,
  mime_type text NOT NULL CHECK (btrim(mime_type) <> ''),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT level_assets_unique_path UNIQUE (level_id, asset_type, storage_path)
);

CREATE TABLE public.level_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.levels (id) ON DELETE CASCADE,
  spot_key text NOT NULL CHECK (btrim(spot_key) <> ''),
  label text NOT NULL CHECK (btrim(label) <> ''),
  shape text NOT NULL CHECK (shape IN ('circle', 'rectangle')),
  x_norm numeric(6,4) NOT NULL CHECK (x_norm >= 0 AND x_norm <= 1),
  y_norm numeric(6,4) NOT NULL CHECK (y_norm >= 0 AND y_norm <= 1),
  width_norm numeric(6,4) CHECK (width_norm IS NULL OR (width_norm > 0 AND width_norm <= 1)),
  height_norm numeric(6,4) CHECK (height_norm IS NULL OR (height_norm > 0 AND height_norm <= 1)),
  radius_norm numeric(6,4) CHECK (radius_norm IS NULL OR (radius_norm > 0 AND radius_norm <= 1)),
  tolerance_norm numeric(6,4) NOT NULL DEFAULT 0.03 CHECK (tolerance_norm >= 0 AND tolerance_norm <= 0.25),
  score_value integer NOT NULL DEFAULT 100 CHECK (score_value >= 0),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT level_spots_unique_key UNIQUE (level_id, spot_key),
  CONSTRAINT level_spots_geometry_shape CHECK (
    (
      shape = 'circle'
      AND radius_norm IS NOT NULL
      AND width_norm IS NULL
      AND height_norm IS NULL
    )
    OR (
      shape = 'rectangle'
      AND radius_norm IS NULL
      AND width_norm IS NOT NULL
      AND height_norm IS NOT NULL
    )
  )
);

CREATE FUNCTION public.set_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER games_set_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_content_updated_at();

CREATE TRIGGER levels_set_updated_at
  BEFORE UPDATE ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.set_content_updated_at();

CREATE TRIGGER level_spots_set_updated_at
  BEFORE UPDATE ON public.level_spots
  FOR EACH ROW EXECUTE FUNCTION public.set_content_updated_at();

REVOKE ALL ON FUNCTION public.set_content_updated_at() FROM PUBLIC, anon, authenticated;

CREATE UNIQUE INDEX games_status_published_at_idx
  ON public.games (status, published_at);

CREATE INDEX games_created_by_idx
  ON public.games (created_by);

CREATE INDEX levels_game_status_sort_idx
  ON public.levels (game_id, status, sort_order);

CREATE INDEX levels_difficulty_status_idx
  ON public.levels (difficulty, status);

CREATE INDEX level_assets_level_primary_idx
  ON public.level_assets (level_id, is_primary);

CREATE INDEX level_assets_level_type_idx
  ON public.level_assets (level_id, asset_type);

CREATE UNIQUE INDEX level_assets_primary_idx
  ON public.level_assets (level_id)
  WHERE is_primary;

CREATE INDEX level_spots_level_sort_idx
  ON public.level_spots (level_id, sort_order);

CREATE INDEX level_spots_level_active_idx
  ON public.level_spots (level_id, is_active);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_spots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.games FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.levels FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.level_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.level_spots FROM PUBLIC, anon, authenticated;

CREATE POLICY games_select_published
  ON public.games
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

CREATE POLICY games_admin_manage
  ON public.games
  FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY games_admin_update
  ON public.games
  FOR UPDATE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY games_admin_delete
  ON public.games
  FOR DELETE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY levels_select_published
  ON public.levels
  FOR SELECT
  TO authenticated
  USING (
    (
      status = 'published'
      AND EXISTS (
        SELECT 1
        FROM public.games AS game
        WHERE game.id = levels.game_id
          AND game.status = 'published'
      )
    )
    OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

CREATE POLICY levels_admin_manage
  ON public.levels
  FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY levels_admin_update
  ON public.levels
  FOR UPDATE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY levels_admin_delete
  ON public.levels
  FOR DELETE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY level_assets_select_published
  ON public.level_assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.levels AS level
      WHERE level.id = level_assets.level_id
        AND level.status = 'published'
        AND EXISTS (
          SELECT 1
          FROM public.games AS game
          WHERE game.id = level.game_id
            AND game.status = 'published'
        )
    )
    OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

CREATE POLICY level_assets_admin_manage
  ON public.level_assets
  FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY level_assets_admin_update
  ON public.level_assets
  FOR UPDATE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY level_assets_admin_delete
  ON public.level_assets
  FOR DELETE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY level_spots_select_published
  ON public.level_spots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.levels AS level
      WHERE level.id = level_spots.level_id
        AND level.status = 'published'
        AND EXISTS (
          SELECT 1
          FROM public.games AS game
          WHERE game.id = level.game_id
            AND game.status = 'published'
        )
    )
    OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

CREATE POLICY level_spots_admin_manage
  ON public.level_spots
  FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY level_spots_admin_update
  ON public.level_spots
  FOR UPDATE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

CREATE POLICY level_spots_admin_delete
  ON public.level_spots
  FOR DELETE
  TO authenticated
  USING (COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));
