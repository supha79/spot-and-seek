import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildGameRunStartRequest,
  callGameLifecycleRpc,
  callLevelLifecycleRpc,
  countUnmappedSpotReferences,
  getLegacyRunLevelId,
  getGameRunReadinessNotice,
  getParentGamePublishBlockReason,
  getRemainingHints,
  getSafeLevelAssetUrl,
  getCompletedLevelIdentityKey,
  hasPublishedRuntimeFieldChanges,
  parseGameRunSnapshot,
  resolveAdminDashboardLevel,
  resolveHistoryIdentity,
} from '../../src/services/compatibilityContracts.ts';

const gameplaySource = readFileSync(new URL('../../src/pages/game/GamePlay.tsx', import.meta.url), 'utf8');

const legacySnapshot = {
  run_id: 'run-legacy',
  level_id: 'cozy-cat-corner',
  status: 'active',
  result: null,
  elapsed_active_seconds: 4.25,
  time_remaining_seconds: 115.75,
  wrong_clicks: 0,
  hints_used: 0,
  found_count: 0,
  total_spots: 3,
  score: null,
  session_id: null,
};

const dynamicSnapshot = {
  ...legacySnapshot,
  level_id: 'spring-garden',
  content_level_id: 'content-uuid',
  level_key: 'spring-garden',
  rule_version_id: 'rule-uuid',
};

test('lifecycle actions call migration RPCs with the UUID argument and validate returned data', async (t) => {
  const cases = [
    ['publish', 'publish_level_with_runtime_rules', 'published'],
    ['unpublish', 'unpublish_level', 'draft'],
    ['archive', 'archive_level', 'archived'],
  ];

  for (const [action, rpcName, status] of cases) {
    await t.test(action, async () => {
      let call;
      const client = {
        async rpc(name, args) {
          call = { name, args };
          return {
            error: null,
            data: action === 'publish'
              ? {
                  level_id: 'level-uuid',
                  level_key: 'spring-garden',
                  status,
                  rule_version_id: 'rule-uuid',
                  rule_version: 1,
                  content_hash: 'a'.repeat(64),
                }
              : { level_id: 'level-uuid', level_key: 'spring-garden', status, published_at: null },
          };
        },
      };

      const response = await callLevelLifecycleRpc(client, action, 'level-uuid');
      assert.deepEqual(call, { name: rpcName, args: { p_level_id: 'level-uuid' } });
      assert.equal(response.status, status);
    });
  }
});

test('lifecycle errors explain active spot, invalid slug, and missing policy failures', async (t) => {
  const errors = [
    ['A level needs at least one active spot.', /at least one active spot/i],
    ['Level key must be a lowercase slug.', /level key must use lowercase/i],
    ['No approved game run score policy version exists.', /no approved Dynamic score policy.*Legacy policy approval does not approve Dynamic/i],
    ['Dynamic score policy approval required.', /no approved Dynamic score policy/i],
  ];

  for (const [serverMessage, expectedMessage] of errors) {
    await t.test(serverMessage, async () => {
      const client = { async rpc() { return { data: null, error: { message: serverMessage } }; } };
      await assert.rejects(callLevelLifecycleRpc(client, 'publish', 'level-uuid'), expectedMessage);
    });
  }
});

test('lifecycle response must match the requested level and publish contract', async () => {
  const client = {
    async rpc() {
      return { data: { level_id: 'different-level', status: 'published' }, error: null };
    },
  };
  await assert.rejects(callLevelLifecycleRpc(client, 'publish', 'level-uuid'), /incomplete level lifecycle response/i);
});

test('lifecycle RPC status mismatch is not reported as success', async () => {
  const client = {
    async rpc() {
      return { data: { level_id: 'level-uuid', level_key: 'spring-garden', status: 'draft' }, error: null };
    },
  };
  await assert.rejects(callLevelLifecycleRpc(client, 'publish', 'level-uuid'), /incomplete level lifecycle response/i);
});

