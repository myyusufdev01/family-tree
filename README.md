# 🌳 Family Tree

Aplikasi web untuk mengelola **silsilah keluarga** — menambah & mengedit anggota, menghubungkan relasi orang tua–anak dan pasangan (suami–istri), mencari anggota, serta melihat pohon keluarga dari setiap anggota.

## 🧱 Teknologi

| Bagian    | Teknologi                                                                 |
|-----------|---------------------------------------------------------------------------|
| Aplikasi  | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/ui   |
| Backend   | Route Handlers Next.js (TypeScript) — satu project dengan UI              |
| Database  | Firebase Firestore (Cloud Firestore) via `@google-cloud/firestore`        |
| Autentikasi | Auth0 — Universal Login (SPA SDK) + verifikasi token via `/userinfo`    |
| Deploy    | Google Cloud Run (Docker) — manual (`deploy.sh`) atau CI GitHub Actions   |

## 📁 Struktur Project

```
.
├── frontend/                  # Aplikasi Next.js (UI + API + akses Firestore)
│   └── src/
│       ├── app/               # Halaman + Route Handlers API (app/api/**)
│       ├── components/        # Komponen UI (shadcn/ui) & tree view
│       └── lib/               # API client, types, Firestore, auth, stats, tree
├── dev.sh                     # Jalankan aplikasi di local (satu proses)
├── Dockerfile                 # Build image Next.js (standalone) untuk Cloud Run
└── deploy.sh                  # Deploy manual ke Google Cloud Run
```

## ✅ Fitur

- Dashboard daftar anggota (paginasi + pencarian berdasarkan nama)
- Tambah / edit / hapus anggota (nama, jenis kelamin, tanggal lahir & wafat, telepon, catatan)
- Detail anggota + **pohon keluarga** visual (terfokus maks. 80 anggota, 3 generasi ke atas/bawah)
- Hubungkan / putuskan relasi orang tua–anak, pasangan, dan **saudara kandung**
- Format tanggal DD/MM/YYYY
- **Login wajib via Auth0** (Universal Login) — seluruh anggota keluarga berbagi **satu pohon** yang sama
- **Menautkan akun user khusus admin** — hanya admin (`ADMIN_SUBS`) yang bisa menautkan akun Auth0 ke anggota silsilah lewat UI; admin bebas menautkan siapa saja (termasuk dirinya sendiri untuk setup awal)
- **Group (pengelompokan anggota) khusus admin** — CRUD group di halaman `/groups` (kode, nama, deskripsi); admin memasangkan setiap user ke satu atau lebih group lewat bagian **"Akses Login → Group User"** di halaman detail anggota (`PUT /api/members/{id}/groups`)
- **Status PIC (Person In Charge) khusus admin** — admin menunjuk user sebagai PIC di halaman detail anggota (`PUT /api/members/{id}/pic`). PIC menambah anggota baru yang **otomatis masuk ke group-nya**, dan membuat **koneksi antar user di group yang sama** (orang tua dari / anak dari / pasangan dari)
- **Menambah anggota = anak/pasangan Anda (kecuali admin)** — hanya user yang akunnya sudah tertaut yang bisa menambah anggota; anggota baru otomatis terhubung sebagai **anak** (default) atau **pasangan** bagi non-admin. Admin menambah **tanpa relasi otomatis**. **PIC**: anggota baru juga otomatis masuk ke semua group-nya
- **Koneksi terbatas di group yang sama** — koneksi orang tua/anak/pasangan oleh non-admin hanya boleh antar user yang berada di group yang sama; admin bebas
- **Edit/hapus anggota terbatas di group yang sama** — non-admin hanya bisa mengubah/menghapus anggota yang satu group dengannya (self-edit tetap diizinkan); admin bebas
- API admin (approve user & statistik, berdasarkan `ADMIN_SUBS` di Auth0)
- Data pohon bersama di `user_id=0` (kompatibel dengan data existing)

## 🚀 Menjalankan di Local

### Prasyarat

