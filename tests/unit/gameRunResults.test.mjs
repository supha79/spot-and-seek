import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGameRunResult, readGameRunResult } from '../../src/services/gameRunResults.ts';

const runId = 'a2d5b83e-b6c8-4de1-88c1-e5919a24d39a';
const dynamicResult = {
  run_id: runId,
  status: 'won',
  result: 'win',
  score: 940,
  session_id: 'd827967b-4cc2-44eb-9073-ec1ff166dca5',
  played_at: '2026-10-11T10:02:03.000Z',
  started_at: '2026-10-11T10:00:00.000Z',
  completed_at: '2026-10-11T10:02:00.000Z',
  ended_at: '2026-10-11T10:02:03.000Z',
  elapsed_active_seconds: 120,
  wrong_clicks: 1,
  hints_used: 0,
  found_count: 3,
  total_spots: 3,
  level: {
    id: 'spring-garden',
    content_level_id: '85ac4f0c-8bdd-4246-b0f4-f1ecbd3bf619',
    level_key: 'spring-garden',
    rule_version_id: '1973c86f-3955-44f9-8313-6f6274e8da8b',
    title: 'Spring Garden',
    difficulty: 'easy',
    max_duration_seconds: 120,
  },
};

test('parses persisted dynamic result fields and pinned level metadata', () => {
  const result = parseGameRunResult(dynamicResult, runId);
  assert.equal(result.score, 940);
  assert.equal(result.result, 'win');
  assert.equal(result.level.title, 'Spring Garden');
  assert.equal(result.level.rule_version_id, dynamicResult.level.rule_version_id);
});

test('parses legacy results without inferring pinned metadata', () => {
  const legacy = {
    ...dynamicResult,
    level: {
      id: 'cozy-cat-corner',
      content_level_id: null,
      level_key: null,
      rule_version_id: null,
      title: null,
      difficulty: null,
      max_duration_seconds: 120,
    },
  };
  const result = parseGameRunResult(legacy, runId);
  assert.equal(result.level.id, 'cozy-cat-corner');
  assert.equal(result.level.title, null);
  assert.equal(result.level.difficulty, null);
});

test('rejects in-progress, mismatched, and malformed results', () => {
  assert.throws(() => parseGameRunResult({ ...dynamicResult, status: 'active', result: null }, runId), /unavailable or invalid/);
  assert.throws(() => parseGameRunResult({ ...dynamicResult, run_id: 'another-id' }, runId), /unavailable or invalid/);
  assert.throws(() => parseGameRunResult({ ...dynamicResult, score: '940' }, runId), /unavailable or invalid/);
  assert.throws(() => parseGameRunResult({ ...dynamicResult, found_count: 4 }, runId), /unavailable or invalid/);
  assert.throws(() => parseGameRunResult({ ...dynamicResult, result: 'loss' }, runId), /unavailable or invalid/);
  assert.throws(() => parseGameRunResult({ ...dynamicResult, session_id: 'not-a-uuid' }, runId), /unavailable or invalid/);
  assert.throws(() => parseGameRunResult({ ...dynamicResult, level: { ...dynamicResult.level, rule_version_id: 'not-a-uuid' } }, runId), /unavailable or invalid/);
});

test('requests only the result-read RPC and maps RPC errors to unavailable', async () => {
  const calls = [];
  const result = await readGameRunResult({
    rpc: async (...args) => {
      calls.push(args);
      return { data: dynamicResult, error: null };
    },
  }, runId);

  assert.equal(result.run_id, runId);
  assert.deepEqual(calls, [['get_game_run_result', { p_run_id: runId }]]);
  await assert.rejects(
    readGameRunResult({ rpc: async () => ({ data: null, error: { message: 'permission denied' } }) }, runId),
    /unavailable or invalid/,
  );
});

test('maps rejected, timed-out, and malformed UUID requests to unavailable', async () => {
  await assert.rejects(readGameRunResult({ rpc: async () => { throw new Error('network failure'); } }, runId), /unavailable or invalid/);
  await assert.rejects(readGameRunResult({ rpc: () => new Promise(() => {}) }, runId, 1), /unavailable or invalid/);
  await assert.rejects(readGameRunResult({ rpc: async () => ({ data: dynamicResult, error: null }) }, 'bad-id'), /unavailable or invalid/);
});