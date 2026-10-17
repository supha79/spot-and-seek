export type ScorePolicyDraft = {
  version: string;
  timeWeight: number;
  wrongClickPenalty: number;
  hintPenalty: number;
};

type ScorePolicyRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function parseRpcObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Supabase returned an invalid score policy response.');
  }
  return value as Record<string, unknown>;
}

export async function callCreateScorePolicyRpc(
  client: ScorePolicyRpcClient,
  actorId: string,
  draft: ScorePolicyDraft,
) {
  const version = draft.version.trim();
  if (!version || ![draft.timeWeight, draft.wrongClickPenalty, draft.hintPenalty]
    .every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('Enter a version and non-negative whole-number scoring coefficients.');
  }

  const { data, error } = await client.rpc('create_game_run_score_policy_version', {
    p_version: version,
    p_time_weight: draft.timeWeight,
    p_wrong_click_penalty: draft.wrongClickPenalty,
    p_hint_penalty: draft.hintPenalty,
  });
  if (error) throw new Error(error.message);

  const response = parseRpcObject(data);
  if (
    !isNonEmptyString(response.policy_id)
    || response.version !== version
    || response.time_weight !== draft.timeWeight
    || response.wrong_click_penalty !== draft.wrongClickPenalty
    || response.hint_penalty !== draft.hintPenalty
    || response.created_by !== actorId
    || !isTimestamp(response.created_at)
    || response.is_approved !== false
  ) {
    throw new Error('Supabase returned an incomplete or mismatched score policy creation response.');
  }

  return response;
}

export async function callApproveScorePolicyRpc(
  client: ScorePolicyRpcClient,
  actorId: string,
  policyId: string,
  createdBy: string,
  approvalNote: string,
) {
  const note = approvalNote.trim();
  if (!note) throw new Error('An approval note is required for the audit record.');

  const { data, error } = await client.rpc('approve_game_run_score_policy', {
    p_policy_id: policyId,
    p_approval_note: note,
  });
  if (error) throw new Error(error.message);

  const response = parseRpcObject(data);
  if (
    response.policy_id !== policyId
    || response.created_by !== createdBy
    || response.approved_by !== actorId
    || response.approval_note !== note
    || !isTimestamp(response.approved_at)
    || response.is_approved !== true
  ) {
    throw new Error('Supabase returned an incomplete or mismatched score policy approval response.');
  }

  return response;
}