- Node.js 20+
- Kredensial service account Firebase (`frontend/serviceAccountKey.json`) dan Project ID Firestore yang aktif

### 1. Setup environment

```bash
cp .env.example frontend/.env.local
# Lalu isi FIRESTORE_PROJECT_ID, AUTH0_DOMAIN, ADMIN_SUBS, dan
# letakkan serviceAccountKey.json di folder frontend/
```

### 2. Install dependensi

```bash
cd frontend
npm install
```

### 3. Jalankan

```bash
./dev.sh
# atau: cd frontend && npm run dev
```

Buka **http://localhost:3000**. Health check API tersedia di **http://localhost:3000/api/health**.

## 🔐 Autentikasi Auth0

Semua halaman & API dilindungi login Auth0. Pendekatan: **SPA tanpa audience** —
tidak perlu membuat API di Auth0. Access token (opaque) diverifikasi server
(Route Handler) dengan memanggil endpoint `/userinfo` Auth0.

### 1. Setup di Auth0 Dashboard

1. Buat aplikasi **Single Page Application** (mis. `Family Tree Web`) dan catat **Domain** + **Client ID**-nya.
2. Di pengaturan aplikasi SPA, isi URL berikut (untuk deployment Cloud Run `family-tree-bot`,
   tambahkan URL di bawah — sesuaikan bila memakai domain sendiri):
   - **Allowed Callback URLs** : `http://localhost:3000,https://family-tree-bot-491602777728.asia-southeast1.run.app,https://family-tree-bot-ijkjkov7sq-as.a.run.app`
   - **Allowed Logout URLs** : `http://localhost:3000,https://family-tree-bot-491602777728.asia-southeast1.run.app,https://family-tree-bot-ijkjkov7sq-as.a.run.app`
   - **Allowed Web Origins**   : `http://localhost:3000,https://family-tree-bot-491602777728.asia-southeast1.run.app,https://family-tree-bot-ijkjkov7sq-as.a.run.app`
   > Jika muncul error **"Callback URL mismatch"** saat login, berarti URL yang dikunjungi belum
   > didaftarkan di **Allowed Callback URLs** di atas (aplikasi mengirim `window.location.origin`
   > sebagai `redirect_uri`).
3. **Tidak perlu membuat API** di Auth0 — karena token diverifikasi via `/userinfo`, audience/API tidak dipakai.

### 2. Variabel environment (`frontend/.env.local`)

```bash
# Server-only (tidak pernah terkirim ke browser)
AUTH0_DOMAIN=your-tenant.auth0.com          # dari Auth0 Dashboard
ADMIN_SUBS=                                 # Auth0 user ID (sub) admin, dipisah koma

# Public (di-inline ke bundle browser)
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your_client_id
```

### 3. Cara kerja

- Frontend memakai `@auth0/auth0-react` (Universal Login). Setelah login, access token
  dikirim ke API sebagai header `Authorization: Bearer <token>` untuk setiap request.
- Route Handler memverifikasi token dengan memanggil `GET https://{domain}/userinfo`
  (hasil di-cache 5 menit per token) lewat `src/lib/auth.ts` — semua endpoint
  `/api/*` kecuali `/health` memerlukan token valid (HTTP 401 bila tidak ada/tidak valid).
- Akses admin ditentukan dari nilai `sub` (User ID Auth0) dibandingkan dengan `ADMIN_SUBS`.
  Cara melihat `sub`: Auth0 Dashboard → **User Management → Users** → klik user → salin
  field **"User ID"** (contoh: `google-oauth2|12345`).

### 4. User ↔ Anggota (menautkan akun — khusus admin)

Fitur menautkan akun user ke anggota silsilah **hanya bisa diakses admin** (`ADMIN_SUBS`):

1. Setiap akun Auth0 yang boleh masuk ditautkan ke **satu anggota silsilah** lewat field
   `auth0_sub` pada dokumen Member (1 akun = 1 anggota).
2. Admin menautkan akun lewat **UI** di halaman detail anggota (`🔐 Akses Login`) dengan
   memasukkan **Auth0 User ID (`sub`)** dari orang yang akan diberi akses.
