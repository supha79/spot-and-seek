# Backend Run Compatibility Design

สถานะเอกสาร: Baseline ก่อน implementation รอบปัจจุบัน; ยังไม่มีการยืนยันว่า migrations ถูก apply หรือทดสอบกับฐานข้อมูลใด

Implementation update (local repository only): pending migrations are now ordered as `20261009133000`, `20261009133001`, and `20261009133004` after `20261009000000`; the last adds Game/Level lifecycle enforcement and score-policy RPC/audit workflow. Game lifecycle and Admin policy UI now call those RPC contracts, Dynamic run start sends a tagged level key through the existing dual-path RPC, and gameplay uses the published hint limit. `supabase/seed.sql` performs no writes. No Cloud, migration, or pgTAP execution occurred; use the migration files and current source as authoritative over the historical analysis below.

เอกสารนี้แยก **สถานะที่ยืนยันได้จาก source ใน repository** ออกจาก **แบบที่เสนอ** และระบุข้อที่ตรวจยืนยันกับฐานข้อมูลที่ deploy จริงไม่ได้ไว้ตรง ๆ

## 1. Current State ตามโค้ด

### 1.1 Migrations ที่ตรวจ

ตรวจ migration ทั้งแปดไฟล์ใน `supabase/migrations/`:

- `20261004000000_phase_2a_database_foundation.sql`
- `20261004010000_phase_2b_game_runs.sql`
- `20261005000000_phase_2b_resume_timeout_request_guard.sql`
- `20261008000000_game_content_foundation.sql`
- `20261009000000_backend_run_compatibility_foundation_publish.sql`
- `20261009133000_dynamic_run_dual_path.sql`
- `20261009133001_game_session_level_key_identity_guard.sql`
- `20261009133004_lifecycle_and_score_policy_rpcs.sql` (ไฟล์ใน repository; ไม่มีการยืนยันว่า apply)

Migration 20261009000000 สร้าง immutable score-policy/rule-version tables, key registry, identity columns และ Level publish RPCs; 20261009133000 เปลี่ยนชื่อ legacy run RPCs แล้วเพิ่ม wrappers ที่คง public contract; 20261009133001 เพิ่ม FK เชื่อม `(game_sessions.content_level_id, level_key)` กับ key registry; 20261009133004 เพิ่ม Game/Level lifecycle guards และ score-policy workflow RPCs

### 1.2 ตารางและ constraints ที่มีจริง

| ตาราง | โครงสร้าง/ข้อจำกัดที่เกี่ยวข้อง |
|---|---|
| `game_run_level_rules` | `level_id text PRIMARY KEY`; CHECK จำกัดเฉพาะ 8 legacy keys; เก็บ `max_duration_seconds`, `spot_ids text[]`, `max_hints`; duration ต้องบวก, spots ต้องไม่ว่าง/ไม่มี NULL, hints 0..3 |
| `game_run_score_policy` | singleton ด้วย `policy_id boolean PRIMARY KEY DEFAULT true CHECK (policy_id)`; `version`, `time_weight`, `wrong_click_penalty`, `hint_penalty`, approval fields; migration seed เป็น `proposed-v1`, `is_approved=false` |
| `game_runs` | Legacy ใช้ `level_id` ที่อ้าง `game_run_level_rules`; migration 20261009000000 ทำให้ nullable และเพิ่ม dynamic identity `content_level_id + rule_version_id`, composite FK ไป rule version และ CHECK บังคับเลือก legacy หรือ dynamic shape; `session_id` ยัง unique/FK เดิม |
| `game_run_events` | FK `run_id` ไป `game_runs ON DELETE CASCADE`; `spot_id text`; event type/spot-shape CHECK; unique `(run_id,event_request_id)`, `(run_id,event_number)` และ partial unique `(run_id,spot_id)` สำหรับ `spot_found` |
| `game_sessions` | `level_id text NOT NULL` ยังเป็น legacy-compatible text; migration เพิ่ม nullable `content_level_id`, `level_key`, `rule_version_id`, CHECK ของ dynamic shape และ composite FK ไป pinned rule version; migration 20261009133001 เพิ่ม composite FK จาก `(content_level_id, level_key)` ไป key registry; legacy rows ที่คอลัมน์ใหม่เป็น NULL ยัง valid |
| `game_run_level_key_registry` | Global permanent key mapping; unique `(content_level_id, level_key)` candidate key, content UUID unique, lowercase slug CHECK และ legacy-key reservation |
| `game_run_rule_versions` | Immutable runtime snapshot; unique `(content_level_id, version)` และ `(id, content_level_id)`; snapshot ผูกกับ registry และ versioned score policy |
| `game_run_score_policy_versions` / `game_run_score_policy_approvals` | Versioned immutable policy definition และ append-only approval rows; migrations ไม่สร้าง approval ให้ policy |
| `games` | UUID `id`, unique `slug`, status draft/published/archived และ published-state CHECK |
| `levels` | UUID `id`, FK `game_id`; `level_key text NOT NULL UNIQUE CHECK (btrim(level_key) <> '')`; difficulty/status CHECK; duration >0, hints 0..3; `version integer`; migration 20261009000000 guards lowercase/global collisions and prevents changing a registered key after first publish |
| `level_assets` | FK `level_id -> levels(id) ON DELETE CASCADE`; asset type original/thumbnail; unique `(level_id,asset_type,storage_path)`; unique primary asset ต่อ level ผ่าน partial index |
| `level_spots` | UUID `id`; FK `level_id -> levels(id) ON DELETE CASCADE`; `spot_key text`; unique `(level_id,spot_key)`; geometry/tolerance/score CHECKs; `score_value` default 100; ไม่มี snapshot/history relation กับ runs |

`game_run_level_rules` มี seed 8 keys: `cozy-cat-corner`, `sunny-picnic`, `balloon-hills`, `greenhouse-garden`, `bakery-breeze`, `night-train`, `stormy-shelf`, `forest-fable`. Migration CHECK ปิดกั้น key อื่น แม้จะเพิ่ม row ด้วย client ก็ตาม

### 1.3 RPC signatures, behavior, security

