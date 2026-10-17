CREATE FUNCTION public.get_dynamic_gameplay_gate_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gate_name text;
  v_is_enabled boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT gate.gate_name, gate.is_enabled
  INTO v_gate_name, v_is_enabled
  FROM public.game_run_feature_gates AS gate
  WHERE gate.gate_name = 'dynamic_gameplay';

  IF NOT FOUND
    OR v_gate_name IS DISTINCT FROM 'dynamic_gameplay'
    OR v_is_enabled IS NULL THEN
    RAISE EXCEPTION 'Dynamic gameplay gate status is missing or invalid.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'gate_name', v_gate_name,
    'is_enabled', v_is_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dynamic_gameplay_gate_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dynamic_gameplay_gate_status() TO authenticated;