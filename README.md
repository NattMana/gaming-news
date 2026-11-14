# Gaming News Admin

แดชบอร์ดภายในสำหรับค้นหา กรอง ตรวจรายละเอียด และอัปเดตสถานะรีวิวของข่าวเกมที่มีอยู่ใน PostgreSQL แอปไม่สร้าง ลบ หรือแก้โครงสร้างข่าวเอง

## ภาพรวมระบบ

- **หน้า Articles** แสดงข่าว ค้นหาด้วยชื่อหรือ URL กรองตามสถานะ/วันที่ เรียงข้อมูล และแบ่งหน้า
- **ปุ่ม View** เปิดรายละเอียดของข่าวและฟิลด์ต้นทาง
- **คลิกชื่อ Article** เปิด Graphic Studio สำหรับปรับภาพและข้อความ แล้วดาวน์โหลด PNG, SVG หรือ PPTX
- **API** ทำหน้าที่อ่านรายการ/รายละเอียด/ตัวเลือกตัวกรอง และอัปเดต `do_status` เท่านั้น
- **โหมด mock** ใช้ fixture ใน `lib/data/mock-articles.ts` ไม่ต้องมี PostgreSQL; การเปลี่ยน review status อยู่ในหน่วยความจำและหายเมื่อรีสตาร์ต
- **โหมด postgres** อ่านตาราง `articles` ที่มีอยู่ ไม่สร้างตาราง, migration, seed หรือข้อมูลข่าวให้เอง
- รูปและ draft ใน Graphic Studio เก็บใน browser `localStorage`; ไม่ได้อัปโหลดเข้า database

```text
Browser → Next.js UI → /api/* → ArticleProvider
                                  ├─ mock fixtures (local development)
                                  └─ PostgreSQL articles table
```

## ความต้องการ

- Node.js 22 LTS และ npm (หรือ Docker)
- PostgreSQL เฉพาะเมื่อต้องใช้ข้อมูลจริง
- ใช้ Basic Authentication เมื่อเปิดหน้า admin/API; production ต้องตั้งรหัสผ่านและใช้ HTTPS

## เริ่มรันในเครื่องโดยไม่ใช้ฐานข้อมูล

1. ติดตั้ง dependencies และสร้างไฟล์ local config:

   ```powershell
   npm install
   Copy-Item .env.example .env.local
   ```

2. แก้ `.env.local` สำหรับ mock mode:

   ```dotenv
   NODE_ENV=development
   DATA_SOURCE=mock
   AUTH_ENABLED=false
   APP_TIME_ZONE=Asia/Bangkok
   ```

   `AUTH_ENABLED=false` ใช้ได้เฉพาะ development เท่านั้น ถ้าต้องการทดสอบ Basic Auth ให้ตั้ง `AUTH_ENABLED=true` แล้วกำหนด `AUTH_USER` และ `AUTH_PASSWORD` เป็นค่าของคุณเอง

3. รันแอป:

   ```powershell
   npm run dev
   ```

4. เปิด `http://localhost:3000/admin/articles` (ถ้าพอร์ต 3000 ถูกใช้ Next.js จะแสดงพอร์ตอื่นใน terminal) โหมด dev ใช้ path ปกติ ส่วน production ใช้ prefix จาก `DASHBOARD_BASE_PATH` เช่น `/news/admin/articles`

Mock mode ไม่เชื่อมฐานข้อมูล การเปลี่ยน review status จะไม่ถูกเก็บถาวร

## เชื่อม PostgreSQL

### ก่อนตั้งค่า

แอปคาดหวังตาราง `articles` ที่มีคอลัมน์ต่อไปนี้ และใช้ชื่อคอลัมน์ตามตัวพิมพ์เล็กใน schema ปัจจุบัน:

```text
id, url_hash, canonical_url, title, content, creator, pub_date, fetched_at,
status, mode, language, region, raw_url, ai_title, ai_full_summary,
ai_short_summary_2_sentences, do_status, preverdict
```

API ส่งคืน `preverdict` ในข้อมูล article และหน้า View แสดงค่านี้เป็นฟิลด์ Pre-verdict; ฟิลด์นี้อ่านจากฐานข้อมูลอย่างเดียวและไม่ได้ถูกแก้ไขโดยแอป

