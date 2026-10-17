import { supabase, supabaseConfigError } from '../supabaseClient';
import { callApproveScorePolicyRpc, callCreateScorePolicyRpc, type ScorePolicyDraft } from './scorePolicyContracts';

export type { ScorePolicyDraft } from './scorePolicyContracts';

export type ScorePolicyAuditRow = ScorePolicyDraft & {
  id: string;
  createdAt: string;
  createdBy: string;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalNote: string | null;
};

async function getActorId() {
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? 'Sign in to manage score policies.');
  return data.user.id;
}

function getClient() {
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return supabase;
}

export async function loadScorePolicyAudit() {
  const client = getClient();
  const actorId = await getActorId();
  const [{ data: policyRows, error: policyError }, { data: approvalRows, error: approvalError }] = await Promise.all([
    client.from('game_run_score_policy_versions')
      .select('id, version, time_weight, wrong_click_penalty, hint_penalty, created_at, created_by')
      .order('created_at', { ascending: false }),
    client.from('game_run_score_policy_approvals')
      .select('policy_id, approved_at, approved_by, approval_note'),
  ]);

  if (policyError) throw new Error(`Could not load score policy versions: ${policyError.message}`);
  if (approvalError) throw new Error(`Could not load score policy audit: ${approvalError.message}`);

  const approvalsById = new Map((approvalRows ?? []).map((approval) => [approval.policy_id, approval]));
  const policies = (policyRows ?? []).map((policy) => {
    const approval = approvalsById.get(policy.id);
    return {
      id: policy.id,
      version: policy.version,
      timeWeight: policy.time_weight,
      wrongClickPenalty: policy.wrong_click_penalty,
      hintPenalty: policy.hint_penalty,
      createdAt: policy.created_at,
      createdBy: policy.created_by,
      approvedAt: approval?.approved_at ?? null,
      approvedBy: approval?.approved_by ?? null,
      approvalNote: approval?.approval_note ?? null,
    } satisfies ScorePolicyAuditRow;
  });

  return { actorId, policies };
}

export async function createScorePolicyVersion(draft: ScorePolicyDraft) {
  const client = getClient();
  const actorId = await getActorId();
  return callCreateScorePolicyRpc({ rpc: (name, args) => client.rpc(name, args) }, actorId, draft);
}

export async function approveScorePolicy(policy: ScorePolicyAuditRow, approvalNote: string) {
  const client = getClient();
  const actorId = await getActorId();
  return callApproveScorePolicyRpc(
    { rpc: (name, args) => client.rpc(name, args) },
    actorId,
    policy.id,
    policy.createdBy,
    approvalNote,
  );
}