Signatures ตาม migrations (ทุกตัวคืน `jsonb`):

- `start_game_run(p_level_id text, p_request_id uuid)`
- `record_game_run_event(p_run_id uuid, p_request_id uuid, p_event_type text, p_spot_id text DEFAULT NULL)`
- `pause_game_run(p_run_id uuid, p_request_id uuid)`
- `resume_game_run(p_run_id uuid, p_request_id uuid)`
- `finish_game_run(p_run_id uuid)`
- `abandon_game_run(p_run_id uuid, p_request_id uuid)`
- Internal helpers: `_game_run_response(p_run_id uuid)`, `_finalize_game_run(p_run_id uuid, p_user_id uuid, p_timeout_request_id uuid DEFAULT NULL, p_timeout_request_type text DEFAULT NULL, p_timeout_request_spot_id text DEFAULT NULL)`

Run RPCs และ helpers เป็น `SECURITY DEFINER` และกำหนด `SET search_path = ''`; อ้าง object ด้วย `public.` และตรวจ `auth.uid()` ใน user RPCs. `start`, event, pause/resume/abandon ใช้ request UUID ทำ idempotency; event/lifecycle ล็อก run ด้วย `FOR UPDATE` และตรวจ ownership ผ่าน `user_id`. `finish_game_run` ไม่มี request ID; finalize ตรวจ terminal state และคืน response เดิมเมื่อจบแล้ว

`start_game_run` ตรวจ `p_level_id` ว่ามีใน `game_run_level_rules` ก่อน insert. `_game_run_response`, `_finalize_game_run`, record, pause และ abandon อ่าน duration/spot count/hints จาก legacy rules; `record_game_run_event` ตรวจ `p_spot_id = ANY(spot_ids)`. Finalize คำนวณคะแนนจาก policy singleton ที่ approved เท่านั้น: `time_weight * remaining / max_duration - wrong_click_penalty * wrong_click_count - hint_penalty * hint_count`, clamp ขั้นต่ำเป็น 0; ถ้าไม่มี approved policy การชนะจะ error. Loss ได้คะแนน 0. `game_sessions.level_id` ถูกเติมด้วย `game_runs.level_id`.

`20261005000000_phase_2b_resume_timeout_request_guard.sql` replace `resume_game_run` เพื่อกัน request ID ที่ตรงกับ timeout-triggering request; signature เดิมยังอยู่
Legacy branch ของ RPCs ด้านบนยังอ่าน rules/policy เดิม. Migration 20261009133000 คง body เหล่านั้นไว้ใต้ `_legacy_*` และเพิ่ม wrappers public signature เดิม; run ที่มี `rule_version_id` dispatch ไป dynamic path ซึ่งอ่าน runtime snapshot ที่ pin ไว้.
Migration 20261009133000 renames implementations to `_legacy_*` and creates public wrappers with the same names, argument names/types/defaults, and `jsonb` return types. The wrappers dispatch by pinned `rule_version_id`; the dynamic feature gate defaults to disabled. Static review compared signatures with the previous migrations; no catalog/runtime verification was performed.

สิทธิ์ที่ migrations ระบุ: revoke `PUBLIC, anon, authenticated` จาก helpers และให้ `EXECUTE` เฉพาะ authenticated บน public run RPCs. ตาราง `game_runs`, `game_run_events`, `game_sessions`, `profiles`, rules และ policy เปิด RLS ตาม migrations; run/session SELECT policy จำกัด owner หรือ `auth.jwt()->'app_metadata'->>'role' = 'admin'`. Rules/policy tables revoke table access ทั้งหมดและไม่มี client policy.

Content tables เปิด RLS และมี published/admin policies. Migration 20261008000000 ถอน table privileges; migration 20261009000000 เพิ่ม grants ให้ authenticated สำหรับ CRUD ที่กำหนดบน games/assets/spots และ limited column updates บน levels โดยยังกัน direct update ของ status, published_at และ level_key. การมี grant ไม่ข้าม RLS; effective privileges ของฐานข้อมูลที่ deploy แล้วไม่ได้ตรวจเพราะไม่มีการเชื่อมต่อ catalog.

### 1.4 Content publish และ frontend จริง

- `src/services/content.ts`: `publishLevel(id)` โหลด `title`, `difficulty`, `max_duration_seconds`, นับ active spots, ตรวจ title/difficulty/duration/spot count ขั้นต่ำ แล้ว `UPDATE levels` เป็น published โดยตรง. ไม่มี RPC, transaction ร่วมกับ compile, ตรวจ asset หรือ compile/hash runtime rules. `publishGame` ก็ update status โดยตรง
- Level key ถูกสร้างใน frontend จาก title เป็น normalized slug, สงวน 8 legacy keys และ keys ที่มีอยู่; migration 20261009000000 เพิ่ม DB guard สำหรับ lowercase/global collisions, reserved legacy keys และ immutable registry key หลัง publish ครั้งแรก
- `src/services/playerContent.ts` โหลด published level จาก UUID `levels.id` และ active `level_spots`; ตรวจ geometry บางส่วนใน client. `GameDataContext` เก็บ `id = levels.id` และ `levelKey = levels.level_key`
- `GamePlay` resolve route param ด้วย `levels[].id`, โหลด live content โดย `levels.id`, map `spot_key` เป็น `SpotConfig.id`, แล้วส่ง `startGameRun(level.levelKey || level.id, requestId)`. `recordGameRunEvent(..., 'spot_found', spot.id)` จึงส่ง `spot_key` (ไม่ใช่ `level_spots.id` UUID). Client key ยังไม่ใช่ authority; RPC ต้อง validate against pinned server-side rule
- `src/services/gameRuns.ts` เรียก RPC ตาม signature ข้างต้น; `finish_game_run` รับแค่ run ID. Snapshot parser คาด `level_id` เป็น string และ UI ใช้ counters/status จาก server
- SQL migrations implement atomic compile/publish และ pinned dual-path RPC แล้ว แต่ frontend ยังไม่เรียก lifecycle RPCs

### 1.5 History / Stats / Replay ตาม frontend