ตัวกรองในหน้าเว็บและ query parameter ใช้ชื่อ `type` เพื่อให้สอดคล้องกับ UI แต่ provider จะ map ไปยังคอลัมน์ `mode` ใน PostgreSQL และส่งค่ากลับเป็น `type` ให้หน้าเว็บ ดังนั้น schema ต้องมี `mode` (ไม่จำเป็นต้องมีคอลัมน์ `type`) ตรวจ schema ของฐานข้อมูลที่มีอยู่ก่อนเชื่อม:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'articles'
ORDER BY ordinal_position;
```

ข้อกำหนดที่สำคัญ:

- `id` ต้องระบุข่าวได้ไม่ซ้ำกันและ cast เป็น text ได้
- `pub_date` ต้องเป็นชนิดวันที่/เวลา ที่ PostgreSQL เปรียบเทียบกับ `date` ได้
- ฟิลด์ค้นหา `title`, `ai_title`, `canonical_url`, `raw_url` ต้องรองรับ `ILIKE` (เช่น `text` หรือ `varchar`)
- ฟิลด์ `do_status` ต้องเขียนค่า `undone`, `done`, `skip` ได้; ค่าอื่นและค่าว่างยังอ่าน/กรองได้
- แอปไม่ได้ตรวจหรือแก้ schema ให้ ถ้าชื่อหรือชนิดคอลัมน์ไม่ตรง query จะผิดพลาด

### ตั้งค่าการเชื่อมต่อ

1. ใช้ฐานข้อมูลและตาราง `articles` ที่มีอยู่ หรือเตรียม schema ให้ครบก่อน ตัวอย่างไฟล์ production ตั้ง database เป็น `n8n` แต่ให้เปลี่ยนเป็นชื่อ database จริงของคุณ
2. ให้ DBA สร้างหรือเลือก database role แยกสำหรับ dashboard และให้สิทธิ์เท่าที่แอปใช้: `SELECT` ตาราง และ `UPDATE` เฉพาะ `do_status` ตัวอย่าง (เปลี่ยนชื่อ database/schema/role และรหัสผ่านให้ตรงระบบจริง):

   ```sql
   CREATE ROLE dashboard_user LOGIN PASSWORD 'replace-with-a-unique-secret';
   GRANT CONNECT ON DATABASE n8n TO dashboard_user;
   GRANT USAGE ON SCHEMA public TO dashboard_user;
   GRANT SELECT ON TABLE public.articles TO dashboard_user;
   GRANT UPDATE (do_status) ON TABLE public.articles TO dashboard_user;
   ```

   ถ้ามี role อยู่แล้ว ให้ใช้เฉพาะ `GRANT` ที่จำเป็น ไม่ต้องรัน `CREATE ROLE` ซ้ำ

3. ตั้งค่าตัวแปรก่อนเริ่มแอป ตัวอย่างสำหรับรัน Next.js บนเครื่องเดียวกับ PostgreSQL:

   ```dotenv
   NODE_ENV=development
   DATA_SOURCE=postgres
   DATABASE_URL=postgresql://dashboard_user:URL_ENCODED_PASSWORD@localhost:5432/n8n
   DB_SSL=false
   APP_TIME_ZONE=Asia/Bangkok
   AUTH_ENABLED=true
   AUTH_USER=admin
   AUTH_PASSWORD=replace-with-a-long-unique-password
   ```

   ถ้ารหัสผ่านมีอักขระพิเศษใน URL เช่น `@`, `:`, `/` ให้ URL-encode ส่วนนั้น หาก PostgreSQL ต้องใช้ TLS ให้ตั้ง `DB_SSL=true`; แอปตรวจ certificate ตามปกติ

4. รีสตาร์ต `npm run dev` หลังเปลี่ยน `.env.local` แล้วเปิดหน้า Articles การเชื่อมต่อฐานข้อมูลเป็นแบบ lazy: ไม่มีการต่อ DB ตอน `npm install`; pool จะถูกสร้างเมื่อมี request แรกที่อ่าน/เขียนข้อมูลข่าว เช่น `GET /api/articles`, หน้า View หรือ Graphic Studio ต้องเปิดใช้งานและเข้าถึง DB ได้ในตอนนั้น Provider ถูกเลือกจาก `DATA_SOURCE` ครั้งแรกที่ถูกเรียก จึงควรรีสตาร์ต process ทุกครั้งที่เปลี่ยน data source หรือ credentials

5. ตรวจผลด้วย `GET /api/articles` และหน้า Articles ถ้าต่อ DB ไม่ได้ endpoint จะแสดง `503`; แอปจะไม่สลับกลับไปใช้ mock อัตโนมัติ

> สำหรับ `.env.local` ให้ใช้ `localhost` เมื่อ Next.js รันบน Windows host และ PostgreSQL เปิดพอร์ตให้ host เข้าถึงได้ ชื่อ host `postgres` ใช้ได้เมื่อ dashboard container และ PostgreSQL อยู่ใน Docker network เดียวกันเท่านั้น

## ตัวแปรสภาพแวดล้อม

| ตัวแปร | ใช้ทำอะไร |
| --- | --- |
| `DATA_SOURCE` | จำเป็น: `mock` หรือ `postgres`; production บังคับเป็น `postgres` |
| `DATABASE_URL` | connection string ของ PostgreSQL; จำเป็นเมื่อ `DATA_SOURCE=postgres` |
| `DB_SSL` | `true` เมื่อ PostgreSQL ต้องใช้ TLS; ค่าเริ่มต้นไม่ใช้ TLS |
| `APP_TIME_ZONE` | IANA timezone สำหรับแสดงวันเวลา; ค่าเริ่มต้น `Asia/Bangkok` |
| `AUTH_ENABLED` | ตั้ง `false` เพื่อปิด Basic Auth เฉพาะนอก production; ค่าอื่นเปิด auth |
| `AUTH_USER`, `AUTH_PASSWORD` | credentials สำหรับหน้า admin และ API เมื่อเปิด auth; ห้ามใช้ placeholder ในไฟล์ตัวอย่าง |
| `DASHBOARD_HOST` | hostname ที่ label ของ Traefik ใน `compose.dashboard.yaml` ใช้ |
| `APP_ORIGIN` | public origin ของ dashboard เช่น `https://news.example.com`; ใช้ตรวจ Origin ของ PATCH หลังผ่าน reverse proxy |
| `DASHBOARD_BASE_PATH` | path prefix ของ dashboard; ใช้ทั้ง Next.js basePath ตอน build และ Traefik PathPrefix; ค่าเริ่มต้น `/news` |
| `NODE_ENV`, `PORT`, `HOSTNAME` | runtime settings; กำหนดผ่าน `.env` ได้ โดยค่าเริ่มต้นใน Compose คือ `production`, `3000`, `0.0.0.0` |
| `TRAEFIK_ENABLED`, `TRAEFIK_ENTRYPOINT`, `TRAEFIK_TLS` | ควบคุม Traefik labels; ค่าเริ่มต้นคือ `true`, `websecure`, `true` |
| `TRAEFIK_CERTRESOLVER`, `TRAEFIK_PRIORITY` | ตั้งชื่อ TLS cert resolver และ router priority ของ Traefik |
| `DOCKER_NETWORK_NAME`, `DASHBOARD_CONTAINER_NAME` | ชื่อ external Docker network ที่ใช้ร่วมกับ Traefik/PostgreSQL และชื่อ container |

