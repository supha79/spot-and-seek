import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callApproveScorePolicyRpc,
  callCreateScorePolicyRpc,
} from '../../src/services/scorePolicyContracts.ts';

test('score policy creation uses the RPC and requires an unapproved response by the actor', async () => {
  let call;
  const client = {
    async rpc(name, args) {
      call = { name, args };
      return {
        error: null,
        data: {
          policy_id: 'policy-id',
          version: 'policy-v2',
          time_weight: 100,
          wrong_click_penalty: 5,
          hint_penalty: 10,
          created_at: '2026-10-09T13:00:00Z',
          created_by: 'creator-id',
          is_approved: false,
        },
      };
    },
  };
  const response = await callCreateScorePolicyRpc(client, 'creator-id', {
    version: ' policy-v2 ',
    timeWeight: 100,
    wrongClickPenalty: 5,
    hintPenalty: 10,
  });

  assert.deepEqual(call, {
    name: 'create_game_run_score_policy_version',
    args: {
      p_version: 'policy-v2',
      p_time_weight: 100,
      p_wrong_click_penalty: 5,
      p_hint_penalty: 10,
    },
  });
  assert.equal(response.created_by, 'creator-id');
});

test('score policy approval delegates sole-admin eligibility to the server and validates audit fields', async () => {
  let call;
  let approvedBy = 'creator-id';
  const client = {
    async rpc(name, args) {
      call = { name, args };
      return {
        error: null,
        data: {
          policy_id: 'policy-id',
          created_by: 'creator-id',
          approved_by: approvedBy,
          approved_at: '2026-10-09T13:01:00Z',
          approval_note: 'Reviewed',
          is_approved: true,
        },
      };
    },
  };

  const selfApproval = await callApproveScorePolicyRpc(client, 'creator-id', 'policy-id', 'creator-id', ' Reviewed ');
  assert.deepEqual(call, {
    name: 'approve_game_run_score_policy',
    args: { p_policy_id: 'policy-id', p_approval_note: 'Reviewed' },
  });
  assert.equal(selfApproval.approved_by, 'creator-id');

  approvedBy = 'reviewer-id';
  const response = await callApproveScorePolicyRpc(client, 'reviewer-id', 'policy-id', 'creator-id', ' Reviewed ');
  assert.deepEqual(call, {
    name: 'approve_game_run_score_policy',
    args: { p_policy_id: 'policy-id', p_approval_note: 'Reviewed' },
  });
  assert.equal(response.approved_by, 'reviewer-id');
});

test('score policy adapters fail closed on malformed creation or approval payloads', async () => {
  const client = { async rpc() { return { error: null, data: {} }; } };
  await assert.rejects(
    callCreateScorePolicyRpc(client, 'creator-id', {
      version: 'v1', timeWeight: 1, wrongClickPenalty: 1, hintPenalty: 1,
    }),
    /incomplete or mismatched score policy creation response/,
  );
  await assert.rejects(
    callApproveScorePolicyRpc(client, 'reviewer-id', 'policy-id', 'creator-id', 'Reviewed'),
    /incomplete or mismatched score policy approval response/,
  );
});