- `game_sessions.level_id` เป็น text: legacy finalization เก็บ legacy key ส่วน dynamic finalization เก็บ pinned `level_key`; `content_level_id` แยกเป็น UUID. ห้ามตีความ `level_id` เป็น UUID
- `GameDataContext` ดึง `game_sessions(id, level_id, score, result, played_at)` แล้วจับคู่ด้วย `levels.find(item => item.id === session.level_id)`. นี่เทียบ key กับ UUID จึงไม่ match สำหรับ key-format rows; fallback เป็น raw key
- `HistoryDetail` สร้าง replay URL ด้วย `entry.levelId`; route ของ `GamePlay` ค้น level ด้วย UUID (`levels[].id`) จึง replay จาก `game_sessions.level_id` ที่เป็น key ไม่พบ level ตามโค้ดปัจจุบัน
- Profile stats นับ distinct `game_runs.level_id` สำหรับ levels completed; ไม่ได้ join `levels.id`
- `src/services/adminDashboard.ts` ไม่ join `levels`; ใช้ hardcoded map ของ 8 legacy keys เพื่อคำนวณ difficulty/recent-play title. จึงรองรับ legacy keys เท่านั้น; dynamic keys จะเป็น unknown. นี่เป็น static mapping ไม่ใช่ UUID join
- ไม่พบ replay/event service ที่อ่าน `game_run_events` ใน frontend; HistoryDetail แจ้งว่า duration/event details ยังไม่ถูกโหลด

**สถานะ frontend ที่ยังไม่เปลี่ยนใน Phase 1:** History join/replay ยังมี key-versus-UUID mismatch และ admin dashboard ยังใช้ legacy key map. Content reads ใช้ published UUID/key data; publish lifecycle และ run services ยังไม่ได้เชื่อมกับ RPC ใหม่. ส่วน SQL migrations สำหรับ snapshots และ dual-path RPCs มีอยู่แล้วตามรายการด้านบน.

## 2. Schema ที่ใช้จริงและความต่างจากข้อเสนอเดิม

Migrations 20261009000000 และ 20261009133000 implement tables, identity columns, compile/publish RPCs และ dual-path run RPCs; 20261009133001 เพิ่ม session key FK และ 20261009133004 เพิ่ม Game/Level lifecycle กับ score-policy RPCs. หัวข้อย่อยด้านล่างเก็บ design rationale เดิมและไม่ใช่คำอธิบาย schema ปัจจุบันเมื่อมีความต่าง; ให้ยึด SQL ใน `supabase/migrations/` เป็น source of truth.

### 2.1 `game_run_rule_versions`

เพิ่มตาราง immutable snapshot โดยอย่างน้อยมี:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `content_level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT`
- `version integer NOT NULL CHECK (version >= 1)` และ `UNIQUE (content_level_id, version)`
- `level_key text NOT NULL`; global unique constraint/index เพื่อ resolve start input อย่างชัดเจน
- Snapshot ของ `title`, `difficulty`, `max_duration_seconds`, `max_hints`
- `active_spots jsonb NOT NULL`: canonical array ของ `spot_key` และ runtime geometry (`shape`, normalized coordinates/dimensions/radius, `tolerance_norm`); ถ้า scoring ใช้ spot weight ให้รวม `score_value` ด้วย
- `score_policy_version text NOT NULL` และควรเก็บตัวเลข policy ที่ใช้จริงใน snapshot หรือ FK ไป approved immutable policy-version table; ไม่ชี้ไป singleton ที่แก้ค่าได้โดยหวังให้เป็น historical snapshot
- `content_hash text NOT NULL` (เช่น SHA-256 ของ canonical JSON ที่กำหนด field/order ชัดเจน)
- `created_at timestamptz NOT NULL`, `created_by uuid REFERENCES auth.users(id)`, optional `published_at`
- `UNIQUE (id, content_level_id)` เพื่อให้ FK composite จาก run ยืนยันว่า version เป็นของ content level เดียวกัน

กำหนด version ด้วย transaction/row lock; ห้าม UPDATE/DELETE หลัง insert ผ่าน trigger ที่ reject เสมอ, ไม่มี DML grants ให้ client, RLS enabled/deny client policies. Table owner/migration role ยังคงเป็น trust boundary; trigger เป็น guard สำคัญแม้ RLS เปิดอยู่. Admin อ่านผ่าน RPC/view ที่จำเป็นเท่านั้น

### 2.2 เพิ่ม references บน run/session

เพิ่มบน `game_runs`:

- `content_level_id uuid NULL REFERENCES public.levels(id) ON DELETE RESTRICT`
- `rule_version_id uuid NULL`
- composite FK `(rule_version_id, content_level_id) -> game_run_rule_versions(id, content_level_id)`; เพิ่ม unique target `(id, content_level_id)` ตามด้านบน
- CHECK ให้ `rule_version_id` และ `content_level_id` เป็น NULL พร้อมกัน; NULL ทั้งคู่หมายถึง legacy path

เพิ่มบน `game_sessions` แบบ nullable สำหรับ history เดิม: `content_level_id uuid`, `level_key text`, `rule_version_id uuid`; เก็บค่าจาก run/version ตอน finalize. เพิ่ม FK ที่เหมาะสมแบบ `ON DELETE RESTRICT` (sessions ไม่มีการลบ content ที่อ้างถึง) และ index สำหรับ history. เก็บ `game_sessions.level_id` เป็น legacy-compatible key ต่อไปก่อน; ห้ามตีความเป็น UUID. ไม่ backfill/แก้ historical rows โดยไม่มีแผนและหลักฐาน mapping

### 2.3 `game_runs.level_id` FK ปัจจุบัน

การคง `level_id NOT NULL` และ FK ไป `game_run_level_rules` แบบเดิมทุกประการ **ทำให้ dynamic run ที่ไม่มี legacy rule insert ไม่ได้**. ห้ามใส่ legacy sentinel key เพราะจะทำให้ identity/analytics ผิด

