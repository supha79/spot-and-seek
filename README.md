# Spot & Seek

Spot & Seek เป็นเว็บแอปพลิเคชันเกมค้นหาความแตกต่างของภาพแบบภาพรวมต่อเนื่องที่พัฒนาโดยใช้ React, TypeScript, Vite และ Supabase สำหรับใช้งานภายในระบบเกมฝึกทักษะการสังเกตและการตอบสนองของผู้เล่น โดยมีการจัดการทั้งฟังก์ชันสำหรับนักศึกษาและผู้ดูแลระบบในระบบเดียวกัน

## 1. ภาพรวมของโปรเจกต์

Spot & Seek มีวัตถุประสงค์เพื่อให้ผู้ใช้งานได้ฝึกการสังเกตภาพและค้นหาความแตกต่างหรือจุดสำคัญในภาพที่มีความคล้ายคลึงกัน โดยมีการออกแบบเป็นเกมระดับความยากต่างกัน เช่น Easy, Medium, Hard และมีระบบบันทึกประวัติผลคะแนนและความคืบหน้าของผู้เล่น

จากโค้ดที่มีอยู่จริง ระบบนี้มีการแยกบทบาทผู้ใช้งานเป็น 2 กลุ่มหลัก คือ:

- นักศึกษา (Student): เข้าสู่ระบบ เล่นเกม ดูประวัติ ผลคะแนน และติดตามความคืบหน้า
- ผู้ดูแลระบบ (Admin): จัดการเกม ระดับความยาก เนื้อหาเกม กฎคะแนน และเปิด/ปิดระบบเกมตามเงื่อนไขที่กำหนด

โปรเจกต์นี้มีการเชื่อมต่อกับ Supabase สำหรับจัดการ Authentication, Content Catalog และข้อมูลเกมที่ใช้กับผู้เล่นและผู้ดูแลระบบ รวมถึงมีการใช้ SQL Migration เพื่อกำหนดกฎทางธุรกิจ เช่น lifecycle ของเกมและระดับ, score policy, gameplay gate และการตรวจสอบความพร้อมก่อนเผยแพร่

## 2. ลิงก์สำหรับทดลองใช้งาน

เว็บไซต์สำหรับทดลองใช้งานจริง:
https://spot-and-seek-sigma.vercel.app/login

หมายเหตุ: เป็นสภาพแวดล้อมสำหรับตรวจสอบและทดลองใช้งานจริง โดยผู้ใช้งานควรตรวจสอบสถานะของระบบก่อนใช้งานและไม่ควรถือว่าแต่ละฟังก์ชันทำงานสมบูรณ์โดยไม่มีการยืนยันจากสภาพแวดล้อมที่ใช้อยู่ในเวลานั้น

## 3. ภาพรวมฟังก์ชันที่มีในโปรเจกต์

จากโค้ดจริงที่ตรวจสอบได้ มีฟังก์ชันดังนี้

### 3.1 สำหรับนักศึกษา (Student)

- ระบบเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
- สมัครสมาชิก และยืนยันอีเมลก่อนเข้าสู่ระบบ
- รีเซ็ตรหัสผ่านและเปลี่ยนรหัสผ่าน
- เลือกระดับความยากของเกม (Easy / Medium / Hard)
- เลือก Buddy หรืออวาตาร์สำหรับผู้เล่น
- เล่นเกมค้นหาความแตกต่างหรือจุดที่ต้องการภายในภาพ
- ระบบคะแนนและนโยบายการคิดคะแนนที่กำหนดในโค้ด
- แสดงผลลัพธ์เมื่อเกมจบ เช่น ชนะ/แพ้/หมดเวลา
- ดูประวัติการเล่นและสถิติเฉพาะผู้ใช้
- ดูหน้า Home / Profile / How to Play / History

### 3.2 สำหรับผู้ดูแลระบบ (Admin)

- แดชบอร์ดภาพรวมข้อมูลระบบ
- จัดการเกม (Create / Edit / Publish / Unpublish / Archive / Delete)
- จัดการ Levels (ระดับเกม) และ Spot / Question ในแต่ละ Level
- ตรวจสอบและจัดการภาพคู่ Original / Comparison สำหรับเกม
- จัดการ Dynamic score policy และการอนุมัติ
- จัดการ Dynamic gameplay gate เพื่อควบคุมการเปิดใช้งานเกมตามเงื่อนไขความพร้อม
- ดูข้อมูลสถิติและประวัติการเล่นของระบบ

