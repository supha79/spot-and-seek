-- Ensure a dynamic session's level key belongs to its content identity.
-- Legacy sessions have NULL values in both new columns and remain valid.

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_content_level_key_fk
    FOREIGN KEY (content_level_id, level_key)
    REFERENCES public.game_run_level_key_registry (content_level_id, level_key)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE public.game_sessions
  VALIDATE CONSTRAINT game_sessions_content_level_key_fk;