test('Game lifecycle actions call the matching RPC and validate identity, state, and timestamp', async (t) => {
  const cases = [
    ['publish', 'publish_game', 'published', '2026-10-09T13:00:00.000Z'],
    ['unpublish', 'unpublish_game', 'draft', null],
    ['archive', 'archive_game', 'archived', null],
  ];

  for (const [action, rpcName, status, publishedAt] of cases) {
    await t.test(action, async () => {
      let call;
      const client = {
        async rpc(name, args) {
          call = { name, args };
          return { error: null, data: { game_id: 'game-uuid', status, published_at: publishedAt } };
        },
      };

      const response = await callGameLifecycleRpc(client, action, 'game-uuid');
      assert.deepEqual(call, { name: rpcName, args: { p_game_id: 'game-uuid' } });
      assert.deepEqual(response, { game_id: 'game-uuid', status, published_at: publishedAt });
    });
  }
});

test('Game lifecycle response mismatches are never reported as success', async () => {
  const client = {
    async rpc() {
      return { error: null, data: { game_id: 'another-game', status: 'published', published_at: null } };
    },
  };
  await assert.rejects(callGameLifecycleRpc(client, 'publish', 'game-uuid'), /incomplete game lifecycle response/i);
});

test('run parser preserves Legacy identity without converting it to Dynamic identity', () => {
  const result = parseGameRunSnapshot(legacySnapshot);
  assert.deepEqual(result.identity, {
    legacyLevelId: 'cozy-cat-corner',
    contentLevelId: null,
    levelKey: null,
    ruleVersionId: null,
  });
});

test('run parser requires the complete Dynamic identity tuple', () => {
  const result = parseGameRunSnapshot(dynamicSnapshot);
  assert.deepEqual(result.identity, {
    legacyLevelId: null,
    contentLevelId: 'content-uuid',
    levelKey: 'spring-garden',
    ruleVersionId: 'rule-uuid',
  });
  assert.throws(() => parseGameRunSnapshot({ ...dynamicSnapshot, rule_version_id: null }), /invalid game run response/i);
  assert.throws(() => parseGameRunSnapshot({ ...dynamicSnapshot, level_id: 'other-key' }), /invalid game run response/i);
  const dynamicWithoutLevelId = Object.fromEntries(Object.entries(dynamicSnapshot).filter(([key]) => key !== 'level_id'));
  assert.throws(() => parseGameRunSnapshot(dynamicWithoutLevelId), /invalid game run response/i);
});

test('run parser rejects missing or invalid counters, scores, results, and identity', async (t) => {
  const invalidSnapshots = [
    ['missing counter', ({ wrong_clicks, ...snapshot }) => snapshot],
    ['negative counter', (snapshot) => ({ ...snapshot, wrong_clicks: -1 })],
    ['fractional count', (snapshot) => ({ ...snapshot, found_count: 0.5 })],
    ['found exceeds total', (snapshot) => ({ ...snapshot, found_count: 4 })],
    ['negative score', (snapshot) => ({ ...snapshot, status: 'won', result: 'win', score: -1, session_id: 'session' })],
    ['invalid result', (snapshot) => ({ ...snapshot, result: 'cleared' })],
    ['missing legacy identity', ({ level_id, ...snapshot }) => snapshot],
  ];

  for (const [label, mutate] of invalidSnapshots) {
    await t.test(label, () => {
      assert.throws(() => parseGameRunSnapshot(mutate(legacySnapshot)), /invalid game run response/i);
    });
  }
});

test('run parser enforces terminal result and persisted session data', () => {
  assert.throws(
    () => parseGameRunSnapshot({ ...legacySnapshot, status: 'won', result: 'win' }),
    /invalid game run response/i,
  );
  assert.throws(
    () => parseGameRunSnapshot({ ...legacySnapshot, status: 'active', score: 10 }),
    /invalid game run response/i,
  );
});

test('Profile completed-stage keys retain Legacy identity and deduplicate Dynamic content identity', () => {
  assert.equal(getCompletedLevelIdentityKey({ level_id: 'cozy-cat-corner' }), 'legacy:cozy-cat-corner');
  assert.equal(getCompletedLevelIdentityKey({ level_id: null, content_level_id: 'content-uuid', rule_version_id: 'rule-1' }), 'content:content-uuid');
  assert.equal(getCompletedLevelIdentityKey({ level_id: null, content_level_id: 'content-uuid', rule_version_id: null }), null);
});