### 3.3 ฟังก์ชันที่มีหลักฐานชัดเจนจากโค้ด

- Authentication flow: `src/context/AuthContext.tsx`
- Route guard: `src/routes/ProtectedRoute.tsx`, `src/routes/AdminRoute.tsx`
- Route configuration: `src/routes/AppRouter.tsx`
- Content catalog management: `src/context/AdminDataContext.tsx`, `src/services/content.ts`
- Player gameplay and history: `src/context/GameDataContext.tsx`
- Dynamic score policy: `src/services/scorePolicies.ts`
- Dynamic gameplay gate: `src/services/dynamicGameplayGate.ts`
- SQL migrations: `supabase/migrations/`
- Automated tests: `tests/unit/`, `supabase/tests/`

หมายเหตุ: หากมีฟังก์ชันใดที่ยังไม่ได้รับการยืนยันหรือต้องใช้ข้อมูลเพิ่มเติม จะระบุว่า “ต้องตรวจสอบเพิ่มเติม” ในเอกสารนี้เพื่อหลีกเลี่ยงการกล่าวอ้างเกินจริง

## 4. บทบาทผู้ใช้งานและสิทธิ์การเข้าถึง

| บทบาท | สิทธิ์การใช้งาน | ข้อมูลยืนยันจากโค้ด |
| --- | --- | --- |
| Student | เข้าสู่ระบบ, เล่นเกม, ดูประวัติ, ดูโปรไฟล์, เลือกความยาก | `ProtectedRoute` และเส้นทาง `/dashboard` |
| Admin | จัดการเกม, ระดับ, คำถาม, กฎคะแนน, Gameplay gate | `AdminRoute` และเส้นทาง `/admin` |

### นักศึกษา (Student)

นักศึกษาสามารถ:

- เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
- สมัครสมาชิกและยืนยันอีเมล
- ลืมรหัสผ่านและตั้งรหัสผ่านใหม่
- เลือกตัวละคร Buddy และปรับแต่งประสบการณ์ผู้เล่น
- เข้าถึงหน้า Home, How to Play, Play, History, Profile
- ดูประวัติผลคะแนนและจำนวนรอบที่เล่นแล้ว

### ผู้ดูแลระบบ (Admin)

ผู้ดูแลระบบสามารถ:

- เข้าถึงหน้า Admin Dashboard และสถิติระบบ
- เพิ่ม/แก้ไข/ลบเกม
- เพิ่ม/แก้ไข/เผยแพร่/ยกเลิกเผยแพร่/เก็บถาวร คอนเทนต์เกมและระดับ
- เพิ่มคำถาม/จุดสำคัญ (Spot) ในแต่ละ level
- ดำเนินการสร้างและอนุมัติ Dynamic Score Policy
- เปิด/ปิด Dynamic Gameplay Gate หลังจากตรวจสอบว่ามีเนื้อหาที่พร้อมแล้ว

## 5. วิธีการใช้งานเว็บแอป

### 5.1 การใช้งานสำหรับนักศึกษา

1. เปิดเว็บไซต์และไปที่ `/login`
2. กรอกอีเมลและรหัสผ่านที่ลงทะเบียนแล้ว
3. หลังเข้าสู่ระบบสำเร็จ ระบบจะนำไปที่ `/dashboard/home`
4. เลือกระดับความยากที่ต้องการ เช่น Easy, Medium หรือ Hard
5. เริ่มเล่นเกม โดยสังเกตภาพและค้นหาความแตกต่างหรือสิ่งที่ตรงตามคำสั่งของเกม
6. เมื่อเกมสิ้นสุด ระบบจะแสดงผลคะแนนและประวัติการเล่น
7. ผู้เล่นสามารถกลับไปดูประวัติและสถิติจากหน้า History และ Profile

### 5.2 การใช้งานสำหรับ Admin

1. เข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์เป็น Admin
2. ไปที่ `/admin/dashboard`
3. จัดการเกมในหน้า `Manage Games`
4. จัดการระดับและคำถามในหน้า `Manage Levels` และ `Questions`
5. หลังจากตรวจสอบความพร้อมของเนื้อหาและรูปภาพ สามารถ Publish game/level ได้
6. ใช้เมนู Dynamic Score Policy และ Dynamic Gameplay Gate เพื่อจัดการกฎคะแนนและการปลดล็อกเกม

