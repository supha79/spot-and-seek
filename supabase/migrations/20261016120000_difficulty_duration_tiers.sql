CREATE FUNCTION public.guard_published_level_duration_by_difficulty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_duration_matches_difficulty boolean;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.difficulty IS NOT DISTINCT FROM OLD.difficulty
    AND NEW.max_duration_seconds IS NOT DISTINCT FROM OLD.max_duration_seconds THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  v_duration_matches_difficulty := CASE NEW.difficulty
    WHEN 'easy' THEN NEW.max_duration_seconds > 90
    WHEN 'medium' THEN NEW.max_duration_seconds BETWEEN 61 AND 90
    WHEN 'hard' THEN NEW.max_duration_seconds BETWEEN 1 AND 60
    ELSE false
  END;

  IF NOT v_duration_matches_difficulty THEN
    RAISE EXCEPTION 'Level duration does not match its difficulty tier.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER levels_guard_difficulty_duration_on_insert
  BEFORE INSERT ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_published_level_duration_by_difficulty();

CREATE TRIGGER levels_guard_difficulty_duration_on_update
  BEFORE UPDATE OF status, difficulty, max_duration_seconds ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_published_level_duration_by_difficulty();

REVOKE ALL ON FUNCTION public.guard_published_level_duration_by_difficulty() FROM PUBLIC, anon, authenticated;