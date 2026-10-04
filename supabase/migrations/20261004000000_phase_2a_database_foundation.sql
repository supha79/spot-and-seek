DO $$
DECLARE
  invalid_username_count bigint;
  duplicate_usernames text;
BEGIN
  SELECT count(*)
  INTO invalid_username_count
  FROM auth.users AS auth_user
  WHERE jsonb_typeof(auth_user.raw_user_meta_data -> 'username') IS DISTINCT FROM 'string'
    OR COALESCE(auth_user.raw_user_meta_data ->> 'username', '') !~ '^[A-Za-z0-9_]{3,20}$';

  IF invalid_username_count > 0 THEN
    RAISE EXCEPTION 'Phase 2A stopped: % existing account(s) have a missing or invalid username.', invalid_username_count
      USING HINT = 'Set a valid 3-20 character ASCII username through a trusted admin process, then rerun this migration.';
  END IF;

  WITH username_candidates AS (
    SELECT lower(auth_user.raw_user_meta_data ->> 'username') AS normalized_username
    FROM auth.users AS auth_user
  )
  SELECT string_agg(conflict.normalized_username, ', ' ORDER BY conflict.normalized_username)
  INTO duplicate_usernames
  FROM (
    SELECT username_candidates.normalized_username
    FROM username_candidates
    GROUP BY username_candidates.normalized_username
    HAVING count(*) > 1
  ) AS conflict;

  IF duplicate_usernames IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 2A stopped: existing usernames collide case-insensitively.'
      USING DETAIL = duplicate_usernames,
        HINT = 'Rename colliding accounts to unique 3-20 character ASCII usernames through a trusted admin process, then rerun this migration.';
  END IF;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  username_normalized text GENERATED ALWAYS AS (lower(username)) STORED,
  avatar_url text,
  selected_buddy text NOT NULL DEFAULT 'Bunny',
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  total_wins integer NOT NULL DEFAULT 0 CHECK (total_wins >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_normalized_key UNIQUE (username_normalized),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  CONSTRAINT profiles_avatar_url_length CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048),
  CONSTRAINT profiles_selected_buddy_valid CHECK (
    selected_buddy IN ('Bunny', 'Cat', 'Bear', 'Fox', 'Panda', 'Penguin', 'Frog', 'Duck')
  )
);

CREATE FUNCTION public.sync_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_username text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF jsonb_typeof(OLD.raw_user_meta_data -> 'username') = 'string'
      AND (OLD.raw_user_meta_data ->> 'username') ~ '^[A-Za-z0-9_]{3,20}$'
      AND (OLD.raw_user_meta_data -> 'username')
        IS NOT DISTINCT FROM (NEW.raw_user_meta_data -> 'username') THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT COALESCE(NEW.raw_user_meta_data ? 'username', false) THEN
    RAISE EXCEPTION 'Username metadata is required for every account.';
  END IF;

  profile_username := NEW.raw_user_meta_data ->> 'username';
  IF jsonb_typeof(NEW.raw_user_meta_data -> 'username') IS DISTINCT FROM 'string'
    OR profile_username IS NULL
    OR profile_username !~ '^[A-Za-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'Username must contain 3-20 ASCII letters, digits, or underscores.';
  END IF;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, profile_username)
  ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_profile();

CREATE TRIGGER on_auth_user_username_updated_profile
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_profile();

REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC, anon, authenticated;

INSERT INTO public.profiles (id, username)
SELECT
  auth_user.id,
  auth_user.raw_user_meta_data ->> 'username'
FROM auth.users AS auth_user
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION public.set_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();

REVOKE ALL ON FUNCTION public.set_profile_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, username, avatar_url, selected_buddy, best_score, total_wins, created_at, updated_at)
  ON TABLE public.profiles TO authenticated;
GRANT UPDATE (avatar_url, selected_buddy) ON TABLE public.profiles TO authenticated;

CREATE POLICY profiles_select_self_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  level_id text NOT NULL CHECK (char_length(btrim(level_id)) BETWEEN 1 AND 100),
  score integer NOT NULL CHECK (score >= 0),
  result text NOT NULL CHECK (result IN ('win', 'loss')),
  played_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT game_sessions_user_idempotency_key UNIQUE (user_id, idempotency_key)
);

CREATE INDEX game_sessions_user_played_at_idx
  ON public.game_sessions (user_id, played_at DESC);

CREATE INDEX game_sessions_level_played_at_idx
  ON public.game_sessions (level_id, played_at DESC);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.game_sessions TO authenticated;

CREATE POLICY game_sessions_select_self_or_admin
  ON public.game_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );
