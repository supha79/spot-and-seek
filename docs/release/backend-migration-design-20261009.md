# Spot & Seek — Final Backend Migration Design & Release Package

สถานะเอกสาร: Baseline/pre-implementation review. ไม่มี SQL ในเอกสารถูก Execute และไม่มีการยืนยัน Cloud Schema เพิ่มเติม

Implementation update (repository only): this baseline's proposal to defer source changes and migration allocation has been superseded. Local pending migration versions are `20261009133000`, `20261009133001`, and `20261009133004`; they follow `20261009000000` and were allocated using the UTC clock observed on 2026-10-09. Game/Level lifecycle RPC guards, score-policy create/approve/audit RPCs, and their Frontend contracts are now implemented in source. Dynamic gameplay remains gated off, no Legacy data is backfilled, and no Cloud or database was changed. The detailed release checkpoints below remain historical; reconcile the actual Staging migration history before applying any file.

**Current-use warning (2026-10-12):** this is a historical design snapshot, not the current migration plan or a Release Manifest. Its baseline inventory and statements that Game lifecycle/score-policy RPCs are absent describe the earlier repository state. The current repository has 12 migration files (3 reported historical baseline versions and 9 candidates, including `20261011090000`, `20261011100000`, `20261011110000`, and `20261012092053`). Use `docs/release/staging-migration-preflight.md` for the reconciled source order and target-evidence checklist. No target history or Apply state is confirmed by this note.

## 1. Executive Verdict และหลักฐาน

**Release ยังไม่พร้อม** และห้ามเปิด Dynamic Gameplay หรือ Deploy โดยอาศัยเอกสารนี้เพียงอย่างเดียว

แยกหลักฐานดังนี้:

- **ข้อมูล Cloud ที่ผู้ใช้ให้เป็น Baseline:** Cloud History มี migration `20261004000000`, `20261004010000`, `20261005000000`; migrations `20261008000000` ถึง `20261011000000` ยังไม่พบใน Cloud History; Preflight เดิมผ่าน และพบ Legacy Score Policy 1 รายการที่ Approved แต่ไม่ยืนยัน Dynamic Policy
- **ข้อเท็จจริงจาก Repository:** migrations 080–110 มี Content Catalog, Level Publish RPC, versioned score policy, Dynamic dual-path Run และ Session identity guard. Migration 100 ตั้ง `dynamic_gameplay=false`. ไม่มี Game lifecycle RPC และไม่มี Policy create/approve RPC ใน migration เหล่านั้น
- **หลักฐาน Legacy Content ใน Repository:** migration `20261004010000` มี rules ของ 8 Legacy keys รวม duration/spot IDs. `src/assets/README.md` ระบุเพียง placeholder; ไม่มี Original image pair หรือ spot geometry ที่ใช้เล่นได้ใน Player Source. Dashboard map เป็นชื่อ/difficulty ไม่ใช่ Runtime Content
- **ข้อเสนอในเอกสารนี้:** Forward Migration ใหม่หลัง dependencies 080–110 เพื่อเพิ่ม Game lifecycle RPCs, บังคับ Parent Game Published ภายใน transaction, จำกัด direct status updates และเพิ่ม Admin-only policy creation/approval RPCs. ไม่มีการแก้ migrations เดิม

### Migration Version

ห้ามกำหนดเลขวันที่อนาคตหรือย้าย/เปลี่ยนชื่อ migrations เดิม. วันนี้คือ `2026-10-09` แต่ migration ล่าสุดใน Repository คือ `20261011000000` ซึ่งมี timestamp หลังวันนี้ และยังไม่อยู่ใน Cloud History ตาม Baseline. จึงยังจัดสรรเลข migration จริงที่เรียงถูกต้องโดยไม่ฝ่าฝืนข้อห้ามไม่ได้

**ยังไม่มีเลข Migration ที่จัดสรรหรืออนุมัติแล้ว และห้ามนำข้อความนี้ไปใช้เป็นเลข Apply.** การจัดสรรต้องแยกจาก SQL Draft Review และทำในวันที่มีอนุมัติจริง:

1. อ่าน `supabase/migrations/` ใน Repository และ Cloud migration history ล่าสุดแบบ read-only; บันทึกเลขสูงสุดจากทั้งสองแหล่ง
2. ในวันที่อนุมัติ สร้าง candidate จาก UTC timestamp จริงรูปแบบ `YYYYMMDDHHMMSS` ซึ่งมากกว่า `20261011000000`, มากกว่าเลขล่าสุดทั้ง Repository/Cloud และไม่เป็นเวลาในอนาคต
3. ตรวจ Repository และ Cloud History อีกครั้งว่าไม่มีเลขซ้ำหรือ migration ที่ Apply บางส่วน; หาก Cloud มีเลขใหม่กว่า ให้จัดสรรเลขถัดจากค่านั้นและทบทวน dependencies ใหม่
4. บันทึกเลขจริงใน release ticket และให้ DB Owner อนุมัติชื่อ/ลำดับ ก่อนสร้าง migration artifact แยกต่างหาก

จนกว่าจะทำครบ ขั้นตอนนี้เป็น Blocker สำหรับการสร้างไฟล์/Apply แต่ไม่เปลี่ยนการทบทวน Design นี้. ห้ามเปลี่ยน version หรือชื่อ migrations เดิม

### Dependencies และลำดับ

1. ตรวจ Cloud history และ schema ก่อนเริ่ม; ห้าม assume ว่า source migration ที่ pending ตรงกับ Cloud
2. หากอนุมัติ ให้ทบทวนและ Apply migrations เดิม 080 → 090 → 100 → 110 ใน Staging ตามลำดับและตรวจหลังแต่ละชุด
3. Apply Proposed Forward Migration ในหัวข้อ 4 หลัง 110 ผ่าน verification เท่านั้น
4. เก็บ Dynamic Gate เป็น `false`; Policy RPCs เพียงสร้าง/อนุมัติ Policy เมื่อผู้อนุมัติทำรายการโดยชัดแจ้ง ไม่ seed หรือ approve ให้อัตโนมัติ

### 2.5 Frontend Contract และ Feature Gate

Game RPC Draft คืน `{game_id, status, published_at}` แต่ Frontend `GameRow` ใช้ `id` และ metadata fields; ปัจจุบัน Game lifecycle service ยัง fail closed และ Admin controls เป็น Not Ready. ก่อนต่อ RPC ต้องมี Adapter/Parser ที่ตรวจ `game_id` ตรงกับ ID ที่ร้องขอ, `status` ตรงกับ action และ `published_at` สอดคล้องกับสถานะ; response ที่ขาด/ไม่ตรงต้องไม่แสดง Success. ต้องมี Contract Review และ RPC smoke test ใน Staging ก่อนเปิด Controls. งานนี้ไม่แก้ Frontend

Migration 100 สร้าง `game_run_feature_gates` โดย default `false` และ revoke table privileges จาก `PUBLIC`, `anon`, `authenticated`; ใน Repository ไม่มี Gate-management RPC หรือ authorization/audit contract. จึงยังไม่มีวิธีเปิด/ปิดผ่าน Client ที่อนุมัติได้ และ **Gate operation เป็น Blocker**. ห้ามใช้ direct SQL, Dashboard หรือ service key เป็นขั้นตอนที่อนุมานขึ้นเอง

ก่อนกำหนดขั้นตอน Gate ต้องมี change ticket, ผู้อนุมัติ Release/DB แยกจาก Operator, restricted operation ที่ตรวจ actor/target/reason, audit record ที่เก็บผู้กระทำ/เวลา/เหตุผล/build และหลักฐานก่อน-หลัง, วิธี disable ที่ทดสอบแล้ว และ rollback ที่ไม่ลบ Runs/Rules/History. Operator ที่ได้รับมอบหมายจึงดำเนินการเปิด Gate ใน Staging เฉพาะ E2E; Production Gate ปิดจนมี approval แยกหลัง Deploy/health check. หากยังไม่มี contract ดังกล่าวให้คง Gate ปิดและหยุด Release

## 2. Design Decisions

### 2.1 Game Lifecycle

ใน Source ไม่มี Game Lifecycle RPC; Game rows มี `id uuid`, `status`, `published_at`, `name` และ RLS policy `games_admin_update`. Migration 090 ให้ table-level UPDATE แก่ `authenticated`, ซึ่งเปิด direct status update ได้แม้ UI จะปิดปุ่ม

เสนอ signatures ใหม่ โดยอิง UUID Primary Key ใน `games` และรูปแบบ named RPC args ของ Level Lifecycle ที่มีจริง:

- `publish_game(p_game_id uuid) RETURNS jsonb`
- `unpublish_game(p_game_id uuid) RETURNS jsonb`
- `archive_game(p_game_id uuid) RETURNS jsonb`

Response สม่ำเสมอ: `{game_id, status, published_at}`. Publish จาก Draft, Unpublish จาก Published, Archive จาก Draft/Published; ทำซ้ำในสถานะเป้าหมายคืน response เดิมแบบ idempotent. Archived Game กลับ Published/Draft ไม่ได้. การ Publish Game ไม่ publish Levels. การ Unpublish/Archive Game ถูกปฏิเสธถ้ายังมี Published child Levels; Admin ต้อง Unpublish/Archive ทีละ Level ผ่าน Level RPC ก่อน จึงไม่มีการ cascade status โดยไม่แจ้ง. การ Publish Game โดยไม่มี Published Levels อนุญาตเพื่อรองรับลำดับ Game ก่อน Level

RPC ตรวจ `auth.uid()` และ `auth.jwt()->'app_metadata'->>'role' = 'admin'` ใน Database, ใช้ `SECURITY DEFINER`, `SET search_path = ''`, qualify objects, revoke execute จาก `PUBLIC`/`anon`, grant เฉพาะ `authenticated`. RLS `games_admin_update` คงไว้; จำกัด column grants เพื่อให้ Admin แก้ได้เฉพาะ metadata columns ที่ Frontend ใช้ ไม่ใช่ `status`/`published_at`. เพิ่ม trigger ป้องกัน INSERT เป็น Published และ UPDATE สถานะนอก lifecycle RPC

### 2.2 Atomic Parent Game Check

Level RPC ปัจจุบันคือ `publish_level_with_runtime_rules(p_level_id uuid) RETURNS jsonb`; มัน lock Level `FOR UPDATE`, lock Game `FOR SHARE`, แต่ปฏิเสธเฉพาะ Archived ไม่ได้บังคับ `game.status = 'published'`. Draft parent จึงยัง Publish Level ได้

เสนอ DB trigger ก่อนเปลี่ยน Level เป็น Published ซึ่งอ่าน Parent Game ด้วย `FOR SHARE` และ reject เว้นแต่ Parent มี status `published`. Row lock จะคงอยู่จน transaction ของ `publish_level_with_runtime_rules` จบ. หาก RPC พบ Draft/Archived ระหว่าง lock ให้ error และ transaction rollback รวม Rule Version/Registry insert ที่เกิดก่อนหน้า

Lock order ที่อิง Function ปัจจุบันคือ Level → Game. Game Lifecycle RPC ใหม่ lock/update เฉพาะ Game และตรวจ child Level ด้วย existence query ที่ไม่ row-lock จึงไม่สร้าง lock cycle กับ Level Publish. หากออกแบบ Game operation ในอนาคตให้ lock child Levels ด้วย ต้องทบทวนและกำหนด lock order ใหม่ก่อนเพิ่ม

DB guard ยังเป็น safety net สำหรับทุก status update ไม่พึ่ง Frontend pre-check. Error ใช้ SQLSTATE `55000` และข้อความ `Parent game must be published before level can be published.`

### 2.3 Dynamic Run Contract

**ข้อเสนอ: คง Dual-path RPC จาก migration 100 ไม่เพิ่ม Dynamic-specific RPC ซ้ำใน Draft นี้** เพราะ migration source แยก identity ใน DB ด้วยข้อกำหนดร่วมกัน:

- Legacy rules จำกัด `level_id` ไว้แค่ 8 keys; Dynamic registry ปฏิเสธ 8 keys เดียวกัน
- Dynamic run เก็บ `game_runs.level_id = NULL` พร้อม `content_level_id + rule_version_id`; CHECK constraint บังคับรูปแบบ Legacy/Dynamic ให้เลือกอย่างใดอย่างหนึ่ง
- Dynamic Run pin `rule_version_id`; response ส่ง `content_level_id`, `level_key`, `rule_version_id` และ legacy-compatible `level_id = level_key`
- `start_game_run(p_level_id text, p_request_id uuid)` ตรวจ Legacy rules ก่อน; หากไม่ใช่ Legacy จะตรวจ Feature Gate, Registry, Published Game/Level, Runtime Rule Version และ Policy Approval ก่อน insert
- auth มาจาก `auth.uid()`; mutations ตรวจ ownership, lock run row, ใช้ event request idempotency และ event numbering; Dynamic runtime อ่าน immutable pinned snapshot
- Finish คำนวณ score ฝั่ง server, ตรวจ Approval ของ policy ที่ pin, เขียน `game_sessions`/profile/run ใน transaction เดียว; timeout loss ได้ score 0; winning finish ปฏิเสธเมื่อ policy approval ไม่ครบ
- `game_sessions.level_id text` ห้ามตีความเป็น UUID; Dynamic session เก็บ `content_level_id`, `level_key`, `rule_version_id`; migration 110 ผูก `(content_level_id, level_key)` กับ Registry

**ความเสี่ยงที่ยังคงอยู่:** Public start argument `p_level_id text` ชื่อชวนสับสนและ response `level_id` มี Dynamic key. การแยกปลอดภัยเฉพาะเมื่อข้อจำกัด Reserved Keys/Registry/identity ถูก Apply และตรวจใน Cloud แล้ว. Frontend ปัจจุบันยอมส่งเฉพาะ tagged Legacy identity และ Gate ต้องคงปิดจน Post-Apply Verification ผ่าน. ถ้า Release Owner ต้องการ boundary แบบ compile-time แทน DB namespace dispatch ให้ทำ Version 2 แยกต่างหากหลังทดสอบ compatibility กับ client เก่า; ห้ามเปลี่ยน signature เดิมใน migration นี้

### 2.4 Score Policy Approval

Legacy singleton `game_run_score_policy` กับ Dynamic `game_run_score_policy_versions`/`game_run_score_policy_approvals` เป็นคนละ authority. Migration 090 ไม่สร้าง/approve Dynamic policy และ revoke table privileges. Rule Version เก็บ policy ID/version และสำเนาค่าน้ำหนักที่ใช้; Run pin Rule Version; Finish ตรวจว่า Approval ของ policy/version/weights ตรงกัน

เสนอ RPC ใหม่:

- `create_game_run_score_policy_version(p_version text, p_time_weight integer, p_wrong_click_penalty integer, p_hint_penalty integer) RETURNS jsonb`
- `approve_game_run_score_policy(p_policy_id uuid, p_approval_note text) RETURNS jsonb`

ทั้งคู่ Admin-only ผ่าน app metadata role ฝั่ง Database. Creation สร้าง immutable, unapproved policy เท่านั้น. Approval lock policy row, เก็บ `policy_id`, `approved_at`, `approved_by`, `approval_note` ในตาราง append-only ที่มีอยู่แล้ว. Draft กำหนด two-person rule: ผู้อนุมัติต้องต่างจาก `created_by`; นี่เป็นข้อเสนอ Security Control ที่ Release Owner ต้องอนุมัติก่อนใช้งาน. Policy weights ใช้ CHECK constraints ที่มีอยู่ (จำนวนเต็มไม่ติดลบ); ยังไม่มีหลักฐาน Product-approved upper bounds จึงไม่แต่ง bounds เพิ่ม

ไม่มี Policy row หรือ Approval ถูกสร้างโดย SQL Draft. ไม่มีการอ่าน/ใช้ Legacy Approved Policy แทน Dynamic Policy. `publish_level_with_runtime_rules` และ Dynamic `start`/`finish` ยังคง fail closed เมื่อไม่มี Dynamic Approval

## 3. Read-only Preflight SQL

รันโดยผู้มีสิทธิ์อ่าน Catalog ใน Supabase SQL Editor หลังได้รับอนุมัติเท่านั้น. ทุก Statement ด้านล่างเป็น `SELECT`; ไม่มี RPC, DML หรือ DDL. ข้อมูล Expected Cloud ด้านล่างมาจาก Baseline ที่ผู้ใช้ให้ ไม่ใช่การยืนยันใหม่

### 3.1 Migration History

```sql
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

```sql
WITH expected(version, expected_cloud_state) AS (
  VALUES
    ('20261004000000', 'reported applied'),
    ('20261004010000', 'reported applied'),
    ('20261005000000', 'reported applied'),
    ('20261008000000', 'reported absent'),
    ('20261009000000', 'reported absent'),
    ('20261010000000', 'reported absent'),
    ('20261011000000', 'reported absent')
)
SELECT expected.version, expected.expected_cloud_state,
       (history.version IS NOT NULL) AS present_in_cloud_history
FROM expected
LEFT JOIN supabase_migrations.schema_migrations AS history
  ON history.version = expected.version
ORDER BY expected.version;
```

**Stop:** ถ้า 040/050 ไม่ตรง Baseline, มี migration version ใหม่/ไม่รู้จัก, หรือ migration 080–110 บางส่วนถูก Apply แล้ว ให้หยุดและทำ schema/history reconciliation ก่อน. ห้าม `migration repair` หรือเปลี่ยนชื่อไฟล์เพื่อให้ตัวเลขตรง

### 3.2 Object/Column Inventory

```sql
SELECT object_name,
       to_regclass('public.' || quote_ident(object_name)) AS relation
FROM (VALUES
  ('games'), ('levels'), ('level_assets'), ('level_spots'),
  ('game_run_level_rules'), ('game_run_score_policy'),
  ('game_runs'), ('game_run_events'), ('game_sessions'), ('profiles'),
  ('game_run_score_policy_versions'), ('game_run_score_policy_approvals'),
  ('game_run_level_key_registry'), ('game_run_rule_versions'),
  ('game_run_feature_gates')
) AS expected(object_name)
ORDER BY object_name;
```

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'games', 'levels', 'game_run_level_rules', 'game_runs', 'game_run_events',
    'game_sessions', 'profiles', 'game_run_score_policy',
    'game_run_score_policy_versions', 'game_run_score_policy_approvals',
    'game_run_level_key_registry', 'game_run_rule_versions', 'game_run_feature_gates'
  )
ORDER BY table_name, ordinal_position;
```

### 3.3 Constraints, Validation และ Identity

```sql
SELECT relation.relname AS table_name,
       constraint_row.conname,
       constraint_row.contype,
       constraint_row.convalidated,
       pg_get_constraintdef(constraint_row.oid) AS definition
FROM pg_constraint AS constraint_row
JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
WHERE schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'game_run_level_rules', 'game_runs', 'game_run_events',
    'game_sessions', 'game_run_score_policy_versions',
    'game_run_score_policy_approvals', 'game_run_level_key_registry', 'game_run_rule_versions'
  )
ORDER BY relation.relname, constraint_row.conname;
```

```sql
SELECT table_name, constraint_name, constraint_type, is_deferrable, initially_deferred
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND table_name IN ('games', 'levels', 'game_runs', 'game_sessions')
ORDER BY table_name, constraint_name;
```

### 3.4 RLS/Policies/Grants/RPC Signatures

```sql
SELECT relation.relname AS table_name,
       relation.relrowsecurity AS rls_enabled,
       relation.relforcerowsecurity AS force_rls,
       policy.policyname, policy.cmd, policy.roles, policy.qual, policy.with_check
FROM pg_class AS relation
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
LEFT JOIN pg_policies AS policy
  ON policy.schemaname = schema_row.nspname AND policy.tablename = relation.relname
WHERE schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'level_assets', 'level_spots', 'game_runs',
    'game_run_events', 'game_sessions', 'profiles', 'game_run_score_policy_versions',
    'game_run_score_policy_approvals', 'game_run_level_key_registry',
    'game_run_rule_versions', 'game_run_feature_gates'
  )
ORDER BY relation.relname, policy.policyname;
```

```sql
SELECT has_table_privilege('authenticated', 'public.games', 'SELECT') AS auth_can_select_games,
       has_table_privilege('authenticated', 'public.games', 'UPDATE') AS auth_has_table_update_games,
       has_column_privilege('authenticated', 'public.games', 'status', 'UPDATE') AS auth_can_update_game_status,
       has_column_privilege('authenticated', 'public.games', 'published_at', 'UPDATE') AS auth_can_update_game_published_at,
       has_table_privilege('authenticated', 'public.game_sessions', 'SELECT') AS auth_can_select_history,
       has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS auth_can_select_profile;
```

```sql
WITH expected(signature) AS (
  VALUES
    ('public.start_game_run(text,uuid)'),
    ('public.record_game_run_event(uuid,uuid,text,text)'),
    ('public.pause_game_run(uuid,uuid)'),
    ('public.resume_game_run(uuid,uuid)'),
    ('public.finish_game_run(uuid)'),
    ('public.abandon_game_run(uuid,uuid)'),
    ('public.publish_level_with_runtime_rules(uuid)'),
    ('public.unpublish_level(uuid)'),
    ('public.archive_level(uuid)'),
    ('public.publish_game(uuid)'),
    ('public.unpublish_game(uuid)'),
    ('public.archive_game(uuid)'),
    ('public.create_game_run_score_policy_version(text,integer,integer,integer)'),
    ('public.approve_game_run_score_policy(uuid,text)')
)
SELECT signature, to_regprocedure(signature) IS NOT NULL AS exists
FROM expected
ORDER BY signature;
```

### 3.5 Legacy Rules, Policy และ Feature Gate

```sql
SELECT level_id, max_duration_seconds, spot_ids, max_hints
FROM public.game_run_level_rules
ORDER BY level_id;
```

```sql
SELECT policy_id, is_approved, version, time_weight, wrong_click_penalty, hint_penalty,
       approved_at, approved_by
FROM public.game_run_score_policy
ORDER BY policy_id;
```

ถ้า Dynamic tables มีอยู่แล้ว:

```sql
SELECT count(*) AS dynamic_policy_versions FROM public.game_run_score_policy_versions;
SELECT count(*) AS dynamic_policy_approvals FROM public.game_run_score_policy_approvals;
SELECT gate_name, is_enabled FROM public.game_run_feature_gates ORDER BY gate_name;
```

ก่อน Apply 080–110 ตาราง Dynamic เหล่านี้อาจไม่มี; ใช้ Inventory ข้างต้นแทน ห้ามถือว่า missing relation เป็นศูนย์ rows. Gate ต้องไม่ถูกเปิดระหว่าง Preflight

### 3.6 Trigger Conflicts, Ownership, Role Membership และ Effective Privileges

รันหลัง migrations 080–110 อยู่ครบใน Staging แต่ก่อน Forward Migration. Query ตรวจเฉพาะชื่อ trigger ที่ Draft จะสร้างบน relation เป้าหมาย; ต้องได้ `existing_trigger IS NULL` ทุกแถว. ถ้าตารางยังไม่มีหรือ trigger มีอยู่แล้ว ให้หยุดและตรวจ drift:

```sql
WITH planned(table_name, trigger_name) AS (
  VALUES
    ('games', 'games_guard_lifecycle_state'),
    ('levels', 'levels_require_published_parent_game')
)
SELECT planned.table_name AS expected_table,
       planned.trigger_name,
       relation.relname AS existing_table,
       trigger_row.tgname AS existing_trigger,
       pg_get_triggerdef(trigger_row.oid) AS definition
FROM planned
LEFT JOIN pg_class AS relation
  ON relation.relnamespace = 'public'::regnamespace
 AND relation.relname = planned.table_name
LEFT JOIN pg_trigger AS trigger_row
  ON trigger_row.tgrelid = relation.oid
 AND trigger_row.tgname = planned.trigger_name
 AND NOT trigger_row.tgisinternal
ORDER BY planned.table_name, planned.trigger_name;
```

ตรวจ owner และ RLS bypass flags ของ relations/functions ที่ Definer functions จะใช้. Owner ต้องตรงกับ approved migration/security model; ถ้า owner ไม่ใช่ table owner, superuser หรือ `BYPASSRLS`, ให้หยุดจนกว่าจะพิสูจน์ว่า Definer queries ยังเห็น/ล็อกแถวที่ตั้งใจ:

```sql
SELECT relation.relname AS object_name,
       owner.rolname AS object_owner,
       owner.rolsuper AS owner_is_superuser,
       owner.rolbypassrls AS owner_bypasses_rls,
       relation.relforcerowsecurity AS force_rls
FROM pg_class AS relation
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
JOIN pg_roles AS owner ON owner.oid = relation.relowner
WHERE schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'level_assets', 'level_spots', 'game_run_level_rules',
    'game_run_score_policy', 'game_runs', 'game_run_events', 'game_sessions', 'profiles',
    'game_run_score_policy_versions', 'game_run_score_policy_approvals',
    'game_run_level_key_registry', 'game_run_rule_versions', 'game_run_feature_gates'
  )
ORDER BY relation.relname;
```

```sql
SELECT procedure.oid::regprocedure AS signature,
       owner.rolname AS function_owner,
       owner.rolsuper AS owner_is_superuser,
       owner.rolbypassrls AS owner_bypasses_rls,
       procedure.prosecdef AS security_definer,
       procedure.proconfig AS function_settings
FROM pg_proc AS procedure
JOIN pg_namespace AS schema_row ON schema_row.oid = procedure.pronamespace
JOIN pg_roles AS owner ON owner.oid = procedure.proowner
WHERE schema_row.nspname = 'public'
  AND procedure.proname IN (
    'start_game_run', 'record_game_run_event', 'pause_game_run', 'resume_game_run',
    'finish_game_run', 'abandon_game_run', 'publish_level_with_runtime_rules',
    'unpublish_level', 'archive_level', '_dynamic_game_run_response',
    '_dynamic_finalize_game_run', '_dynamic_mutate_game_run',
    '_legacy_start_game_run', '_legacy_record_game_run_event', '_legacy_pause_game_run',
    '_legacy_resume_game_run', '_legacy_finish_game_run', '_legacy_abandon_game_run',
    '_game_run_response', '_finalize_game_run', 'guard_game_run_identity',
    'guard_game_run_level_key', 'guard_immutable_backend_row', 'guard_level_runtime_fields',
    'guard_level_publish_state', 'guard_published_level_spot_mutation',
    '_set_game_lifecycle', 'publish_game', 'unpublish_game', 'archive_game',
    'create_game_run_score_policy_version', 'approve_game_run_score_policy',
    'guard_game_lifecycle_state', 'guard_level_parent_game_published'
  )
ORDER BY procedure.proname, procedure.oid::regprocedure::text;
```

ตรวจ role-membership graph สำหรับ roles ที่เกี่ยวข้อง. Query นี้แสดง membership paths เท่านั้น ไม่ได้พิสูจน์สิทธิ์ effective; ใช้ privilege inquiries ต่อจากนี้ประกอบ:

```sql
WITH RECURSIVE role_tree(root_oid, inherited_oid, path) AS (
  SELECT role.oid, role.oid, ARRAY[role.oid]::oid[]
  FROM pg_roles AS role
  WHERE role.rolname IN ('anon', 'authenticated', 'service_role')

  UNION ALL

  SELECT tree.root_oid, membership.roleid, tree.path || membership.roleid
  FROM role_tree AS tree
  JOIN pg_auth_members AS membership ON membership.member = tree.inherited_oid
  WHERE NOT membership.roleid = ANY (tree.path)
)
SELECT root_role.rolname AS starting_role,
       inherited_role.rolname AS inherited_role
FROM role_tree AS tree
JOIN pg_roles AS root_role ON root_role.oid = tree.root_oid
JOIN pg_roles AS inherited_role ON inherited_role.oid = tree.inherited_oid
WHERE tree.root_oid <> tree.inherited_oid
ORDER BY starting_role, inherited_role;
```