test('History exposes incomplete Legacy/Dynamic identities without inferring another identity', () => {
  const legacy = resolveHistoryIdentity({ level_id: 'sunny-picnic' });
  assert.equal(legacy.isComplete, true);
  assert.equal(legacy.identity.legacyLevelId, 'sunny-picnic');
  assert.equal(legacy.identity.contentLevelId, null);

  const incompleteDynamic = resolveHistoryIdentity({
    level_id: null,
    content_level_id: 'content-uuid',
    level_key: 'spring-garden',
    rule_version_id: null,
  });
  assert.equal(incompleteDynamic.isComplete, false);
  assert.equal(incompleteDynamic.identity.legacyLevelId, null);
  assert.equal(incompleteDynamic.identity.contentLevelId, 'content-uuid');
});

test('Published Level runtime guard allows description-only edits but detects runtime changes', () => {
  const current = {
    game_id: 'game-uuid',
    difficulty: 'easy',
    title: 'Garden',
    max_duration_seconds: 120,
    max_hints: 3,
  };
  assert.equal(hasPublishedRuntimeFieldChanges(current, current), false);
  assert.equal(hasPublishedRuntimeFieldChanges(current, { ...current, title: 'New title' }), true);
});

test('gameplay remaining hints follow the published limit and never become negative', () => {
  assert.equal(getRemainingHints(1, 0), 1);
  assert.equal(getRemainingHints(1, 1), 0);
  assert.equal(getRemainingHints(1, 3), 0);
  assert.equal(getRemainingHints(-1, 0), 0);
});

test('Admin orphan mapping counts missing and unknown level references', () => {
  assert.equal(countUnmappedSpotReferences(['level-a'], [
    { level_id: 'level-a' },
    { level_id: null },
    { level_id: 'deleted-level' },
  ]), 2);
});

test('Admin dashboard resolves Dynamic details only from a matching content ID and level key', () => {
  const levels = [{ id: 'content-uuid', level_key: 'spring-garden', title: 'Spring Garden', difficulty: 'easy' }];
  const legacy = new Map([['cozy-cat-corner', { title: 'Cozy Cat Corner', difficulty: 'easy' }]]);
  const matched = resolveAdminDashboardLevel({
    level_id: 'spring-garden',
    content_level_id: 'content-uuid',
    level_key: 'spring-garden',
    rule_version_id: 'rule-uuid',
  }, levels, legacy);
  assert.equal(matched.title, 'Spring Garden');
  assert.equal(matched.difficulty, 'easy');

  const mismatched = resolveAdminDashboardLevel({
    level_id: 'spring-garden',
    content_level_id: 'content-uuid',
    level_key: 'different-key',
    rule_version_id: 'rule-uuid',
  }, levels, legacy);
  assert.equal(mismatched.difficulty, null);
  assert.match(mismatched.reference, /different-key/);
});

test('run start accepts exactly tagged Legacy or Dynamic identities', () => {
  assert.equal(getLegacyRunLevelId({ legacyLevelId: 'cozy-cat-corner' }), 'cozy-cat-corner');
  assert.equal(getLegacyRunLevelId({ legacyLevelId: 'cozy-cat-corner', levelKey: 'cozy-cat-corner' }), null);
  assert.equal(getLegacyRunLevelId({ contentLevelId: 'content-uuid', levelKey: 'spring-garden' }), null);
  assert.equal(getLegacyRunLevelId({ legacyLevelId: null, levelKey: 'spring-garden' }), null);
  assert.equal(getGameRunReadinessNotice({ contentLevelId: 'content-uuid', levelKey: 'spring-garden' }, 'enabled'), null);
  assert.match(getGameRunReadinessNotice({ contentLevelId: 'content-uuid', levelKey: 'spring-garden' }), /availability could not be verified/i);
  assert.match(getGameRunReadinessNotice({ contentLevelId: 'content-uuid', levelKey: 'spring-garden' }, 'disabled'), /disabled by the server/i);
  assert.match(getGameRunReadinessNotice({ contentLevelId: 'content-uuid', levelKey: 'spring-garden' }, 'unknown'), /availability could not be verified/i);
  assert.equal(getGameRunReadinessNotice({ legacyLevelId: 'cozy-cat-corner' }, 'disabled'), null);
  assert.match(getGameRunReadinessNotice({ contentLevelId: 'content-uuid', levelKey: null }), /incomplete or ambiguous Dynamic identity/);
});