## 6. การติดตั้งและรันโปรเจกต์บนเครื่อง Developer

### 6.1 สิ่งที่ต้องมี

- Node.js และ npm
- Supabase project ที่ถูกต้อง
- Browser สำหรับทดสอบแอปพลิเคชัน

### 6.2 ติดตั้ง dependencies

```bash
npm install
```

### 6.3 เริ่มต้น development server

```bash
npm run dev
```

หรือใช้โหมด development แบบ local:

```bash
npm run dev:local
```

### 6.4 Build แอปพลิเคชันสำหรับ production

```bash
npm run build
```

### 6.5 ดูตัวอย่าง build แบบ local

```bash
npm run preview
```

## 7. เทคโนโลยีและสถาปัตยกรรมที่ใช้

### เทคโนโลยีหลัก

- React 18
- TypeScript
- Vite 6
- React Router
- Tailwind CSS
- Supabase JavaScript SDK
- Vitest และ Node Test Runner

### โครงสร้างโปรเจกต์หลัก

- `src/App.tsx` — จุดเริ่มต้นของแอป และ Provider ของระบบ
- `src/context/AuthContext.tsx` — บริหารสถานะการเข้าสู่ระบบและบทบาทผู้ใช้งาน
- `src/context/GameDataContext.tsx` — จัดการข้อมูลผู้เล่น เช่น เกม, ประวัติ, profile
- `src/context/AdminDataContext.tsx` — จัดการข้อมูลด้าน Admin และ CRUD สำหรับเนื้อหา
- `src/routes/AppRouter.tsx` — กำหนดเส้นทางของหน้า Student และ Admin
- `src/pages/` — หน้าเว็บหลัก เช่น Login, Home, History, Admin Dashboard
- `src/components/` — components ที่ใช้ซ้ำ เช่น UI, layout, modal
- `src/services/` — ชั้นบริการสำหรับ Supabase, score policy, compatibility, gameplay
- `supabase/migrations/` — migration เพื่อสร้าง schema และกำหนดกฎความปลอดภัยและ lifecycle
- `supabase/tests/` — SQL tests สำหรับตรวจสอบความถูกต้องของระบบ
- `tests/unit/` — automated tests สำหรับ frontend และ business logic
- `vercel.json` — การตั้งค่าการ Deploy บน Vercel

## 8. การตั้งค่า Supabase และ Environment Variables

โปรเจกต์นี้ใช้ Supabase สำหรับการจัดการ Authentication และข้อมูลต่าง ๆ ดังนั้นต้องตั้งค่า environment variables ให้ถูกต้องก่อนรันแอป

### ตัวแปรที่ต้องมี

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

ไฟล์ที่ใช้ตรวจสอบค่าความถูกต้องอยู่ที่:

- `src/supabaseClient.ts`
- `src/supabaseConfig.ts`

ถ้าหากไม่มีค่านี้ แอปจะแสดงข้อความ:

`Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`

### ตัวอย่างไฟล์ environment

Repository มีไฟล์ `.env.example` สำหรับเป็นต้นแบบของ environment variable

```bash
cp .env.example .env.local
```

จากนั้นกำหนดค่า URL และ Anon Key ใน `.env.local` โดยหลีกเลี่ยงการบันทึก Secret, Service Role Key หรือ Access Token ลงใน Git

### ข้อมูลเพิ่มเติมเกี่ยวกับ Supabase

- `supabase/config.toml` เป็นการตั้งค่า local CLI สำหรับ Supabase
- `supabase/seed.sql` มีการระบุว่าไม่ได้ seed หรือ approve Dynamic score policy โดยตั้งใจไว้
- `supabase/migrations/` มี SQL migration หลายชุดที่กำหนด lifecycle, gameplay gate, score policy, asset readiness และpublished content rules

## 9. การทดสอบระบบและตรวจสอบปัญหาขั้นพื้นฐาน

### รัน Unit Tests

```bash
npm test
```

### รัน UI Tests ที่กำหนดไว้ใน package.json

```bash
npm run test:ui
```

### ผลการยืนยันจากการทดสอบจริง