ตรวจ Effective table privileges ของ `anon`, `authenticated`, `service_role`; absent roles จะไม่ปรากฏในผล จึงต้องเทียบกับ `pg_roles`/membership inventory:

```sql
SELECT role.rolname,
       relation.relname AS table_name,
       has_table_privilege(role.oid, relation.oid, 'SELECT') AS can_select,
       has_table_privilege(role.oid, relation.oid, 'INSERT') AS can_insert,
       has_table_privilege(role.oid, relation.oid, 'UPDATE') AS can_update,
       has_table_privilege(role.oid, relation.oid, 'DELETE') AS can_delete
FROM pg_roles AS role
CROSS JOIN pg_class AS relation
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
WHERE role.rolname IN ('anon', 'authenticated', 'service_role')
  AND schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'level_assets', 'level_spots', 'game_run_level_rules',
    'game_run_score_policy', 'game_runs', 'game_run_events', 'game_sessions', 'profiles',
    'game_run_score_policy_versions', 'game_run_score_policy_approvals',
    'game_run_level_key_registry', 'game_run_rule_versions', 'game_run_feature_gates'
  )
ORDER BY role.rolname, relation.relname;
```

```sql
SELECT role.rolname,
       relation.relname AS table_name,
       attribute.attname AS column_name,
       has_column_privilege(role.oid, relation.oid, attribute.attnum, 'SELECT') AS can_select,
       has_column_privilege(role.oid, relation.oid, attribute.attnum, 'INSERT') AS can_insert,
       has_column_privilege(role.oid, relation.oid, attribute.attnum, 'UPDATE') AS can_update,
       has_column_privilege(role.oid, relation.oid, attribute.attnum, 'REFERENCES') AS can_reference
FROM pg_roles AS role
CROSS JOIN pg_class AS relation
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
JOIN pg_attribute AS attribute ON attribute.attrelid = relation.oid
WHERE role.rolname IN ('anon', 'authenticated', 'service_role')
  AND schema_row.nspname = 'public'
  AND relation.relname IN ('games', 'levels', 'profiles')
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
  AND attribute.attname IN (
    'status', 'published_at', 'level_key', 'name', 'description',
    'avatar_url', 'selected_buddy', 'best_score', 'total_wins', 'total_plays'
  )
ORDER BY role.rolname, relation.relname, attribute.attnum;
```

Effective EXECUTE privileges สำหรับ dependency functions ที่มีอยู่ และชื่อ Proposed functions (ชื่อ Proposed ต้องยังไม่พบก่อน migration; หลัง Apply ต้องปรากฏพร้อม grants ตาม contract):

```sql
SELECT role.rolname,
       procedure.oid::regprocedure AS signature,
       has_function_privilege(role.oid, procedure.oid, 'EXECUTE') AS can_execute
FROM pg_roles AS role
CROSS JOIN pg_proc AS procedure
JOIN pg_namespace AS schema_row ON schema_row.oid = procedure.pronamespace
WHERE role.rolname IN ('anon', 'authenticated', 'service_role')
  AND schema_row.nspname = 'public'
  AND procedure.proname IN (
    'start_game_run', 'record_game_run_event', 'pause_game_run', 'resume_game_run',
    'finish_game_run', 'abandon_game_run', 'publish_level_with_runtime_rules',
    'unpublish_level', 'archive_level', '_dynamic_game_run_response',
    '_dynamic_finalize_game_run', '_dynamic_mutate_game_run',
    '_legacy_start_game_run', '_legacy_record_game_run_event', '_legacy_pause_game_run',
    '_legacy_resume_game_run', '_legacy_finish_game_run', '_legacy_abandon_game_run',
    '_game_run_response', '_finalize_game_run', 'guard_game_run_identity',
    'guard_game_run_level_key', 'guard_immutable_backend_row', 'guard_level_runtime_fields',
    'guard_level_publish_state', 'guard_published_level_spot_mutation',
    '_set_game_lifecycle', 'publish_game', 'unpublish_game', 'archive_game',
    'create_game_run_score_policy_version', 'approve_game_run_score_policy',
    'guard_game_lifecycle_state', 'guard_level_parent_game_published'
  )
ORDER BY role.rolname, procedure.proname, procedure.oid::regprocedure::text;
```

Effective privilege functions include direct and inherited role privileges, but do not replace inspection of `PUBLIC` ACLs; `PUBLIC` is a pseudo-role, not a row in `pg_roles`. ใน Preflight หลัง 080–110 ให้รันเฉพาะ raw table/column/function ACL `SELECT` blocks ใน Section 5.2 เพิ่มด้วย (แม้ยังไม่รัน Full Section 5); rerun หลัง Proposed Migration. Queries เหล่านี้ไม่พิสูจน์ RLS row visibility, API JWT claims หรือ behavior ของ `SECURITY DEFINER`. Record output; do not treat a static repository review as a Cloud Preflight pass.

## 4. Proposed Forward Migration SQL

**Draft เท่านั้น — ห้าม Execute ก่อน Review/อนุมัติ.** ต้อง Apply migrations เดิม 080–110 ตามลำดับใน Staging ก่อน. SQL Draft ใช้ object/column/function names จาก migrations ใน Repository. Precondition block ตั้งใจ fail เมื่อ Dependency/Signature/ชื่อ Function ไม่ตรง; ไม่ใช้ `IF NOT EXISTS` เพื่อกลบ Schema Drift