test('published artwork URLs must be absolute HTTP(S) URLs without credentials', () => {
  assert.equal(getSafeLevelAssetUrl(' https://cdn.example.test/level.png '), 'https://cdn.example.test/level.png');
  assert.equal(getSafeLevelAssetUrl('http://localhost:54321/storage/level.png'), 'http://localhost:54321/storage/level.png');
  assert.equal(getSafeLevelAssetUrl(null), null);
  assert.equal(getSafeLevelAssetUrl('/storage/level.png'), null);
  assert.equal(getSafeLevelAssetUrl('javascript:alert(1)'), null);
  assert.equal(getSafeLevelAssetUrl('https://user:pass@example.test/image.png'), null);
});

test('Gameplay validates identity, submits the shared Legacy/Dynamic request, and renders errors without a pending retry', () => {
  assert.match(gameplaySource, /const readinessNotice = getGameRunReadinessNotice\(level\.identity, dynamicGameplayGateState\);/);
  assert.match(gameplaySource, /submitRequest\('Start game', \(requestId\) => startGameRun\(level\.identity, requestId, assetPair\.rule_version_id\)\);/);
  assert.doesNotMatch(gameplaySource, /getLegacyRunLevelId\(level\.identity\)/);
  assert.match(gameplaySource, /\{operationError && state\.status === 'playing' \? \(/);
  assert.match(gameplaySource, /<p className="font-semibold">Unable to start game<\/p>/);
  assert.match(gameplaySource, /\{pendingOperation \? \(/);
});

test('start RPC routes Legacy IDs and Dynamic keys without mixing identities', () => {
  assert.deepEqual(
    buildGameRunStartRequest({ legacyLevelId: 'cozy-cat-corner', contentLevelId: null, levelKey: null, ruleVersionId: null }, 'request-uuid'),
    { rpcName: 'start_game_run', args: { p_level_id: 'cozy-cat-corner', p_request_id: 'request-uuid' } },
  );
  assert.deepEqual(
    buildGameRunStartRequest(
      { legacyLevelId: null, contentLevelId: 'content-uuid', levelKey: 'spring-garden', ruleVersionId: null },
      'request-uuid',
      '55555555-5555-4555-8555-555555555555',
    ),
    {
      rpcName: 'start_game_run_for_rule_version',
      args: {
        p_level_key: 'spring-garden',
        p_expected_rule_version_id: '55555555-5555-4555-8555-555555555555',
        p_request_id: 'request-uuid',
      },
    },
  );
  assert.throws(
    () => buildGameRunStartRequest(
      { legacyLevelId: null, contentLevelId: 'content-uuid', levelKey: 'spring-garden', ruleVersionId: null },
      'request-uuid',
    ),
    /published rule version is required/i,
  );
  assert.throws(
    () => buildGameRunStartRequest({ legacyLevelId: 'cozy-cat-corner', contentLevelId: 'content-uuid', levelKey: 'spring-garden', ruleVersionId: null }, 'request-uuid'),
    /complete, unambiguous/,
  );
  assert.throws(
    () => buildGameRunStartRequest({ legacyLevelId: null, contentLevelId: 'content-uuid', levelKey: 'cozy-cat-corner', ruleVersionId: null }, 'request-uuid'),
    /complete, unambiguous/,
  );
});

test('level publish requires a verified Published parent game and never auto-publishes it', () => {
  assert.equal(getParentGamePublishBlockReason('published'), null);
  assert.match(getParentGamePublishBlockReason('draft'), /Publish the parent game before publishing this level/);
  assert.match(getParentGamePublishBlockReason('archived'), /parent game is archived/);
  assert.match(getParentGamePublishBlockReason(null), /status could not be verified/);
});
