CREATE OR REPLACE FUNCTION public.resume_game_run(p_run_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_run public.game_runs%ROWTYPE;
  v_existing public.game_run_events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_run
  FROM public.game_runs AS game_run
  WHERE game_run.id = p_run_id AND game_run.user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game run not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing
  FROM public.game_run_events AS event
  WHERE event.run_id = p_run_id AND event.event_request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.event_type <> 'resumed' THEN
      RAISE EXCEPTION 'Request ID was already used for a different event.'
        USING ERRCODE = '22023';
    END IF;
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.timeout_request_id = p_request_id THEN
    RAISE EXCEPTION 'Request ID was already used for a different timeout-triggering request.'
      USING ERRCODE = '22023';
  END IF;
  IF v_run.status IN ('completed', 'won', 'lost', 'abandoned') THEN
    RETURN public._game_run_response(p_run_id);
  END IF;
  IF v_run.status <> 'paused' THEN
    RAISE EXCEPTION 'Only a paused game run can be resumed.' USING ERRCODE = '55000';
  END IF;

  UPDATE public.game_runs AS game_run
  SET status = 'active',
      resumed_at = v_now,
      last_event_number = game_run.last_event_number + 1,
      updated_at = v_now
  WHERE game_run.id = p_run_id
  RETURNING * INTO v_run;

  INSERT INTO public.game_run_events (
    run_id, event_request_id, event_number, event_type, accepted_at
  )
  VALUES (p_run_id, p_request_id, v_run.last_event_number, 'resumed', v_now);

  RETURN public._game_run_response(p_run_id);
END;
$$;