```sql
BEGIN;

DO $preflight$
DECLARE
  v_required_version text;
  v_game_publish_functions integer;
BEGIN
  IF to_regclass('public.games') IS NULL
     OR to_regclass('public.levels') IS NULL
     OR to_regclass('public.game_run_score_policy_versions') IS NULL
     OR to_regclass('public.game_run_score_policy_approvals') IS NULL
     OR to_regclass('public.game_run_level_key_registry') IS NULL
     OR to_regclass('public.game_run_rule_versions') IS NULL THEN
    RAISE EXCEPTION 'Required Content/Policy schema is missing; apply and verify migrations 080-110 first.'
      USING ERRCODE = '55000';
  END IF;

  FOREACH v_required_version IN ARRAY ARRAY[
    '20261008000000', '20261009000000', '20261010000000', '20261011000000'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations AS migration
      WHERE migration.version = v_required_version
    ) THEN
      RAISE EXCEPTION 'Required migration % is absent from migration history.', v_required_version
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF to_regprocedure('public.publish_level_with_runtime_rules(uuid)') IS NULL
     OR to_regprocedure('public.unpublish_level(uuid)') IS NULL
     OR to_regprocedure('public.archive_level(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected Level lifecycle RPC signatures are missing.' USING ERRCODE = '55000';
  END IF;

  SELECT count(*) INTO v_game_publish_functions
  FROM pg_proc AS function_row
  JOIN pg_namespace AS schema_row ON schema_row.oid = function_row.pronamespace
  WHERE schema_row.nspname = 'public'
    AND function_row.proname IN (
      'publish_game', 'unpublish_game', 'archive_game', '_set_game_lifecycle',
      'create_game_run_score_policy_version', 'approve_game_run_score_policy',
      'guard_game_lifecycle_state', 'guard_level_parent_game_published'
    );
  IF v_game_publish_functions <> 0 THEN
    RAISE EXCEPTION 'A proposed lifecycle/policy function name already exists; inspect and re-version this Draft.'
      USING ERRCODE = '42710';
  END IF;
END;
$preflight$;

-- Direct authenticated metadata edits remain possible, but status/published_at
-- become RPC-only. Existing RLS policies remain in force.
REVOKE UPDATE ON TABLE public.games FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (status, published_at)
  ON TABLE public.games FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name, description, updated_at) ON TABLE public.games TO authenticated;

CREATE FUNCTION public.guard_game_lifecycle_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Games must be inserted as unpublished drafts.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    IF current_setting('spot_seek.game_status_rpc', true) IS DISTINCT FROM 'on'
       OR auth.uid() IS NULL
       OR COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Game publish state can only be changed through an authorized lifecycle RPC.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER games_guard_lifecycle_state
  BEFORE INSERT OR UPDATE OF status, published_at ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_lifecycle_state();

CREATE FUNCTION public._set_game_lifecycle(p_game_id uuid, p_target_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_game_id uuid;
  v_status text;
  v_published_at timestamptz;
  v_previous_guard_setting text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;
  IF p_target_status IS NULL OR p_target_status NOT IN ('published', 'draft', 'archived') THEN
    RAISE EXCEPTION 'Unsupported Game lifecycle action.' USING ERRCODE = '22023';
  END IF;

  SELECT game.id, game.status, game.published_at
  INTO v_game_id, v_status, v_published_at
  FROM public.games AS game
  WHERE game.id = p_game_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_status = 'archived' AND p_target_status <> 'archived' THEN
    RAISE EXCEPTION 'Archived games cannot be published or unpublished.' USING ERRCODE = '55000';
  END IF;

  IF p_target_status IN ('draft', 'archived') AND EXISTS (
    SELECT 1
    FROM public.levels AS level
    WHERE level.game_id = p_game_id AND level.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Unpublish or archive every published level before unpublishing or archiving this game.'
      USING ERRCODE = '55000';
  END IF;

  IF (p_target_status = 'published' AND v_status = 'draft')
     OR (p_target_status = 'draft' AND v_status = 'published')
     OR (p_target_status = 'archived' AND v_status <> 'archived') THEN
    v_previous_guard_setting := current_setting('spot_seek.game_status_rpc', true);
    PERFORM pg_catalog.set_config('spot_seek.game_status_rpc', 'on', true);

    UPDATE public.games AS game
    SET status = p_target_status,
        published_at = CASE
          WHEN p_target_status = 'published' THEN pg_catalog.clock_timestamp()
          ELSE NULL
        END,
        updated_at = pg_catalog.clock_timestamp()
    WHERE game.id = p_game_id
    RETURNING game.id, game.status, game.published_at
    INTO v_game_id, v_status, v_published_at;

    PERFORM pg_catalog.set_config(
      'spot_seek.game_status_rpc', COALESCE(v_previous_guard_setting, 'off'), true
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'game_id', v_game_id,
    'status', v_status,
    'published_at', v_published_at
  );
END;
$function$;

CREATE FUNCTION public.publish_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public._set_game_lifecycle(p_game_id, 'published');
$function$;

CREATE FUNCTION public.unpublish_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public._set_game_lifecycle(p_game_id, 'draft');
$function$;

CREATE FUNCTION public.archive_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public._set_game_lifecycle(p_game_id, 'archived');
$function$;

REVOKE ALL ON FUNCTION public.guard_game_lifecycle_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._set_game_lifecycle(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_game(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unpublish_game(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_game(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_game(uuid) TO authenticated;

CREATE FUNCTION public.guard_level_parent_game_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_game_status text;
BEGIN
  IF NEW.status = 'published' THEN
    SELECT game.status
    INTO v_game_status
    FROM public.games AS game
    WHERE game.id = NEW.game_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent game not found.' USING ERRCODE = 'P0002';
    END IF;
    IF v_game_status <> 'published' THEN
      RAISE EXCEPTION 'Parent game must be published before level can be published.'
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER levels_require_published_parent_game
  BEFORE UPDATE OF status ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.guard_level_parent_game_published();

REVOKE ALL ON FUNCTION public.guard_level_parent_game_published() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_game_run_score_policy_version(
  p_version text,
  p_time_weight integer,
  p_wrong_click_penalty integer,
  p_hint_penalty integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_policy_id uuid;
  v_version text;
  v_created_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;
  IF p_version IS NULL OR pg_catalog.btrim(p_version) = ''
     OR p_time_weight IS NULL OR p_time_weight < 0
     OR p_wrong_click_penalty IS NULL OR p_wrong_click_penalty < 0
     OR p_hint_penalty IS NULL OR p_hint_penalty < 0 THEN
    RAISE EXCEPTION 'Policy version and non-negative integer weights are required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.game_run_score_policy_versions (
    version, time_weight, wrong_click_penalty, hint_penalty, created_by
  )
  VALUES (
    pg_catalog.btrim(p_version), p_time_weight, p_wrong_click_penalty, p_hint_penalty, v_user_id
  )
  RETURNING id, version, created_at INTO v_policy_id, v_version, v_created_at;

  RETURN pg_catalog.jsonb_build_object(
    'policy_id', v_policy_id,
    'version', v_version,
    'is_approved', false,
    'created_by', v_user_id,
    'created_at', v_created_at
  );
END;
$function$;

CREATE FUNCTION public.approve_game_run_score_policy(p_policy_id uuid, p_approval_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_policy_id uuid;
  v_version text;
  v_created_by uuid;
  v_approved_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF COALESCE((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator role required.' USING ERRCODE = '42501';
  END IF;
  IF p_approval_note IS NULL OR pg_catalog.btrim(p_approval_note) = '' THEN
    RAISE EXCEPTION 'An approval note is required for the audit record.' USING ERRCODE = '22023';
  END IF;

  SELECT policy.id, policy.version, policy.created_by
  INTO v_policy_id, v_version, v_created_by
  FROM public.game_run_score_policy_versions AS policy
  WHERE policy.id = p_policy_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dynamic score policy version not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_created_by = v_user_id THEN
    RAISE EXCEPTION 'A policy creator cannot approve their own policy version.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_run_score_policy_approvals AS approval
    WHERE approval.policy_id = v_policy_id
  ) THEN
    RAISE EXCEPTION 'Dynamic score policy version is already approved.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.game_run_score_policy_approvals (policy_id, approved_by, approval_note)
  VALUES (v_policy_id, v_user_id, pg_catalog.btrim(p_approval_note))
  RETURNING approved_at INTO v_approved_at;

  RETURN pg_catalog.jsonb_build_object(
    'policy_id', v_policy_id,
    'version', v_version,
    'is_approved', true,
    'approved_at', v_approved_at,
    'approved_by', v_user_id,
    'approval_note', pg_catalog.btrim(p_approval_note)
  );
END;
$function$;

REVOKE ALL ON TABLE public.game_run_score_policy_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.game_run_score_policy_approvals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_game_run_score_policy_version(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_game_run_score_policy(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_run_score_policy_version(text, integer, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_game_run_score_policy(uuid, text)
  TO authenticated;

COMMIT;
```

### ผลกระทบที่ Draft ตั้งใจ

- **Tables/Columns:** ไม่มีการเพิ่ม/ลบ/เปลี่ยน columns; ใช้ `games`, `levels`, `game_run_score_policy_versions`, `game_run_score_policy_approvals` ที่ migrations 080/090 สร้าง
- **Constraints:** ไม่มีการแก้ Legacy rules, Run/Session identity CHECK/FK หรือ policy constraints
- **Functions:** เพิ่ม `_set_game_lifecycle(uuid,text)` ภายใน, 3 Game lifecycle RPCs, `guard_game_lifecycle_state()`, `guard_level_parent_game_published()`, 2 Dynamic Policy RPCs
- **Triggers:** เพิ่ม Game draft-only insert/status RPC guard และ Parent Game Published guard สำหรับ Level status transition
- **RLS/Policies:** ไม่เปลี่ยน policy definitions. `games_admin_update` คงไว้ แต่ direct `UPDATE` table privilege ถูกถอน; metadata columns ที่ Source ใช้ยัง update ได้
- **Grants:** execute public RPCs เฉพาะ `authenticated`; helper/trigger functions และ Policy tables ไม่เปิด direct client privileges
- **Data:** ไม่มี seed, backfill, status update, Policy Version หรือ Approval insert ระหว่าง migration

### Roll-forward

Migration เป็น Transaction เดียว; precondition/function/constraint failure ต้อง rollback statement ทั้งชุด. อย่าแก้/Apply ไฟล์นี้ซ้ำด้วย `IF NOT EXISTS`. หาก Apply สำเร็จแต่ verification ล้ม ให้คง Gate off, เก็บผลตรวจ, ทำ forward migration ใหม่หลังตรวจ Catalog; ห้ามย้อน migration history หรือ drop data-bearing objects. ยังไม่มี rollback script เพราะหลัง lifecycle/policy calls เริ่มใช้งานแล้วการลบ functions/triggers อาจทำให้ state transition bypass ได้

## 5. Post-Apply Verification Read-only SQL

ทุก Statement เป็น `SELECT` เท่านั้น. **Section นี้เป็น Full Post-Apply Verification หลัง migrations 080–110 และ Proposed Forward Migration ผ่านแล้วเท่านั้น**; ห้ามรันทั้ง Section หลัง 110 แต่ก่อน Proposed Migration. หลังแต่ละ dependency migration ให้รันเฉพาะ checkpoint ที่ระบุใน Runbook และยืนยัน object ของ migration นั้น

#### Migration Checkpoints

รันเฉพาะ query ที่ระบุหลัง migration แต่ละตัว; การมี migration row อย่างเดียวไม่พอ และ object ที่คาดจาก migration ถัดไปต้องยังไม่ถูกตีความว่า Apply ไม่ครบ:

| หลัง Migration | Read-only checks | Expected result |
|---|---|---|
| `20261008000000` | Section 3.1 history, 3.2 inventory/columns, 3.4 RLS/policies | `games`, `levels`, `level_assets`, `level_spots` มี columns ตาม 080; RLS/policies ที่ 080 สร้างมีอยู่; Dynamic run/policy tables และ lifecycle RPCs ยังไม่คาดหวัง |
| `20261009000000` | Sections 3.1–3.4 โดยดูเฉพาะ policy version/approval, registry, rule version, identity columns/constraints และ Level lifecycle signatures | policy definitions/approvals ยังว่างตาม migration; identity FKs/CHECKs validated; Level lifecycle RPCs มี; Game lifecycle RPCs และ new Policy RPCs ยังไม่คาดหวัง; Game direct status UPDATE ยังไม่ถูกถอนโดย Draft ใหม่ |
| `20261010000000` | Section 3.1, 3.2, 3.4 RPC signatures และ 3.5 Feature Gate | `dynamic_gameplay=false`; wrappers public RPCs อยู่ตาม signature; Dynamic internal helpers ไม่ execute ได้โดย Client; ไม่สร้าง Approval ใหม่ |
| `20261011000000` | Section 3.1 และ constraint query ใน 5.1 เฉพาะ `game_sessions_content_level_key_fk` | FK มีอยู่และ `convalidated=true`; Legacy rows/identity ไม่ถูก rewrite |
| Proposed Forward Migration (หลังอนุมัติแยก) | Full Section 5 ทั้งหมด รวม Sections 5.2–5.4 และ rerun ownership/membership/effective-privilege queries ใน 3.6 | Game/Policy RPCs และ triggers ตรง contract; direct status/Policy DML ไม่เปิด; Gate ยังคง false; Legacy counts ไม่เปลี่ยน |

