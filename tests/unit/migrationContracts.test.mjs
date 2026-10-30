import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDirectory = join(root, 'supabase/migrations');
const migrationFiles = readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql')).sort();
const lifecycleMigration = readFileSync(
  join(migrationsDirectory, '20261009133004_lifecycle_and_score_policy_rpcs.sql'),
  'utf8',
);
const expectedRuleStartMigration = readFileSync(
  join(migrationsDirectory, '20261012092053_dynamic_start_expected_rule_version.sql'),
  'utf8',
);
const soloAdminApprovalMigration = readFileSync(
  join(migrationsDirectory, '20261016130000_solo_admin_score_policy_approval.sql'),
  'utf8',
);
const dynamicGateControlMigration = readFileSync(
  join(migrationsDirectory, '20261016140000_dynamic_gameplay_gate_control.sql'),
  'utf8',
);
const authenticatedAssetSelectMigration = readFileSync(
  join(migrationsDirectory, '20261016150000_private_asset_authenticated_select.sql'),
  'utf8',
);
const restoreArchivedLevelMigration = readFileSync(
  join(migrationsDirectory, '20261030000000_restore_unchanged_archived_level.sql'),
  'utf8',
);
const dynamicRunTest = readFileSync(
  join(root, 'supabase/tests/dynamic_run_dual_path_test.sql'),
  'utf8',
);
const gameContentMigration = readFileSync(
  join(migrationsDirectory, '20261008000000_game_content_foundation.sql'),
  'utf8',
);
const playerContentSource = readFileSync(
  join(root, 'src/services/playerContent.ts'),
  'utf8',
);

test('all migration versions are unique, ordered, and not in the future', () => {
  const versions = migrationFiles.map((name) => name.slice(0, 14));
  assert.ok(versions.every((version) => /^\d{14}$/.test(version)));
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(versions, [...versions].sort());

  const now = Date.now();
  for (const version of versions) {
    const timestamp = new Date(
      `${version.slice(0, 4)}-${version.slice(4, 6)}-${version.slice(6, 8)}T${version.slice(8, 10)}:${version.slice(10, 12)}:${version.slice(12, 14)}Z`,
    ).getTime();
    assert.ok(timestamp <= now, `migration ${version} is in the future`);
  }
});

test('new migration enforces Game/Level lifecycle in the database', () => {
  for (const functionName of ['publish_game', 'unpublish_game', 'archive_game']) {
    assert.match(lifecycleMigration, new RegExp(`FUNCTION public\\.${functionName}\\(p_game_id uuid\\)`));
    assert.match(lifecycleMigration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\(uuid\\) TO authenticated`));
  }
  assert.match(lifecycleMigration, /FOR UPDATE;[\s\S]*?published levels before changing the parent game/);
  assert.match(lifecycleMigration, /FOR SHARE;[\s\S]*?Parent game must be published before level can be published/);
  assert.match(lifecycleMigration, /REVOKE UPDATE ON TABLE public\.games/);
  assert.match(lifecycleMigration, /GRANT UPDATE \(name, description, sort_order, updated_at\)/);
});

test('score-policy creation is audited and self-approval is limited to a sole Admin', () => {
  assert.match(lifecycleMigration, /FUNCTION public\.create_game_run_score_policy_version\(/);
  assert.match(lifecycleMigration, /FUNCTION public\.approve_game_run_score_policy\(/);
  assert.match(lifecycleMigration, /An approval note is required for the audit record/);
  assert.match(lifecycleMigration, /approved_by', v_approval\.approved_by/);
  assert.match(lifecycleMigration, /CREATE POLICY game_run_score_policy_approvals_admin_select/);
  assert.match(soloAdminApprovalMigration, /CREATE OR REPLACE FUNCTION public\.approve_game_run_score_policy\(/);
  assert.match(soloAdminApprovalMigration, /LOCK TABLE auth\.users IN SHARE MODE/);
  assert.match(soloAdminApprovalMigration, /raw_app_meta_data ->> 'role' = 'admin'/);
  assert.match(soloAdminApprovalMigration, /v_admin_count <> 1 OR NOT EXISTS/);
  assert.match(soloAdminApprovalMigration, /sole administrator/);
  assert.doesNotMatch(lifecycleMigration, /^INSERT INTO public\.(game_run_score_policy_versions|game_run_score_policy_approvals|game_sessions)\b/gm);
});

test('Dynamic Start requires the artwork rule version and rolls back mismatched starts', () => {
  assert.match(expectedRuleStartMigration, /RENAME TO _start_game_run_without_version_guard/);
  assert.match(expectedRuleStartMigration, /Dynamic Start requires an expected published rule version/);
  assert.match(expectedRuleStartMigration, /FUNCTION public\.start_game_run_for_rule_version\(/);
  assert.match(expectedRuleStartMigration, /public\._start_game_run_without_version_guard\(p_level_key, p_request_id\)/);
  assert.match(expectedRuleStartMigration, /v_response ->> 'rule_version_id' IS DISTINCT FROM p_expected_rule_version_id::text/);
  assert.match(expectedRuleStartMigration, /REVOKE ALL ON FUNCTION public\._start_game_run_without_version_guard\(text, uuid\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(expectedRuleStartMigration, /GRANT EXECUTE ON FUNCTION public\.start_game_run_for_rule_version\(text, uuid, uuid\)\s+TO authenticated/);
});

test('Dynamic run pgTAP skip count covers all policy-gated assertions', () => {
  const skipMatch = dynamicRunTest.match(
    /SELECT \* FROM skip\(\s*(\d+),[\s\S]*?\)\s*WHERE NOT current_setting\('spot_seek_test\.has_approved_policy'\)::boolean;/,
  );
  assert.ok(skipMatch);

  const assertionStart = skipMatch.index + skipMatch[0].length;
  const gatedAssertionCount = [
    ...dynamicRunTest.slice(assertionStart).matchAll(
      /^SELECT\s+(?:ok|is|isnt|like|unlike|throws_ok|lives_ok|cmp_ok|pass|fail)\s*\(/gm,
    ),
  ].length;
  assert.equal(Number(skipMatch[1]), gatedAssertionCount);
});

test('published games query targets the table created by the content migration', () => {
  assert.match(gameContentMigration, /^CREATE TABLE public\.games\s*\(/m);
  assert.match(playerContentSource, /\.from\('games'\)[\s\S]*?\.eq\('status', 'published'\)/);
});

test('Dynamic gameplay gate changes are Admin-only, audited, and require ready published content', () => {
  assert.match(dynamicGateControlMigration, /FUNCTION public\.set_dynamic_gameplay_gate\(p_is_enabled boolean, p_change_note text\)/);
  assert.match(dynamicGateControlMigration, /Administrator role required/);
  assert.match(dynamicGateControlMigration, /game_run_feature_gate_audit/);
  assert.match(dynamicGateControlMigration, /changed_by, change_note/);
  assert.match(dynamicGateControlMigration, /approved runtime rule and complete asset pair/);
  assert.match(dynamicGateControlMigration, /REVOKE ALL ON FUNCTION public\.set_dynamic_gameplay_gate\(boolean, text\) FROM PUBLIC, anon, authenticated/);
  assert.match(dynamicGateControlMigration, /GRANT EXECUTE ON FUNCTION public\.set_dynamic_gameplay_gate\(boolean, text\) TO authenticated/);
});

test('published private assets are readable by authenticated users without an app role claim', () => {
  assert.match(authenticatedAssetSelectMigration, /auth\.uid\(\) IS NOT NULL/);
  assert.match(authenticatedAssetSelectMigration, /level\.status = 'published'/);
  assert.match(authenticatedAssetSelectMigration, /game\.status = 'published'/);
  assert.match(authenticatedAssetSelectMigration, /rule_version\.id = \([\s\S]*?ORDER BY latest\.version DESC/);
  assert.match(authenticatedAssetSelectMigration, /asset\.id IN \(rule_version\.original_asset_id, rule_version\.comparison_asset_id\)/);
  assert.doesNotMatch(authenticatedAssetSelectMigration, /app_metadata[^\n]*'player'/);
});

test('archived level restore is Admin-only and reuses the unchanged pinned rule', () => {
  assert.match(restoreArchivedLevelMigration, /FUNCTION public\.restore_archived_level\(p_level_id uuid\)/);
  assert.match(restoreArchivedLevelMigration, /Administrator role required/);
  assert.match(restoreArchivedLevelMigration, /Only archived levels can be restored/);
  assert.match(restoreArchivedLevelMigration, /The parent game must be published/);
  assert.match(restoreArchivedLevelMigration, /v_rule\.original_asset_id IS NULL OR v_rule\.comparison_asset_id IS NULL/);
  assert.match(restoreArchivedLevelMigration, /public\.publish_level_with_runtime_rules\(v_level\.id\)/);
  assert.match(restoreArchivedLevelMigration, /v_publish_result ->> 'rule_version_id' IS DISTINCT FROM v_rule\.id::text/);
  assert.match(restoreArchivedLevelMigration, /REVOKE ALL ON FUNCTION public\.restore_archived_level\(uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(restoreArchivedLevelMigration, /GRANT EXECUTE ON FUNCTION public\.restore_archived_level\(uuid\) TO authenticated/);
});