ข้อเสนอที่เปลี่ยนน้อยที่สุดและไม่ลบ legacy constraint/data: ผ่อน `game_runs.level_id` ให้ nullable แต่คง FK `REFERENCES game_run_level_rules(level_id)` ไว้. Legacy runs ยังคงเก็บ key เดิมและผ่าน FK; dynamic runs เก็บ `level_id = NULL` และใช้ `content_level_id + rule_version_id` เป็น identity/rules. เพิ่ม CHECK ให้ run ต้องอยู่ในหนึ่งในสองรูปแบบนี้. API response ของ dynamic run อาจคืน version `level_key` ใน field `level_id` เพื่อความเข้ากันได้ชั่วคราว แต่ควรเพิ่ม field ใหม่ที่ชัดเจนและเปลี่ยน frontend

การผ่อน NOT NULL เป็นการเปลี่ยน constraint ของ schema จึงไม่ใช่ “add column อย่างเดียว” ตามตัวอักษร แต่จำเป็นถ้าจะใช้ `game_runs` เดิมและเก็บ FK/legacy rows. ทางเลือกที่ไม่แตะ constraint เดิมคือสร้าง run table ใหม่ ซึ่งเพิ่มความซับซ้อน/แยก lifecycle; ต้องให้ owner ตัดสินใจก่อน implementation หากคำว่า additive-only ห้ามแม้แต่ relax NOT NULL

## 3. Level key policy

- Canonicalize เป็น lowercase slug ที่มีรูปแบบแน่นอน (เช่น `[a-z0-9]+(?:-[a-z0-9]+)*`); enforce ที่ DB, ไม่พึ่ง helper frontend
- Unique แบบ case-insensitive/global และ reserve 8 legacy keys ตลอดไป; legacy IDs/rules ไม่ rename/delete
- Immutable ตั้งแต่ publish ครั้งแรก แม้ unpublish/archive; หากต้องเปลี่ยน slug ให้ถือเป็น content identity ใหม่และให้ owner กำหนด alias policy
- ห้ามเปลี่ยน `level_key` ระหว่าง publish; transaction compile ต้องตรวจ collision ทั้ง `levels` และ legacy keys
- Spot keys unique ต่อ level อยู่แล้ว แต่เพิ่ม validation รูปแบบ/trim และปฏิเสธ duplicate หลัง canonicalization หากเลือก case-insensitive keys
- ถ้า key ตรงกับ legacy ID และมี content level ด้วย ต้องมี precedence ที่ตายตัว: แนะนำให้ compile/publish legacy content identity ก่อนเปิด start แบบ unified; published content ที่ไม่มี rule version ต้อง fail-closed ไม่ fallback ไปใช้ legacy rule โดยเงียบ ๆ

## 4. Atomic Compile + Publish

### RPC ที่ติดตั้งใน migration 20261009000000

`public.publish_level_with_runtime_rules(p_level_id uuid) RETURNS jsonb` เป็น `SECURITY DEFINER`, `SET search_path = ''`, อ้างทุก table ด้วย schema qualification, ตรวจ `auth.uid() IS NOT NULL` และ `COALESCE(auth.jwt()->'app_metadata'->>'role' = 'admin', false)`. ให้ `EXECUTE` เฉพาะ `authenticated`; revoke จาก `PUBLIC, anon`. ห้ามใช้ `user_metadata.role` หรือ client-supplied role

PostgreSQL function call ทำงานใน transaction ของ statement: lock level `FOR UPDATE`, อ่าน game/spots และ approved policy ภายใต้ transaction, validate, insert immutable version, update published metadata/status และ commit. exception ทุกจุด rollback ทั้ง version และ publish update

ตัว RPC ที่ติดตั้งตรวจ authentication/admin role, lock level และ parent game, ปฏิเสธ archived level/game, ตรวจ runtime fields/key/active spots และต้องพบ approved score-policy version. มันไม่บังคับ parent game ให้ published และยังมี TODO เรื่อง artwork; จึงไม่มี asset requirement ใน migration นี้. Active spots เรียง deterministic ก่อนสร้าง SHA-256 hash; `score_value` ไม่รวมใน runtime snapshot/hash. ไม่มีการ approve policy โดย migration.

Hash input ต้องเป็น canonical JSON รวม fields ที่มีผลต่อ runtime เท่านั้น (ข้อมูล level ที่แสดง/กำหนดเวลา, policy version/weights, active spots เรียง deterministic); ไม่รวม `updated_at`/UUIDs ที่ไม่เปลี่ยนพฤติกรรม. ใช้ server-side digest; ไม่รับ hash จาก client

### Publish ซ้ำและการแก้หลัง publish

- Publish เนื้อหา hash เดิม: idempotent, คืน version ที่ตรง hash ปัจจุบัน ไม่สร้าง version ซ้ำ
- เนื้อหา hash เปลี่ยน: เพิ่ม `version = max(version)+1`, ห้าม update/delete version เดิม; run ใหม่ pin version ใหม่
- run ที่ active/paused/completed อยู่แล้วคง `rule_version_id` เดิม; event และ finalize อ่าน snapshot ที่ pin เท่านั้น
- การแก้ content หลัง publish ต้องไม่แก้ snapshot. ทางเลือก workflow: แก้ draft/unpublish แล้ว publish ใหม่ หรือสร้าง draft revision แยกจาก published record. ห้ามให้ direct content update แก้สิ่งที่ Player เห็นโดยไม่ทำให้ version ใหม่พร้อมกัน
- ใน transaction ปิดช่องทาง bypass: เปลี่ยน frontend publish ให้เรียก RPC; จำกัด direct UPDATE ของ `levels.status/published_at` และป้องกันการเปลี่ยน published `level_key`; การเปลี่ยน spot/runtime fields ของ published revision ต้องบังคับผ่าน revision/publish workflow

ไม่เสนอ `publish_game` compiler ในเอกสารนี้ เพราะความต้องการที่กำหนดคือ compile ต่อ level; หากการ publish game ต้อง atomic กับ levels ทั้งชุด ให้เป็น decision แยก

## 5. RPC refactor: legacy path และ pinned path