จากการรันจริงในสภาพแวดล้อมปัจจุบัน พบว่า:

- จำนวน tests: 85
- ผ่าน: 85
- ล้มเหลว: 0

หมายเหตุ: ผลลัพธ์นี้เป็นข้อมูลที่ยืนยันได้จากการรันจริงในเครื่องปัจจุบัน และแสดงว่าระบบมีความสอดคล้องของ logic หลายส่วน เช่น lifecycle, score policy, gameplay gate, config validation และ compatibility contracts

### หากเกิดปัญหาเบื้องต้น

1. ตรวจสอบว่า `.env.local` มี `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` หรือไม่
2. ตรวจสอบ URL ของ Supabase ว่าถูกต้องและ project ยังใช้งานอยู่
3. เปิด Browser Console เพื่อดู error ที่เกิดขึ้น
4. ตรวจสอบว่าได้รันแอปบนโหมดที่ถูกต้อง เช่น `npm run dev` หรือ `npm run dev:local`
5. ใช้ `npm test` เพื่อยืนยันว่า logic ด้านระบบยังทำงานตามที่คาดหวัง
6. หากฟังก์ชันเกี่ยวข้องกับ admin content หรือ score policy ให้ตรวจสอบว่ามีข้อมูลที่จำเป็นถูกสร้างใน Supabase แล้ว

## 10. การ Deploy บน Vercel

Repository มีไฟล์ `vercel.json` ซึ่งกำหนดการ deploy สำหรับ Vite application ดังนี้

```json
{
  "framework": "vite",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

การกำหนดนี้สอดคล้องกับ Single Page Application ที่ใช้ React + Vite โดยจะ redirect ทุก path ไปที่ `index.html` เพื่อให้ routing ใน React ทำงานได้

## 11. ข้อมูลสำหรับอาจารย์ ผู้ประเมิน และผู้ศึกษาซอร์สโค้ด

โปรเจกต์นี้มีความเหมาะสมสำหรับการนำเสนอเป็นโครงงานระดับมหาวิทยาลัย เพราะมีองค์ประกอบดังนี้

- แยกบทบาทผู้ใช้ชัดเจนระหว่าง Student และ Admin
- มีระบบ authentication ที่ใช้งานร่วมกับ Supabase
- มี gameplay flow ที่ผสานกับ UI และข้อมูลจริง
- มีระบบจัดการคอนเทนต์ (Game, Level, Spot) และสิทธิ์การเผยแพร่
- มีการควบคุมความยากและกฎต่าง ๆ ผ่าน database migrations
- มี automated tests ที่ช่วยยืนยันความถูกต้องของระบบ
- มีการจัดโครงสร้างโปรเจกต์และการทำงานแบบ modular ซึ่งเหมาะสำหรับการขยายระบบต่อไป

อย่างไรก็ตาม สำหรับการยืนยันความพร้อมใช้งานแบบ production อย่างสมบูรณ์ ควรตรวจสอบสภาพแวดล้อม Supabase ที่ใช้งานจริงและ environment deployment ที่ deploy จนถึง production เช่น กรณีการเชื่อมต่อ real DB, auth, storage และ asset readiness

## 12. สรุป

Spot & Seek เป็นเว็บแอปพลิเคชันเกมค้นหาความแตกต่างของภาพที่มีการแยกระบบผู้ใช้ออกเป็น Student และ Admin โดยมีการใช้ React + TypeScript + Vite + Supabase เพื่อจัดการฟังก์ชันการเข้าสู่ระบบ การเล่นเกม การเก็บประวัติ และการจัดการเนื้อหาเกมแบบมีการควบคุมและตรวจสอบเงื่อนไขทางธุรกิจ

ข้อมูลที่ระบุไว้ในเอกสารนี้อิงจากโค้ดจริงและผลการทดสอบที่ยืนยันได้ในสภาพแวดล้อมปัจจุบัน หากต้องการศึกษารายละเอียดเพิ่มเติม ให้ดูในโฟลเดอร์หลักดังนี้

- `src/`
- `supabase/`
- `tests/unit/`
- `vercel.json`

คำเตือน: หากต้องการใช้ระบบจริงในสภาพแวดล้อม production ควรตรวจสอบ Supabase project, environment variables และการ deploy ซ้ำอีกครั้งก่อนประกาศว่าใช้งานได้เต็มรูปแบบ