`DOMAIN_NAME` ที่ยังปรากฏในไฟล์ตัวอย่างไม่ได้ถูกอ่านโดยแอปหรือ Compose fragment ปัจจุบัน

ไฟล์ `.env.local` และ `.env` ถูก ignore โดย Git; เก็บ secrets ไว้ที่เครื่องหรือ secret store เท่านั้น อย่า commit ไฟล์จริง

## หน้าเว็บ

| Path | หน้าที่ |
| --- | --- |
| `/` | เปลี่ยนเส้นทางไป `/admin/articles` |
| `/admin/articles` | รายการข่าว ค้นหา กรอง เรียง และเปลี่ยน review status |
| `/admin/articles/[id]` | รายละเอียดข่าวทั้งหมด; เข้าผ่านปุ่ม View |
| `/admin/articles/[id]/graphic` | Graphic Studio ของข่าว; เข้าผ่านชื่อ Article |
| `/fb/index.html` | ตัว editor แบบ standalone ที่ฝังในหน้า Graphic Studio |

## API

ทุก API อยู่หลัง middleware เดียวกับหน้า admin จึงต้องส่ง Basic Auth เมื่อเปิด authentication คำตอบเป็น JSON และ response ของข้อมูลตั้ง `Cache-Control: no-store`

| Method | Path | หน้าที่ |
| --- | --- | --- |
| `GET` | `/api/articles` | ค้นหา/กรอง/เรียง/แบ่งหน้ารายการข่าว |
| `GET` | `/api/articles/filters` | ค่าตัวเลือกที่พบในตาราง เช่น `status`, `type`, `language`, `region`, `do_status` |
| `GET` | `/api/articles/{id}` | อ่านรายละเอียดข่าวหนึ่งรายการ |
| `PATCH` | `/api/articles/{id}` | เปลี่ยน `do_status` ของข่าว; body `{"do_status":"undone"}` (รองรับ `done`, `skip` ด้วย) |
| `GET` | `/api/config` | ค่า config ที่ client ใช้ เช่น `{"timeZone":"Asia/Bangkok"}` |

`GET /api/articles` รับ query parameters:

| Parameter | ค่า/ความหมาย |
| --- | --- |
| `page` | เลขหน้า เริ่มที่ 1; default `1` |
| `pageSize` | `10`, `25`, `50`, `100`; default `25` |
| `search` | ค้นใน `title`, `ai_title`, `canonical_url`, `raw_url` (สูงสุด 200 ตัวอักษร) |
| `status`, `do_status`, `type`, `language`, `region` | กรองค่าตรงกัน; ใช้ `__null` เพื่อกรอง NULL/ค่าว่าง และ `do_status=__other` เพื่อกรองสถานะรีวิวที่ไม่ใช่ `undone`, `done`, `skip` |
| `dateFrom`, `dateTo` | วันที่ `YYYY-MM-DD`; รวมวันเริ่มและวันสิ้นสุด |
| `sortBy` | `pub_date`, `id`, `status`, `do_status`, `title`; `title` เรียง `COALESCE(ai_title,title)` |
| `sortOrder` | `asc` หรือ `desc`; default `desc` |

ตัวอย่าง:

```text
/api/articles?page=1&pageSize=25&search=roblox&do_status=undone&dateFrom=2026-01-01&sortBy=pub_date&sortOrder=desc
```

ผลรายการมีรูปแบบ `{ items, page, pageSize, total, totalPages }`; ฟิลด์ `items` คือ array ของ article ตามคอลัมน์ในตาราง

**สถานะที่พบบ่อย:** `400` ค่าหรือ body ไม่ถูกต้อง, `401` ต้องยืนยันตัวตน, `403` Origin ไม่ตรงในการแก้สถานะ, `404` ไม่พบ article, `503` เชื่อมฐานข้อมูลหรือโหลดข้อมูลไม่สำเร็จ

## Deploy ด้วย Docker Compose

`compose.dashboard.yaml` เป็น service fragment สำหรับเพิ่ม dashboard เข้า Compose stack เดิม ไม่ใช่ไฟล์แทน stack ทั้งชุด โดยใช้ `DASHBOARD_BASE_PATH` ร่วมกันระหว่าง Traefik `PathPrefix` และ Next.js `basePath`; ต้องให้ external network ตาม `DOCKER_NETWORK_NAME` มีอยู่แล้วและเชื่อมกับ Traefik/PostgreSQL ไฟล์ `.env` ใช้ทั้งส่งค่าตัวแปรเข้า container และแทนค่าตัวแปรใน Compose; ต้องวางไว้ใน Compose project directory และตั้งค่าที่จำเป็นให้ถูกต้อง หากเปลี่ยน `DASHBOARD_BASE_PATH` ต้อง build image ใหม่

1. คัดลอก `.env.production.example` เป็น `.env` บน server แล้วตั้ง `DATABASE_URL`, `AUTH_USER`, `AUTH_PASSWORD`, `APP_TIME_ZONE`, `DASHBOARD_HOST`, `APP_ORIGIN`, `DB_SSL`, cert resolver และชื่อ external network ให้ตรงกับ stack จริง
2. Merge เฉพาะ service `dashboard` จาก `compose.dashboard.yaml` เข้ากับ compose file เดิม ตรวจ Traefik entrypoint, TLS resolver และชื่อ network ให้ตรงกับ stack ที่ใช้อยู่
3. สั่ง build และรันเฉพาะ dashboard:

   ```sh
   docker compose up -d --build dashboard
   docker compose ps
   docker compose logs -f dashboard
   ```

อย่าลบ volumes หรือสร้าง PostgreSQL service ใหม่เพื่อ deploy dashboard นี้ พอร์ต `3000` ของ dashboard เปิดให้ network ภายใน Compose และ Traefik ใช้; ไม่ได้ publish database port

## คำสั่งพัฒนาและ build

```sh
npm run dev
npm run build
npm run start
```

Production Docker image ปฏิเสธ `DATA_SOURCE=mock`; ต้องตั้งฐานข้อมูลจริงและ credentials ก่อนรัน container

## Troubleshooting

- **503: Dashboard authentication is not configured** — ตั้ง `AUTH_USER` และ `AUTH_PASSWORD`; ห้ามใช้ค่ารหัสผ่าน placeholder
- **503: Unable to load articles / filter values** — ตรวจ `DATA_SOURCE`, `DATABASE_URL`, สิทธิ์ role, host/network และดู log ของ dashboard
- **column does not exist / operator does not exist** — เปรียบเทียบ schema จริงกับรายการคอลัมน์และข้อกำหนดชนิดข้อมูลด้านบน แอปไม่มี migration หรือ fallback
- **เชื่อมต่อได้บน host แต่ไม่ได้ใน container** — ใช้ชื่อ service PostgreSQL และให้ทั้งสอง service อยู่ network เดียวกัน; `localhost` ใน container หมายถึง container เอง
- **ตั้งค่าแล้วเหมือนไม่เปลี่ยน** — รีสตาร์ต Next.js/container เพื่อโหลด environment variables ชุดใหม่