| RPC | Logic ปัจจุบัน | Logic ที่เสนอ |
|---|---|---|
| `start_game_run(p_level_id text, p_request_id uuid)` | รับ legacy key, ตรวจ `game_run_level_rules`, insert run ด้วย FK legacy, สร้าง `started` event | คง signature/argument name ชั่วคราวเพื่อ PostgREST compatibility แต่ตีความ input เป็น `level_key`; idempotency lookup ต้องเกิดก่อน resolve latest version เพื่อ retry เดิมคืน run เดิม โดยเทียบ input กับ legacy `level_id` หรือ pinned version `level_key`; resolve published level + latest immutable version ด้วย key; pin `content_level_id/rule_version_id`; dynamic row ใช้ `level_id=NULL`. หาก key ไม่มี content identity แต่มีใน legacy rules ให้ใช้ legacy path; ถ้าเป็น published content key แต่ไม่มี version ให้ fail-closed. ตรวจ parent game published ตาม visibility policy |
| `record_game_run_event(p_run_id,p_request_id,p_event_type,p_spot_id)` | owner-lock, idempotency, state/timeout checks; rules จาก static table; spot membership จาก `spot_ids` | owner-lock และ idempotency/state handling เหมือนเดิม; แยกจาก `rule_version_id IS NULL` ไป legacy code path เดิมโดยไม่เปลี่ยน semantics; pinned path อ่าน snapshot ตาม `rule_version_id` ที่ run pin ไว้ ตรวจ `spot_key`, hint cap, total spots และ duration จาก snapshot เท่านั้น. Client ไม่ส่ง duration/count/policy |
| `pause_game_run(p_run_id,p_request_id)` | ใช้ static duration เพื่อ timeout/finalize | dispatch legacy/pinned rule ตาม run; timeout finalization ต้องส่ง request data เดิมและใช้ snapshot เดียวกัน |
| `resume_game_run(p_run_id,p_request_id)` | ตรวจ owner, event idempotency และ timeout request guard; resume paused run | behavior เดิมทุกประการ; rule ไม่เปลี่ยนจากการ resume, response/timeout calculation ใช้ pinned snapshot สำหรับ run ใหม่ และ legacy rule สำหรับ NULL version |
| `abandon_game_run(p_run_id,p_request_id)` | ใช้ static duration ก่อน abandon/timeout finalize | dispatch ตาม pinned/legacy rule; preserve timeout idempotency, ownership, event sequence และ terminal behavior |
| `finish_game_run(p_run_id)` | เรียก `_finalize_game_run`; finalizer อ่าน static rule และ singleton approved score policy; insert session/profile counters/terminal event | คง signature ใน phase แรก; finalizer dispatch rule จาก pinned version หรือ legacy; ใช้ policy snapshot/version ที่ถูก pin ตั้งแต่ start (หรือ policy semantics ที่ owner อนุมัติ); insert session พร้อม `content_level_id/level_key/rule_version_id`; update profile/session/event atomically. ห้ามอ่าน latest rule ณ finalize |

แนะนำ helper ภายในเช่น `_game_run_rule_snapshot(p_run_id uuid)` แต่ต้อง revoke execute จาก client. อย่าทำ legacy branch ผ่าน dynamic lookup ที่อาจเปลี่ยนผล legacy; `rule_version_id IS NULL` ต้องรักษา behavior เดิมให้ตรงทุกประการ รวม score policy behavior

## 6. UUID ↔ level_key data contract: History / Stats / Replay

- `levels.id` คือ content identity UUID; `levels.level_key` คือ public/stable routing key; สองค่านี้ไม่แทนกัน
- `game_runs.content_level_id` FK ไป `levels.id`; composite FK `rule_version_id + content_level_id` pin version; `game_runs.level_id` คง legacy FK แต่ nullable สำหรับ dynamic rows และ CHECK บังคับหนึ่งในสอง identity shapes
- `game_sessions.level_id` ยังคงเป็น legacy-compatible text; dynamic finalize เก็บ pinned key ใน `level_id` และ `level_key`. Composite FK ไป `(rule_version_id, content_level_id)` ผูก session กับ version; migration 20261009133001 เพิ่ม `(content_level_id, level_key)` FK ไป registry เพื่อยืนยัน key/content identity. Legacy rows ที่ new identity columns เป็น NULL ไม่ได้รับผล
- History current entries ควรส่ง `contentLevelId` (UUID) สำหรับ route `/dashboard/play/:routeParam`, `levelKey` สำหรับ server start, และ metadata จาก pinned snapshot สำหรับชื่อ/difficulty ที่เล่นจริง
- History query สำหรับ session ใหม่ควร join `game_runs` ด้วย `game_runs.session_id = game_sessions.id`, แล้ว join `game_run_rule_versions` ด้วย `rule_version_id`; ใช้ snapshot title/difficulty/level_key เพื่อประวัติที่ stable. Legacy session fallback จาก `game_sessions.level_id` เป็น key และ map ด้วย `levels.level_key`, ไม่ใช่ `levels.id`
- เพิ่ม view แบบ read-only เช่น `player_game_history` ที่รวม session, run, snapshot metadata; enforce owner/admin policy/security invoker semantics ให้ชัดก่อนสร้าง view. หรือใช้ RPC ที่มี owner filtering หาก join ผ่าน RLS ทำให้ visibility ซับซ้อน
- Stats ควร group ตาม `content_level_id` หรือ pinned metadata; ถ้าสถิติเป็น unique levels completed ให้ใช้ UUID identity; legacy rows ใช้ key เป็น fallback โดยไม่ rewrite. Admin dashboard เลิก hardcoded 8-key map และ query content/history relation พร้อมจัดหมวด unknown legacy keys อย่างชัดเจน
- Replay ใช้ UUID route param ที่ frontend โหลด published levels เข้าใจ; request start ใช้ level_key. Session key ห้ามส่งเป็น UUID route โดยตรง. Replay event timeline ควรอ่าน `game_run_events` ผ่าน run ที่ session ผูกอยู่และตรวจ ownership
- ผลกระทบ frontend: `GameDataContext` history mapping, `HistoryDetail` replay URL, `adminDashboard` static map, profile completed count/type, run response type (`level_id` เดิม + field ใหม่), RPC publish ใน `content.ts` และ handling ของ pinned runtime content

