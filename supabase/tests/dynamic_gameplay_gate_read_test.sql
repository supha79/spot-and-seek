-- Source-only regression test for the gate-read RPC. Do not run against production.
BEGIN;

SELECT no_plan();

SELECT set_config(
  'spot_seek_test.gate_before',
  (SELECT gate.is_enabled::text
   FROM public.game_run_feature_gates AS gate
   WHERE gate.gate_name = 'dynamic_gameplay'),
  true
);
SELECT set_config(
  'spot_seek_test.user_id',
  pg_catalog.gen_random_uuid()::text,
  true
);
SELECT set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', current_setting('spot_seek_test.user_id'),
    'role', 'authenticated'
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('spot_seek_test.user_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_dynamic_gameplay_gate_status()', 'EXECUTE'),
  'authenticated can execute the gate-read RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_dynamic_gameplay_gate_status()', 'EXECUTE'),
  'anon cannot execute the gate-read RPC'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.game_run_feature_gates', 'SELECT'),
  'authenticated cannot select the gate table directly'
);

SET LOCAL ROLE authenticated;
SELECT is(
  public.get_dynamic_gameplay_gate_status() ->> 'gate_name',
  'dynamic_gameplay',
  'authenticated receives the dynamic gameplay gate status'
);
SELECT is(
  public.get_dynamic_gameplay_gate_status() ->> 'is_enabled',
  current_setting('spot_seek_test.gate_before'),
  'the RPC returns the stored boolean without coercion'
);
RESET ROLE;

SELECT is(
  (SELECT gate.is_enabled::text
   FROM public.game_run_feature_gates AS gate
   WHERE gate.gate_name = 'dynamic_gameplay'),
  current_setting('spot_seek_test.gate_before'),
  'reading the gate does not change its row'
);

DELETE FROM public.game_run_feature_gates WHERE gate_name = 'dynamic_gameplay';
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  'SELECT public.get_dynamic_gameplay_gate_status()',
  'P0002',
  'Dynamic gameplay gate status is missing or invalid.',
  'a missing gate row raises an error instead of returning disabled'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;