3. Aturan backend:
   - Non-admin tidak bisa mengakses fitur ini (**403**).
   - Admin bebas menautkan siapa saja — termasuk dirinya sendiri untuk setup awal.
   - Admin boleh mengganti tautan lama dengan tautan baru.
4. Cara melihat `sub`: Auth0 Dashboard → **User Management → Users** → klik user → salin
   field **"User ID"**.
5. **Menambah anggota**: hanya user yang akunnya sudah tertaut yang boleh menambah anggota
   (`POST /api/members`). User belum tertaut mendapat **403**. Anggota baru otomatis
   terhubung ke user penambah (non-admin, non-PIC) sebagai **anak** (default) atau **pasangan**
   (field `relation`). **Admin & PIC tidak perlu memilih** — anggota yang ditambah dibuat
   tanpa relasi otomatis (bisa dihubungkan manual lewat halaman edit). Khusus **PIC**, anggota
   baru otomatis masuk ke semua group-nya. Tombol "Tambah Anggota" di UI hanya tampil untuk
   user yang berhak.

## 🔌 API Backend

| Method | Endpoint                        | Deskripsi                                  |
|--------|---------------------------------|--------------------------------------------|
| GET    | `/api/health`                   | Health check                               |
| GET    | `/api/members`                  | Daftar anggota (paginated)                 |
| GET    | `/api/members/search?q=`        | Cari anggota berdasarkan nama              |
| POST   | `/api/members`                  | Tambah anggota                             |
| GET    | `/api/members/{id}`             | Detail anggota                             |
| PUT    | `/api/members/{id}`             | Update anggota                             |
| DELETE | `/api/members/{id}`             | Hapus anggota                              |
| POST   | `/api/members/link`             | Hubungkan relasi (`parent_child` / `spouse` / `sibling`) |
| POST   | `/api/members/unlink`           | Putuskan relasi                                        |
| GET    | `/api/members/{id}/tree`        | Pohon keluarga terfokus (`max_nodes`, `depth_up`, `depth_down`) |
| GET    | `/api/me`                       | Identitas user login di silsilah (`member`, `is_admin`) |
| POST   | `/api/members/{id}/link-user`   | Tautkan akun Auth0 ke anggota — khusus admin            |
| GET    | `/api/admin/users`              | Daftar user ter-approve (admin)            |
| POST   | `/api/admin/users`              | Approve user (admin)                       |
| DELETE | `/api/admin/users/{id}`         | Revoke user (admin)                        |
| GET    | `/api/admin/stats`              | Statistik aplikasi (admin)                 |
| GET    | `/api/dashboard/stats`          | Statistik dashboard                        |

> Semua endpoint (kecuali `/api/health`) memerlukan header `Authorization: Bearer <token>` dari Auth0.
> Query parameter `user_id` tetap diterima (default `0` = pohon bersama keluarga).

## 🧪 Testing

```bash
cd frontend
npm test
```

## ☁️ Deploy ke Google Cloud Run

- **Otomatis** — push ke branch `main` memicu workflow GitHub Actions (`.github/workflows/deploy.yml`).
  Secret yang dibutuhkan: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`, `NEXT_PUBLIC_AUTH0_DOMAIN`,
  `NEXT_PUBLIC_AUTH0_CLIENT_ID`, `AUTH0_DOMAIN`, `ADMIN_SUBS`.
- **Manual** — jalankan `./deploy.sh` (membutuhkan `gcloud`; nilai env dibaca dari `frontend/.env.local`).

## 🧬 Riwayat

- **v3 (saat ini)** — Penyatuan backend ke Next.js (Route Handlers + `@google-cloud/firestore`); backend Python/FastAPI dihapus.
- **v2** — Migrasi dari Telegram bot ke web app Next.js + FastAPI (commit `440f7ae`).
- **v1** — Bot Telegram (`python-telegram-bot`) + Firestore — kode lama tidak dipakai lagi.