Historical title/difficulty ที่ถูกแก้ภายหลังจะรักษาได้ก็ต่อเมื่อ snapshot เก็บ fields เหล่านี้หรือมี immutable content revision; การ join `levels` ปัจจุบันเพียงอย่างเดียวไม่รับประกันประวัติ

## 7. Security review

- ทุก `SECURITY DEFINER`: `SET search_path = ''`; schema-qualify objects; ไม่ dynamic SQL ถ้าไม่จำเป็น; ตรวจ auth/role ภายใน function; ใช้ `auth.uid()` เป็น ownership source
- Admin compile/publish ตรวจ `app_metadata.role` เหมือน policies ปัจจุบัน; role จาก user-editable `user_metadata` ใช้ไม่ได้
- Explicitly revoke default `PUBLIC` execute ก่อน grant เฉพาะ authenticated RPC ที่ตั้งใจเปิด; helper/publish internals ไม่เปิด client execute. Review grants ใน deployed catalog เพราะ migration ปัจจุบันให้หลักฐานได้เฉพาะใน repo
- Table RLS ไม่ทดแทน grants และ grants ไม่ทดแทน RLS. เพิ่ม explicit `GRANT SELECT/INSERT/UPDATE` เฉพาะที่ frontend ต้องใช้; หลีกเลี่ยง direct client DML ที่ bypass atomic publish. Rule snapshots ให้ client อ่านผ่าน RPC/view ที่จำกัด scope หรือไม่มี client access
- Rule immutability ต้องป้องกันทั้ง UPDATE และ DELETE ด้วย trigger + privilege revoke; RLS deny เพิ่มชั้นป้องกันแต่ table owner/service role ยังเป็น trust boundary
- ทุก mutation run lock row `FOR UPDATE`, เช็ค `game_runs.user_id = auth.uid()`, event idempotency `(run_id,event_request_id)`, unique event number/spot; test concurrent duplicate requests
- `start` ป้องกัน fake/unpublished/archived `level_key`; resolve key ใน DB และ pin latest published version. `record` ป้องกัน fake `spot_key` ด้วย membership ใน version ที่ pin; ห้ามใช้ client-provided rule/geometry/counter
- response error ควรไม่เปิดเผย existence ของ run คนอื่น (ปัจจุบันใช้ “not found” รวม); ตรวจ request ID reuse กับ different payload ทุก path
- `finish_game_run` ไม่มี request ID ใน signature ปัจจุบัน; terminal state ทำให้ retry idempotent แต่ต้องทดสอบ concurrent finish + session unique/profile update atomicity
- Content read policies กรอง published level/game; migration 090 เพิ่ม table grants หลัง foundation revoke. Effective grants/RLS ในฐานข้อมูลจริงยังต้องตรวจเมื่อได้รับอนุญาตให้เชื่อมต่อ disposable database

## 8. Migration และ compatibility plan (เสนอ)
**สถานะใน repository:** migrations 20261008000000 ถึง 20261009133004 มีอยู่ตามลำดับในหัวข้อ 1.1 โดยมี 20261009133000, 20261009133001 และ 20261009133004 ต่อจาก 20261009000000. นี่เป็นเพียงสถานะไฟล์ใน repository และไม่มีการยืนยันว่า migrations ถูก apply ใน environment ใด. รายการลำดับด้านล่างเป็นข้อเสนอเดิม ไม่ใช่สิ่งที่ต้องสร้างใหม่.

ลำดับที่เสนอ; timestamp/name จริงต้องกำหนดตาม migration state ของ environment ก่อน deploy:

1. **Foundation**: สร้าง versioned score-policy storage/interface ที่ไม่แก้หรือ approve `game_run_score_policy`; สร้าง `game_run_rule_versions` และ immutable guard; เพิ่ม nullable columns/index/FKs บน run/session; เพิ่ม unique/format guard ของ level_key. Migration นี้ไม่ rewrite historical runs
2. **Compile/publish RPC**: สร้าง publish RPC, grants, validation/hash, run lookup indexes. ปรับ frontend publish call ภายหลัง deploy RPC
3. **Dual-path run RPCs**: replace functions โดยเพิ่ม pinned path และคง NULL-version legacy path เดิม; ติดตั้งก่อนเปิด dynamic publish/start. Preserve public signatures/grants หรือประสาน client deploy
4. **History contract**: เพิ่ม view/query surface ที่อ่านทั้ง legacy และ dynamic data; deploy frontend history/stats/replay changes
5. **Enable dynamic publish**: หลังทดสอบ grants, pgTAP, smoke test บน non-production; เปิด publish สำหรับ content levels ใหม่

### Backfill

Legacy 8 rules คงเดิม ไม่ rename/delete. Backfill `game_run_rule_versions` ให้ legacy levels **ยังทำไม่ได้อย่างปลอดภัยจาก migration source อย่างเดียว**: ไม่มีหลักฐาน mapping ระหว่าง legacy rule keys/spots และ UUID rows ใน `levels/level_spots`; ค่า legacy spot IDs ไม่จำเป็นต้องตรง `spot_key`/geometry ปัจจุบัน. จึงแนะนำยังไม่ backfill หรือ pin historical runs. Legacy runs ที่ `rule_version_id IS NULL` ใช้ branch เดิมตลอดไป

ถ้าต้องการให้ legacy content เริ่ม versioned ให้สร้าง mapping ที่ตรวจสอบโดยเจ้าของ/fixture และสร้าง version สำหรับ start ใหม่เท่านั้น; historical runs ไม่ถูก rewrite. ห้าม migrate จน mapping และ scoring semantics ได้รับอนุมัติ

### Rollback

- ก่อนเปิด dynamic: rollback code/RPC ด้วย migration ใหม่แบบ forward-fix; ห้ามแก้ migration ที่ apply แล้ว
- หลัง dynamic runs เริ่มมี: ห้าม drop version table/columns หรือ rollback constraint จน orphan/dynamic runs; disable dynamic publish/start ด้วย feature gate/RPC authorization และคง read/finalize path ที่ใช้ snapshots
- หาก rollback app ต้องรักษา server RPC ที่อ่าน pinned version ไว้จน active/paused runs จบ; old client ที่ไม่เข้าใจ response fields ต้องยังได้รับ legacy-compatible fields
- ห้ามลบ immutable versions, rewrite history, reset sequences หรือแก้ `game_run_score_policy`