ห้ามรัน Full Section 5 หลัง dependency migrations 080–110 ก่อน Proposed Forward Migration เพราะ assertions เรื่อง Game status grants, new RPCs และ new triggers จะยังไม่เป็นจริงตามลำดับที่ออกแบบไว้

### 5.1 Migration History/Objects/Constraints

```sql
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20261008000000', '20261009000000', '20261010000000', '20261011000000'
)
ORDER BY version;
```

เพิ่ม version จริงของ Draft ใน `IN (...)` หลังเลขถูกจัดสรรและอนุมัติแล้ว

```sql
SELECT relation.relname AS table_name,
       constraint_row.conname,
       constraint_row.convalidated,
       pg_get_constraintdef(constraint_row.oid) AS definition
FROM pg_constraint AS constraint_row
JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
WHERE schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'game_run_level_rules', 'game_runs', 'game_sessions',
    'game_run_level_key_registry', 'game_run_rule_versions',
    'game_run_score_policy_versions', 'game_run_score_policy_approvals'
  )
ORDER BY relation.relname, constraint_row.conname;
```

Expected: Dynamic XOR identity CHECKs and composite FKs exist and are validated; Legacy FK/rules remain; no unplanned constraint changes.

### 5.2 RLS/Grants/Triggers

```sql
SELECT relation.relname AS table_name,
       relation.relrowsecurity AS rls_enabled,
       relation.relforcerowsecurity AS force_rls,
       policy.policyname, policy.cmd, policy.roles, policy.qual, policy.with_check
FROM pg_class AS relation
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
LEFT JOIN pg_policies AS policy
  ON policy.schemaname = schema_row.nspname AND policy.tablename = relation.relname
WHERE schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'level_assets', 'level_spots', 'game_run_level_rules',
    'game_run_score_policy', 'game_runs', 'game_run_events', 'game_sessions', 'profiles',
    'game_run_score_policy_versions', 'game_run_score_policy_approvals',
    'game_run_level_key_registry', 'game_run_rule_versions', 'game_run_feature_gates'
  )
ORDER BY relation.relname, policy.policyname;
```

```sql
SELECT has_table_privilege('authenticated', 'public.games', 'UPDATE') AS auth_has_game_table_update,
       has_column_privilege('authenticated', 'public.games', 'name', 'UPDATE') AS auth_can_update_name,
       has_column_privilege('authenticated', 'public.games', 'description', 'UPDATE') AS auth_can_update_description,
       has_column_privilege('authenticated', 'public.games', 'status', 'UPDATE') AS auth_can_update_status,
       has_column_privilege('authenticated', 'public.games', 'published_at', 'UPDATE') AS auth_can_update_published_at,
       has_table_privilege('authenticated', 'public.game_run_score_policy_versions', 'INSERT') AS auth_can_insert_policy_directly,
       has_table_privilege('authenticated', 'public.game_run_score_policy_approvals', 'INSERT') AS auth_can_insert_approval_directly;
```

Expected: No table-level Game UPDATE; intended metadata update columns true; status/published_at false; direct policy/approval INSERT false. Confirm intended RLS policies remain enabled.

ตรวจ ACL ของ `PUBLIC`, `anon`, `authenticated` และ role อื่นแบบไม่อาศัย `has_*_privilege` เพียงอย่างเดียว:

```sql
SELECT relation.relname AS table_name,
       'TABLE' AS privilege_scope,
       NULL::text AS column_name,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.privilege_type,
       acl.is_grantable
FROM pg_class AS relation
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(relation.relacl, acldefault('r', relation.relowner))
) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'level_assets', 'level_spots', 'game_run_level_rules',
    'game_run_score_policy', 'game_runs', 'game_run_events', 'game_sessions', 'profiles',
    'game_run_score_policy_versions', 'game_run_score_policy_approvals',
    'game_run_level_key_registry', 'game_run_rule_versions', 'game_run_feature_gates'
  )
  AND relation.relkind IN ('r', 'p')

UNION ALL

SELECT relation.relname AS table_name,
       'COLUMN' AS privilege_scope,
       attribute.attname AS column_name,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.privilege_type,
       acl.is_grantable
FROM pg_attribute AS attribute
JOIN pg_class AS relation ON relation.oid = attribute.attrelid
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE schema_row.nspname = 'public'
  AND relation.relname IN (
    'games', 'levels', 'level_assets', 'level_spots', 'game_run_level_rules',
    'game_run_score_policy', 'game_runs', 'game_run_events', 'game_sessions', 'profiles',
    'game_run_score_policy_versions', 'game_run_score_policy_approvals',
    'game_run_level_key_registry', 'game_run_rule_versions', 'game_run_feature_gates'
  )
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
  AND attribute.attacl IS NOT NULL
ORDER BY table_name, privilege_scope, column_name, grantee, privilege_type;
```

```sql
SELECT procedure.oid::regprocedure AS signature,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.privilege_type,
       acl.is_grantable
FROM pg_proc AS procedure
JOIN pg_namespace AS schema_row ON schema_row.oid = procedure.pronamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(procedure.proacl, acldefault('f', procedure.proowner))
) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE schema_row.nspname = 'public'
  AND procedure.proname IN (
    '_set_game_lifecycle', 'publish_game', 'unpublish_game', 'archive_game',
    'create_game_run_score_policy_version', 'approve_game_run_score_policy',
    'guard_game_lifecycle_state', 'guard_level_parent_game_published',
    'publish_level_with_runtime_rules', 'unpublish_level', 'archive_level',
    '_dynamic_game_run_response', '_dynamic_finalize_game_run', '_dynamic_mutate_game_run',
    '_legacy_start_game_run', '_legacy_record_game_run_event', '_legacy_pause_game_run',
    '_legacy_resume_game_run', '_legacy_finish_game_run', '_legacy_abandon_game_run',
    '_game_run_response', '_finalize_game_run', 'guard_game_run_identity',
    'guard_game_run_level_key', 'guard_immutable_backend_row', 'guard_level_runtime_fields',
    'guard_level_publish_state', 'guard_published_level_spot_mutation'
  )
ORDER BY signature, grantee, acl.privilege_type;
```

Expected: no `PUBLIC`/`anon` EXECUTE on mutation RPCs, `authenticated` only on intended public RPCs, and no client EXECUTE on helpers/triggers. Confirm table ACLs don't expose direct status/Policy DML even if RLS policy is permissive. Also rerun all owner, membership and effective table/column/function privilege queries from Section 3.6; compare before/after. These queries show catalog ACLs/effective role grants, not RLS row-level behavior, API JWT claims, or every external/service credential; no result is a pass until reviewed against Cloud role configuration.

```sql
SELECT trigger_row.tgname,
       relation.relname AS table_name,
       trigger_row.tgenabled,
       pg_get_triggerdef(trigger_row.oid) AS definition
FROM pg_trigger AS trigger_row
JOIN pg_class AS relation ON relation.oid = trigger_row.tgrelid
JOIN pg_namespace AS schema_row ON schema_row.oid = relation.relnamespace
WHERE schema_row.nspname = 'public'
  AND NOT trigger_row.tgisinternal
  AND trigger_row.tgname IN (
    'games_guard_lifecycle_state',
    'levels_require_published_parent_game',
    'levels_guard_publish_state_update'
  )
ORDER BY relation.relname, trigger_row.tgname;
```

### 5.3 RPC Signatures/Security/Execute

```sql
SELECT procedure.oid::regprocedure AS signature,
       procedure.proargnames,
       pg_get_function_result(procedure.oid) AS result_type,
       procedure.prosecdef AS security_definer,
       procedure.proconfig AS function_settings,
       has_function_privilege('authenticated', procedure.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon', procedure.oid, 'EXECUTE') AS anon_execute,
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
         THEN has_function_privilege('service_role', procedure.oid, 'EXECUTE')
         ELSE NULL
       END AS service_role_execute
FROM pg_proc AS procedure
JOIN pg_namespace AS schema_row ON schema_row.oid = procedure.pronamespace
WHERE schema_row.nspname = 'public'
  AND procedure.proname IN (
    'start_game_run', 'record_game_run_event', 'pause_game_run', 'resume_game_run',
    'finish_game_run', 'abandon_game_run',
    'publish_level_with_runtime_rules', 'unpublish_level', 'archive_level',
    'publish_game', 'unpublish_game', 'archive_game',
    'create_game_run_score_policy_version', 'approve_game_run_score_policy',
    '_set_game_lifecycle', '_dynamic_game_run_response', '_dynamic_finalize_game_run',
    '_dynamic_mutate_game_run', '_legacy_start_game_run', '_legacy_record_game_run_event',
    '_legacy_pause_game_run', '_legacy_resume_game_run', '_legacy_finish_game_run',
    '_legacy_abandon_game_run', '_game_run_response', '_finalize_game_run',
    'guard_game_run_identity', 'guard_game_run_level_key', 'guard_immutable_backend_row',
    'guard_level_runtime_fields', 'guard_level_publish_state',
    'guard_published_level_spot_mutation', 'guard_game_lifecycle_state',
    'guard_level_parent_game_published'
  )
ORDER BY procedure.proname, procedure.oid::regprocedure::text;
```

Expected: new public mutation RPCs are `SECURITY DEFINER`, contain `search_path=`, authenticated execution true, anon false; helper/trigger functions are not granted to clients. Verify argument names exactly match Frontend contracts (`p_game_id`, `p_level_id`, policy arguments above). `has_function_privilege` doesn't represent `PUBLIC` separately; inspect `proacl`/`aclexplode` if anon/authenticated results or ownership defaults are unexpected.

