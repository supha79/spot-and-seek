import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callSetDynamicGameplayGateRpc,
  parseDynamicGameplayGateResponse,
  readDynamicGameplayGateState,
} from '../../src/services/dynamicGameplayGate.ts';

test('parses a valid enabled gate response', () => {
  assert.equal(parseDynamicGameplayGateResponse({ gate_name: 'dynamic_gameplay', is_enabled: true }), 'enabled');
});

test('parses a valid disabled gate response', () => {
  assert.equal(parseDynamicGameplayGateResponse({ gate_name: 'dynamic_gameplay', is_enabled: false }), 'disabled');
});

test('treats malformed or untrusted gate responses as unknown', () => {
  assert.equal(parseDynamicGameplayGateResponse(null), 'unknown');
  assert.equal(parseDynamicGameplayGateResponse({ gate_name: 'other_gate', is_enabled: true }), 'unknown');
  assert.equal(parseDynamicGameplayGateResponse({ gate_name: 'dynamic_gameplay', is_enabled: 'true' }), 'unknown');
  assert.equal(parseDynamicGameplayGateResponse([{ gate_name: 'dynamic_gameplay', is_enabled: true }]), 'unknown');
});

test('calls only the gate-read RPC and treats RPC errors as unknown', async () => {
  const calls = [];
  const state = await readDynamicGameplayGateState({
    rpc: async (...args) => {
      calls.push(args);
      return { data: null, error: { message: 'permission denied' } };
    },
  });

  assert.equal(state, 'unknown');
  assert.deepEqual(calls, [['get_dynamic_gameplay_gate_status', {}]]);
});

test('treats rejected requests and timed-out requests as unknown', async () => {
  assert.equal(await readDynamicGameplayGateState({ rpc: async () => { throw new Error('network unavailable'); } }), 'unknown');
  assert.equal(await readDynamicGameplayGateState({ rpc: () => new Promise(() => {}) }, 1), 'unknown');
});

test('gate changes require a note and validate the audited server response', async () => {
  const calls = [];
  const result = await callSetDynamicGameplayGateRpc({
    rpc: async (...args) => {
      calls.push(args);
      return {
        error: null,
        data: {
          gate_name: 'dynamic_gameplay',
          previous_enabled: false,
          is_enabled: true,
          audit_id: 'audit-id',
          changed_by: 'admin-id',
          changed_at: '2026-10-16T05:00:00Z',
          change_note: 'Reviewed and ready',
        },
      };
    },
  }, true, ' Reviewed and ready ');

  assert.deepEqual(calls, [[
    'set_dynamic_gameplay_gate',
    { p_is_enabled: true, p_change_note: 'Reviewed and ready' },
  ]]);
  assert.equal(result.is_enabled, true);
  await assert.rejects(
    callSetDynamicGameplayGateRpc({ rpc: async () => ({ data: null, error: null }) }, false, '   '),
    /change note is required/,
  );
});