## 9. Test plan (pgTAP)
**สถานะการทดสอบ:** ยังไม่มีการรัน SQL หรือ pgTAP. Source coverage อยู่ใน `supabase/tests/backend_run_compatibility_foundation_test.sql` (publish, grants, fail-closed, immutable snapshots, rollback และ session identity FK) และ `supabase/tests/dynamic_run_dual_path_test.sql` (legacy lifecycle พร้อม dynamic lifecycle ที่ gate ด้วย approved policy). หากไม่มี approved policy จะ skip 26 dynamic assertions; dynamic test ไม่สร้าง policy. Foundation test มี approval fixture ภายใน transaction แล้ว `ROLLBACK`.

Concurrency/load races, validation of migration 20261009133001 against existing database rows, behavior after applying the full migration sequence, and frontend history/replay remain unverified. รายการต่อไปนี้เป็น test cases เพิ่มเติม/แผน manual ไม่ใช่ผลจากการรัน.

### Legacy

- Seed/verify 8 legacy rule rows และ CHECK ปฏิเสธ key ที่ 9 ใน legacy table; ไม่มีการ rename/delete legacy IDs
- Start legacy run โดย key ที่รองรับยังสร้าง `level_id` เดิม, event `started`, response time/spot counts เดิม
- Spot membership, duplicate spot, hint cap, timeout, pause/resume/abandon/finish และ scoring behavior เทียบ expected baseline
- `rule_version_id/content_level_id IS NULL` เดิน legacy behavior; historical rows ไม่ถูก rewrite
- start idempotency เดิม request+same key คืน run เดิม; same request+different key error

### Dynamic content

- Admin publish draft ที่ valid สร้าง snapshot/hash/version และ publish status ใน transaction เดียว; non-admin/anonymous ถูกปฏิเสธ
- Invalid title/difficulty/duration/hints/no active spots/invalid geometry/key collision/policy invalid/required asset missing (ถ้าตัดสินใจบังคับ) ต้อง rollback ไม่มี version และ level ไม่ published
- player มองเห็นเฉพาะ published content; start unpublished/archived/fake key ถูกปฏิเสธ
- dynamic start เก็บ `content_level_id`, `rule_version_id`, `level_id=NULL`; FK ยืนยัน version เป็นของ level เดียวกัน
- event รับ spot keys ใน snapshot และปฏิเสธ spot ปลอม/spot เพิ่มหลัง snapshot; client เปลี่ยน max duration/hints/count ไม่มีผล
- hash deterministic ต่อข้อมูลเท่ากันและเปลี่ยนเมื่อ runtime input เปลี่ยน

### Lifecycle / version pinning

- Publish hash เดิมซ้ำไม่สร้าง version ซ้ำ; แก้ content แล้ว publish สร้าง version ถัดไป
- Active และ paused run ยังคง version เดิมหลัง version ใหม่ถูก publish; event, timeout, response และ finalize อ่าน snapshot เดิม
- Run ใหม่ pin version ล่าสุด; run ที่เริ่มระหว่าง publish ใช้ serialization/locking แล้วได้ version เก่าหรือใหม่อย่างสอดคล้อง ไม่ได้ snapshot ผสม
- rule snapshot UPDATE/DELETE ถูกปฏิเสธทุก role ที่ไม่ใช่ migration owner; run deletion/session FK ไม่ลบ version
- session finalize บันทึก level identity/version ที่ถูก pin; retry/concurrency ไม่สร้าง session ซ้ำหรือเพิ่ม counters ซ้ำ

### Security / History

- Function execute grants: authenticated เท่านั้นสำหรับ RPC ที่จำเป็น; helper/public compile internals execute ไม่ได้จาก anon/authenticated
- RLS ownership: user A อ่าน/เปลี่ยน run/session/events ของ user B ไม่ได้; admin claim ต้องมาจาก `app_metadata.role`; spoof ใน `user_metadata` ไม่ให้สิทธิ์
- Wrong/NULL auth, fake UUID/key, request ID replay กับ payload ต่าง, cross-run request ID และ concurrent duplicate event
- History query: legacy key map ไม่เทียบกับ UUID; dynamic UUID/key/version join ถูกต้อง; session เดิมที่ไม่มี new columns ยังอ่านได้; replay URL ใช้ content UUID; admin unknown legacy rows ไม่ทำให้ aggregate ผิด
- View/RPC history ไม่รั่ว user data และใช้ grants/RLS ที่ตั้งใจ

## 10. Open Decisions (ต้องให้เจ้าของเลือก)

1. **`score_value` ต่อ spot ในสูตรคะแนนหรือไม่?**
   - A: ไม่ใช้; คงสูตร global time/wrong/hint ที่มีอยู่และ snapshot เฉพาะ policy version (ข้อแนะนำระยะ compatibility เพราะเป็นการเปลี่ยน scoring น้อยที่สุด)
   - B: ใช้เป็น weight/คะแนนเพิ่ม; ต้องกำหนดสูตร, bounds, การนับ spot, rounding, ผลต่อ score เดิม และ version policy ก่อน implement
2. **กระบวนการ approve score policy ที่ควบคุมได้เป็นอย่างไร?**
   - A: เปลี่ยน singleton เดิมไม่ได้; เพิ่ม immutable/versioned approved policies และ audit approver (แนะนำสำหรับ historical reproducibility)
   - B: คง singleton เป็น source แล้ว copy ค่าเข้า rule snapshot; ต้องกำหนดวิธีอนุมัติ/เปลี่ยนค่าและห้ามการแก้ policy กระทบ run ที่เริ่มแล้ว
   - ไม่ approve หรือแก้ `game_run_score_policy` ในงานนี้; ต้องมี owner decision และ migration แยก