### 5.4 Parent/Policy/Gate/Identity/History

```sql
SELECT gate_name, is_enabled
FROM public.game_run_feature_gates
ORDER BY gate_name;
```

Expected: `dynamic_gameplay = false`. Any missing row or `true` is a hard stop; do not update it here.

```sql
SELECT policy.id, policy.version, policy.created_by, policy.created_at,
       approval.approved_by, approval.approved_at, approval.approval_note
FROM public.game_run_score_policy_versions AS policy
LEFT JOIN public.game_run_score_policy_approvals AS approval
  ON approval.policy_id = policy.id
ORDER BY policy.created_at, policy.version;
```

Expected immediately after migration: no new policy or approval rows. Before any Dynamic Publish/Run, separately authorized policy rows must show an exact approval tied to that policy ID/version; the Legacy singleton is not evidence.

```sql
SELECT level.level_key, game.status AS game_status, level.status AS level_status,
       level.published_at
FROM public.levels AS level
JOIN public.games AS game ON game.id = level.game_id
WHERE level.status = 'published'
  AND game.status <> 'published'
ORDER BY level.level_key;
```

Expected: zero rows before Playable release. If rows exist, they are hidden by Player filtering; investigate and use approved lifecycle RPCs, not direct status updates.

```sql
SELECT count(*) AS invalid_dynamic_run_identity_rows
FROM public.game_runs AS run
WHERE (run.level_id IS NOT NULL AND (run.content_level_id IS NOT NULL OR run.rule_version_id IS NOT NULL))
   OR (run.level_id IS NULL AND (run.content_level_id IS NULL OR run.rule_version_id IS NULL));
```

```sql
SELECT count(*) AS invalid_dynamic_session_identity_rows
FROM public.game_sessions AS session
WHERE (session.content_level_id IS NULL AND (session.level_key IS NOT NULL OR session.rule_version_id IS NOT NULL))
   OR (session.content_level_id IS NOT NULL AND (
        session.level_key IS NULL OR session.rule_version_id IS NULL OR session.level_id <> session.level_key
      ));
```

Expected: zero malformed rows. Legacy rows remain `content_level_id`, `level_key`, `rule_version_id` NULL.

```sql
SELECT level_id, max_duration_seconds, spot_ids, max_hints
FROM public.game_run_level_rules
ORDER BY level_id;

SELECT count(*) AS legacy_run_count
FROM public.game_runs
WHERE level_id IN (
  'cozy-cat-corner', 'sunny-picnic', 'balloon-hills', 'greenhouse-garden',
  'bakery-breeze', 'night-train', 'stormy-shelf', 'forest-fable'
);

SELECT count(*) AS legacy_session_count
FROM public.game_sessions
WHERE level_id IN (
  'cozy-cat-corner', 'sunny-picnic', 'balloon-hills', 'greenhouse-garden',
  'bakery-breeze', 'night-train', 'stormy-shelf', 'forest-fable'
)
  AND content_level_id IS NULL;
```

Compare Legacy rules and counts with the pre-Apply snapshot. Any reduction/change is a stop; this migration is not intended to update or backfill Legacy data.

## 6. Dynamic Run Contract Matrix

| Operation | Existing signature (migration 100) | Required behavior / verification |
|---|---|---|
| Start | `start_game_run(p_level_id text, p_request_id uuid)` | Auth user; idempotency checked; reserved Legacy IDs route only Legacy; Dynamic routes only when gate on, key registered, Game/Level Published, latest immutable Rule Version and matching Dynamic Approval exist; insert NULL Legacy ID plus content UUID/version UUID; first event number 1 |
| Event | `record_game_run_event(p_run_id uuid,p_request_id uuid,p_event_type text,p_spot_id text DEFAULT NULL)` | Owner lock; same request/payload idempotent, changed payload rejected; sequential event number; spot key membership/hint limit from pinned snapshot; timeout finalization uses same request data |
| Pause | `pause_game_run(p_run_id uuid,p_request_id uuid)` | Owner/state validation, event idempotency/numbering, elapsed time uses pinned duration; timeout doesn't pause past expiry |
| Resume | `resume_game_run(p_run_id uuid,p_request_id uuid)` | Only paused runs; preserves existing timeout request guard and pinned rules; event sequence increments once |
| Finish | `finish_game_run(p_run_id uuid)` | Owner lock and terminal idempotency; server computes score; Win requires pinned Dynamic Policy approval; atomic session/profile/run/event persistence. No request ID in current signature; concurrency tests required |
| Abandon | `abandon_game_run(p_run_id uuid,p_request_id uuid)` | Owner/state lock, timeout guard/idempotency, pinned rules and ordered event |

This Draft does not change those signatures. Do not call the Dual-path RPC from Dynamic Player UI until DB migrations are present and verified, since the text parameter is not a typed identity boundary. Keep the Frontend Legacy-only builder and feature guard. End-to-end tests must prove the reserved-key constraints and response tuple are effective in the deployed Cloud.

## 7. Legacy Content Checklist

IDs and expected rule values below are from repository migration `20261004010000_phase_2b_game_runs.sql`; they are **not** evidence that production images/geometry exist. Duration and `spot_ids` are Legacy Runtime Rules; image/coordinates are unverified. `max_hints` defaults to 3 in that table definition.

| Legacy ID | Rule: duration / max hints / spot IDs | Original image pair | Dimensions/aspect ratio | Spot geometry/coordinates | Source of truth / status |
|---|---|---|---|---|---|
| `cozy-cat-corner` | 120s / 3 / `window`, `plant`, `teapot` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |
| `sunny-picnic` | 120s / 3 / `umbrella`, `flower`, `basket` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |
| `balloon-hills` | 120s / 3 / `balloon`, `hill`, `kite` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |
| `greenhouse-garden` | 90s / 3 / `window`, `plant`, `lamp`, `bench`, `vase` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |
| `bakery-breeze` | 90s / 3 / `window`, `plant`, `lamp`, `bench`, `vase` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |
| `night-train` | 90s / 3 / `window`, `plant`, `lamp`, `bench`, `vase` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |
| `stormy-shelf` | 60s / 3 / `window`, `plant`, `lamp`, `book`, `frame`, `mug`, `chair` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |
| `forest-fable` | 60s / 3 / `window`, `plant`, `lamp`, `book`, `frame`, `mug`, `chair` | Owner to supply | Unknown | Missing | Legacy rule in migration; visual source missing |

For each row, the content owner must deliver: immutable source/ownership reference; both original images; exact pixel dimensions and aspect ratio; canonical spot IDs matching the Legacy rule; each spot shape and normalized center/dimensions/radius/tolerance measured against those exact images; review evidence and a mapping sign-off. Do not reuse Dynamic `level_spots` geometry or match by labels without proof. No checklist row is Ready today.

## 8. Exact Release Runbook

ดำเนินการตามลำดับนี้ใน Staging ก่อน Production. Section 5 Full Verification ใช้หลัง Forward Migration เท่านั้น; ใช้ Migration Checkpoints ใน Section 5 ตามหลังแต่ละ dependency migration