3. **`level_assets`/artwork บังคับก่อน publish หรือไม่?**
   - A: บังคับ primary original (และระบุ thumbnail/validation) เพื่อไม่เผยแพร่ level เล่นไม่ได้ (ข้อแนะนำถ้า Player ต้องโหลด artwork จริง)
   - B: ไม่บังคับใน backend; publish ได้แต่ Player fallback ได้ ต้องระบุ UX/asset loading policy
   - โค้ดปัจจุบันไม่ได้ validate asset ใน `publishLevel`; schema เก็บ metadata แต่ไม่มี requirement ว่าต้องมี asset
4. **ยอมผ่อน `game_runs.level_id NOT NULL` เป็น nullable โดยคง FK เดิมไหม?** จำเป็นต่อ dynamic rows ในตารางเดิม; ทางเลือกคือ run table ใหม่ซึ่งซับซ้อนกว่า
4. **`game_runs.level_id` nullable:** migration 20261009000000 ได้ผ่อนเป็น nullable โดยคง legacy FK; rollback/contract changes หลังเริ่มมี dynamic runs ต้องใช้ forward migration และรักษา pinned lifecycle path
5. **Content edit หลัง publish:** clone draft revision หรือ unpublish/edit/republish row เดิม? ต้องกำหนด behavior ของ game visibility และ active users ระหว่างแก้
6. **เกมที่ parent `games.status != 'published'`:** อนุญาต publish level ได้หรือไม่? ปัจจุบัน player query กรองทั้ง game และ level ว่าต้อง published แต่ admin `publishLevel` ไม่ตรวจ parent game
7. **การเปลี่ยน `level_key`:** แนะนำห้ามหลัง publish; หากธุรกิจจำเป็นต้องเปลี่ยน ต้องกำหนด alias/deprecation และ route/replay semantics
8. **การ backfill legacy rules:** มี authoritative mapping จาก 8 legacy keys/spot IDs ไป `levels.id`, geometry และ score policy หรือไม่? ถ้าไม่มี ให้ legacy runs เป็น NULL-version ต่อไป
9. **`finish_game_run` idempotency contract:** terminal-state retry เพียงพอหรือควรเพิ่ม client request UUID ใน API version ใหม่?
10. **Stats semantics:** distinct completed level นับตาม stable content UUID, level key, หรือแต่ละ published version? ข้อเสนอคือ UUID ของ content level ไม่ใช่ version
11. **Legacy/content key collision:** มี content `levels.level_key` ตรงกับหนึ่งใน 8 legacy keys อยู่แล้วหรือไม่ และจะ map ให้เป็น runtime version อย่างไร? ต้องตรวจ catalog ใน environment; ห้ามให้ published content ที่ยังไม่มี version fallback ไป static rule โดยไม่ตั้งใจ

## 11. Risks และสิ่งที่ยังไม่รู้

- ไม่มี database catalog/production access ในการตรวจนี้ จึงไม่รู้ grants, policies, triggers, functions หรือ migrations ที่อาจถูก apply/แก้เพิ่มนอก repository
- Source migrations 080/090 ระบุ revoke/grants แล้ว แต่ deployed catalog/effective RLS policies ยังไม่ได้ตรวจ
- ไม่มี mapping ที่ยืนยันได้ระหว่าง 8 legacy rule rows, legacy spot IDs และ dynamic `levels/level_spots`; ห้าม backfill โดยเดา
- `level_spots`/level metadata ยังแก้ได้เมื่อ published ผ่าน service functions; runtime client โหลด live content ขณะที่ run server อาจ pin snapshot จึงต้องออกแบบวิธีส่ง/render content version เดียวกับ run มิฉะนั้นภาพ/spot overlay อาจไม่ตรง authoritative snapshot
- Policy singleton legacy seed ยังไม่ approved; winning legacy finalize fail-closed จนมี approval. Versioned publish also requires a policy approval, which these migrations do not create.
- Frontend publish validation remains client-side and is not wired to the new publish RPC; effective deployed grants/RLS cannot be verified from repository source alone.
- `game_runs.level_id` nullability กับ API `level_id` response มีความเสี่ยง compatibility; ต้อง deploy DB dual path ก่อนเปิด dynamic levels และคง old fields ให้ client เดิม
- การคำนวณ content hash ต้องกำหนด canonicalization/algorithm และผลกระทบจาก artwork/storage changes ให้ชัด
- นโยบาย asset, score_value, versioned approval, parent game publish และ editable published content ต้องตัดสินใจก่อน final schema
- Migration 20261009133001 `VALIDATE CONSTRAINT` จะหยุดหากมี dynamic session ที่ key/content registry ไม่ตรง; rows ใน database จริงตรวจไม่ได้ภายใต้ข้อห้าม SQL
- `seed.sql` เป็น local E2E fixture และ config ปิด auto-seed แต่ถ้าสั่ง apply เองจะเพิ่ม approval สำหรับ `local-e2e-v1`; ห้ามใช้กับ fail-closed/production environment

## Source files reviewed

- `supabase/migrations/20261004000000_phase_2a_database_foundation.sql`
- `supabase/migrations/20261004010000_phase_2b_game_runs.sql`
- `supabase/migrations/20261005000000_phase_2b_resume_timeout_request_guard.sql`
- `supabase/migrations/20261008000000_game_content_foundation.sql`
- `supabase/migrations/20261009000000_backend_run_compatibility_foundation_publish.sql`
- `supabase/migrations/20261009133000_dynamic_run_dual_path.sql`
- `supabase/migrations/20261009133001_game_session_level_key_identity_guard.sql`
- `supabase/migrations/20261009133004_lifecycle_and_score_policy_rpcs.sql`
- `supabase/tests/backend_run_compatibility_foundation_test.sql`
- `supabase/tests/dynamic_run_dual_path_test.sql`
- `supabase/tests/phase_2b_game_runs_test_plan.md`
- `src/services/content.ts`, `src/services/playerContent.ts`, `src/services/gameRuns.ts`, `src/services/adminDashboard.ts`
- `src/context/GameDataContext.tsx`, `src/context/AdminDataContext.tsx`
- `src/pages/game/GamePlay.tsx`, `src/pages/player/HistoryDetail.tsx`, `src/routes/AppRouter.tsx`