| Step | Action | Expected result | Stop condition | Evidence to record |
|---|---|---|---|---|
| 1. Repository + Cloud History | บันทึก `git status`, migration files/hash, Cloud migration history และ read-only schema inventory; เทียบกับ Baseline | ระบุได้ว่า Cloud มี 040–050 และสถานะ 080–110 จริงแบบใด | มี migration ที่ไม่รู้จัก, partial apply, schema drift, หรือไฟล์ SQL เปลี่ยนจาก approved source | Git status, migration history output, inventory output, เวลา/ผู้ตรวจ |
| 2. Version Allocation | ในวันที่อนุมัติจริง เปรียบเทียบ version สูงสุดใน Repo/Cloud แล้วจอง UTC timestamp ที่ไม่ซ้ำและไม่เป็นอนาคต; แยกจากการ Review SQL Draft | มี version candidate และ release ticket ที่อ้างอิงเลขจริงหลัง `20261011000000` | ยังไม่ถึงวันที่ใช้ version ได้, Cloud มีเลขสูงกว่า, เลขซ้ำ, หรือ migration history ยังไม่ reconcile | ผลตรวจ Repo/Cloud, timestamp UTC, ticket และผู้จัดสรร; ห้ามสร้าง migration file ในขั้นนี้ |
| 3. Preflight | ผู้ตรวจที่มีสิทธิ์อ่านรันเฉพาะ Section 3 ใน Staging; ถ้า 080–110 ยังไม่ครบ ให้ใช้ inventory/history และหยุดก่อน query ที่ต้องอาศัยตารางซึ่งยังไม่มี | 040–050 และ effective privileges/schema baseline ตรงกับที่คาด; schema drift และ role membership ถูกเปิดเผย | role/owner/trigger collision, ACL ไม่ทราบที่มา, history/schema ไม่ตรง, หรือมี data ที่กระทบ constraints | SQL text/version ที่รัน, output เต็ม, actor, environment และผล compare; Query เป็น read-only เท่านั้น |
| 4. Human Technical Approval | DB/Security Owner review SQL Draft, dependencies, Owner/RLS, role inheritance, lock order, Policy two-person rule; Frontend Owner review Game response Adapter; Release Owner ยอมรับ Stop Conditions | มี approval แยกตาม DB/Security/Frontend/Release และ version candidate ยังไม่ถูก Apply | unresolved ACL/owner, response contract, policy bounds, Game semantics หรือ Gate-operation contract | reviewer identities, comments, decision/ticket IDs, approved Draft hash/version |
| 5. Apply 080 ใน Staging | หลังอนุมัติ ใช้ migration process มาตรฐานกับ migration เดิมโดยไม่แก้ไฟล์ | Catalog tables, columns, RLS/policies จาก 080 ถูกสร้าง; Gate ยังไม่มี/ไม่เปิด | Apply error, existing object conflict หรือ data/state ไม่ตรง Preflight | migration log/version; รันเฉพาะ Checkpoint 080 ใน Section 5 และเก็บ output |
| 6. Verify 080 | ตรวจ content tables/columns, policies, RLS และ baseline rows ตาม Checkpoint 080 | ทุก object จาก migration 080 ตรง Source; ไม่มี run/policy assumptions จาก migration ถัดไป | missing/extra object, policy/RLS mismatch หรือ data change | Query results, constraint/policy diff และ Legacy snapshot |
| 7. Apply + Verify 090 | Apply migration 090 ใน Staging; แล้วรัน Checkpoint 090 เท่านั้น | Rule/Policy/Registry tables, validated identity constraints และ Level lifecycle RPCs ตรง Source; ยังไม่มี Game lifecycle RPC; Game table-level UPDATE ตาม 090 ยังมีจน Proposed Migration | Apply error, pre-existing name/constraint collision, unapproved policy row/approval หรือ identity/history change | migration output, function signatures/ACL, constraint validation, rules/approval row counts |
| 8. Apply + Verify 100 | Apply migration 100; รัน Checkpoint 100 | Dual-path wrappers/helpers อยู่ตาม contract; `dynamic_gameplay=false`; internal helpers execute ไม่ได้จาก client roles | Gate เปิด, function signature/ACL ไม่ตรง, legacy behavior เปลี่ยน, หรือ helper public | feature-gate row, wrapper/helper ACL/signatures, Legacy rule/run baseline |
| 9. Apply + Verify 110 | Apply migration 110; รัน Checkpoint 110 | `game_sessions_content_level_key_fk` มีและ `convalidated=true`; Legacy rows ไม่ถูก rewrite | FK validation ล้ม, orphan identity, Legacy count/data ต่างจาก snapshot | constraint definition/validation result และ Legacy row counts |
| 10. Apply Proposed Forward Migration | หลัง Checkpoints 080–110 ผ่านและได้รับอนุมัติ SQL/version แยก ให้ Apply Draft ใน Staging | Game/Policy RPCs/triggers/grants ครบ; Game/Level statuses ใช้ lifecycle RPC; Gate ยังคงปิด | precondition fail, DDL/function error, privilege/owner mismatch, หรือ Gate เปลี่ยน | migration log, exact SQL hash/version, operator, transaction result; error ใด ๆ ให้หยุดและรักษาหลักฐาน |
| 11. Full Post-Apply Verification | รัน Full Section 5 หนึ่งครั้งหลัง Step 10; rerun ownership, memberships และ effective privileges จาก 3.6 | signatures, RLS, ACL, constraints, gate, identity และ Legacy counts ผ่านทั้งหมด | query ใดผิดคาด, `PUBLIC`/client privilege เกิน, helper เปิด, invalid identity หรือ gate ไม่ false | output เต็มทุก query, expected-vs-actual, actor/time; Static Review ไม่แทนผลนี้ |
| 12. Security + Concurrency Tests | ใน Staging ทดสอบ unauthorized/anon/authenticated/service_role paths, policy self-approval, duplicate approvals, direct status DML, Game/Level publish races, lock order, concurrent run events/finish และ RLS owner isolation | denied operations ถูกปฏิเสธ; valid operations atomic/idempotent; ไม่มี deadlock/data loss | privilege bypass, cross-user read/write, approval mismatch, race, duplicate session/profile aggregate หรือ lock timeout | test suite/version, role/JWT claims, concurrency traces, results และ incident logs |
| 13. Content + Policy Readiness | Owner ส่ง Original image pairs/geometry/source sign-off; Admin สร้าง Dynamic Policy version; คนละ Admin อนุมัติผ่าน reviewed RPC; ไม่สร้าง Legacy mapping จากชื่อ | content checklist ครบและมี immutable source; exact Dynamic Approval row/audit note; Legacy policy แยกจาก Dynamic | assets/geometry/ownership missing, self-approval, policy bounds ไม่อนุมัติ, หรือไม่มี audit evidence | asset hashes/dimensions, geometry review, policy ID/version/weights, creator/approver/note, ticket |
| 14. Legacy Regression | ทดสอบ 8 Legacy IDs กับ authoritative assets/coordinates/rules, start/events/pause/resume/timeout/finish/abandon, score/session/profile/history; เปรียบเทียบ counts ก่อน/หลัง | Legacy identity/rules/history/aggregates ไม่เปลี่ยน | ภาพ/geometry ไม่ authoritative, behavior/scoring เปลี่ยน หรือ historical counts ต่าง | test report, source-owner sign-off, pre/post row counts และ sample identity audit |
| 15. Dynamic Staging E2E | ทำได้เมื่อมี Gate-operation contract ที่อนุมัติแล้วเท่านั้น; Gate เปิดเฉพาะ Staging โดย Operator ที่ระบุใน change ticket; ทดสอบ publish/start/event numbering/idempotency/pause/resume/timeout/finish/abandon/history | run pins content UUID + rule version; approval/score/server validation/session persistence ถูกต้อง; ปิด Gate หลัง E2E | ยังไม่มี safe Gate operation, policy missing, runtime mismatch, auth/RLS leak, race หรือ score/session mismatch | operator/approvers, before/after gate state, RPC responses, tests, audit trail; ถ้าพบปัญหาให้ปิด Gate ผ่านกลไกที่อนุมัติและหยุด |
| 16. Deployment Approval | Release Owner ทบทวนทุก Evidence, compatibility adapter, migration history และ rollback/forward plan; deploy เฉพาะเมื่ออนุมัติแยกและ Production Gate ยังคงปิด | compatible app/schema ถูก deploy; health checks ผ่าน | evidence หาย, baseline/schema mismatch, unresolved Source contract หรือไม่มี deployment approval | release ticket, artifact/build ID, approvers, health checks, production gate state=false |
| 17. Gate Approval + Activation | ต้องมี Gate-operation authorization/audit contract ก่อน; Release + Security/DB Owner อนุมัติแยก, named Operator เปิด Production เป็นขั้นสุดท้ายหลัง health check | Gate เปิดเมื่อ activation gates ทั้งหกมี evidence; operator บันทึก before/after | ไม่มี safe mechanism, approval/audit ขาด, gate state ไม่รู้, หรือ gate ใดไม่ผ่าน | ticket, operator identity, two-party approvals, UTC time, reason, build ID, before/after state; rollback คือปิด Gate ผ่านกลไกเดียวกันที่อนุมัติแล้วและคง Runs/History |

**Current Gate Blocker:** Repository ไม่มี Gate-management RPC และ migration 100 revoke table access จาก client roles. จนกว่าจะอนุมัติและติดตั้ง operator mechanism แยกต่างหาก ให้ถือว่า Step 15 และ 17 ทำไม่ได้; ห้ามใช้ direct SQL/Dashboard/service key โดยอนุมาน

**Six activation gates:** (1) Dynamic Content Publish ผ่าน RPC; (2) Runtime Rule Version bind กับ Run; (3) Dynamic Policy Approval มี audit; (4) server-side score/validation ผ่าน; (5) Legacy Regression ผ่าน; (6) Cloud schema/RPC/RLS/grants verification ผ่าน. Production Ready ได้เมื่อมี Runtime Evidence จริงครบทุกข้อเท่านั้น

## 9. Open Approvals Before a Real Migration

1. Confirm proposed Game lifecycle transition semantics, especially archived behavior and the requirement that each Published child Level be explicitly unpublished/archived before Game Unpublish/Archive (Draft does not cascade).
2. Approve the two-person Policy rule and authorized Admin provisioning process. Define acceptable policy weight bounds before creating a Production Policy; Source constraints alone only require non-negative integers.
3. Confirm whether production Publish requires primary artwork. Migration 090 has a TODO and currently does not require it; content cannot be considered playable without original images regardless.
4. Confirm the DB-visible `app_metadata.role = 'admin'` is the authorized Admin signal for all new RPCs, and review whether `SECURITY DEFINER` ownership/RLS assumptions match deployed privileges.
5. Decide whether the existing dual-path text parameter is acceptable after post-apply proof or whether a separately versioned typed Dynamic RPC is required. No RPC signature is changed in this Draft.
6. Confirm migration schedule after `20261011000000`; a real numeric version cannot be chosen without an approved date later than that pending migration ID.
7. Approve a staging-only procedure for temporarily enabling the Feature Gate during E2E. This Draft contains no gate update and does not authorize any enablement.

## 10. Safety Record

- This file is a review artifact, not an executable migration and not evidence of Cloud readiness.
- No SQL/Migration/Seed/pgTAP was executed; all SQL in Sections 3 and 5 is read-only query text; Section 4 is a proposed DDL draft only.
- No Supabase/Vercel connection, Dashboard, Auth, RLS, Grants, Secrets, or Feature Gate was changed.
- No Source/Tests, existing migration, Lockfile, Production data, migration history, Git branch, commit, or deployment was changed.
