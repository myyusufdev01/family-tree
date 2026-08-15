# 🌳 Family Tree

Aplikasi web untuk mengelola **silsilah keluarga** — menambah & mengedit anggota, menghubungkan relasi orang tua–anak dan pasangan (suami–istri), mencari anggota, serta melihat pohon keluarga dari setiap anggota.

## 🧱 Teknologi

| Bagian    | Teknologi                                                                 |
|-----------|---------------------------------------------------------------------------|
| Frontend  | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/ui   |
| Backend   | Python FastAPI, Pydantic, Uvicorn                                         |
| Database  | Firebase Firestore (Cloud Firestore)                                      |
| Autentikasi | Auth0 — Universal Login (SPA SDK) + verifikasi token via `/userinfo`   |
| Deploy    | Google Cloud Run (Docker) — manual (`deploy.sh`) atau CI GitHub Actions   |

## 📁 Struktur Project

```
.
├── backend/                  # REST API (FastAPI)
│   ├── main.py               # Definisi app & semua endpoint
│   ├── config.py             # Konfigurasi env (Firestore, token)
│   ├── models/member.py      # Model data Member
│   ├── db/firestore.py       # Akses Firestore (CRUD, relasi, admin)
│   ├── utils/tree_renderer.py# Helper render pohon keluarga
│   ├── requirements.txt      # Dependensi Python
│   └── .env                  # Kredensial lokal (tidak di-commit)
├── frontend/                 # Web UI (Next.js 16)
│   └── src/
│       ├── app/              # Halaman: dashboard, tambah/edit, detail + silsilah, pohon keluarga
│       ├── components/       # Komponen UI (shadcn/ui) & tree view
│       └── lib/              # API client, types, util
├── dev.sh                    # Jalankan backend + frontend sekaligus di local
├── Dockerfile                # Build image backend untuk Cloud Run
└── deploy.sh                 # Deploy manual ke Google Cloud Run
```

## ✅ Fitur

- Dashboard daftar anggota (paginasi + pencarian berdasarkan nama)
- Tambah / edit / hapus anggota (nama, jenis kelamin, tanggal lahir & wafat, telepon, catatan)
- Detail anggota + **pohon keluarga** visual (terfokus maks. 80 anggota, 3 generasi ke atas/bawah)
- Hubungkan / putuskan relasi orang tua–anak, pasangan, dan **saudara kandung**
- Format tanggal DD/MM/YYYY
- **Login wajib via Auth0** (Universal Login) — seluruh anggota keluarga berbagi **satu pohon** yang sama
- **Menautkan akun user khusus admin** — hanya admin (`ADMIN_SUBS`) yang bisa menautkan akun Auth0 ke anggota silsilah lewat UI; admin bebas menautkan siapa saja (termasuk dirinya sendiri untuk setup awal)
- **Menambah anggota = anak/pasangan Anda (kecuali admin)** — hanya user yang akunnya sudah tertaut yang bisa menambah anggota; anggota baru otomatis terhubung sebagai **anak** (default) atau **pasangan** bagi non-admin. Admin menambah **tanpa relasi otomatis**
- API admin (approve user & statistik, berdasarkan `ADMIN_SUBS` di Auth0)
- Data pohon bersama di `user_id=0` (kompatibel dengan data existing)

## 🚀 Menjalankan di Local

### Prasyarat

- Python 3.11+ dan Node.js 20+
- Kredensial service account Firebase (`backend/serviceAccountKey.json`) dan Project ID Firestore yang aktif

### 1. Setup environment

```bash
# Backend — salin dari contoh lalu isi sesuai project Firestore-mu
cp backend/.env.example backend/.env
# Letakkan serviceAccountKey.json di folder backend/

# Frontend — buat file .env.local dengan URL backend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > frontend/.env.local
```

### 2. Install dependensi

```bash
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cd ../frontend
npm install
cd ..
```

### 3. Jalankan

Cara termudah — menjalankan backend & frontend sekaligus (bisa diberhentikan dengan `Ctrl+C`):

```bash
./dev.sh
```

Atau manual (buka **2 terminal**):

```bash
# Terminal 1 — Backend di http://localhost:8000
cd backend
venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend di http://localhost:3000
cd frontend
npm run dev
```

Lalu buka **http://localhost:3000**. Dokumentasi API backend (Swagger UI) tersedia di **http://localhost:8000/docs**, health check di `/health`.

## 🔐 Autentikasi Auth0

Semua halaman & API dilindungi login Auth0. Pendekatan: **SPA tanpa audience** —
tidak perlu membuat API di Auth0. Access token (opaque) diverifikasi backend
dengan memanggil endpoint `/userinfo` Auth0.

### 1. Setup di Auth0 Dashboard

1. Buat aplikasi **Single Page Application** (mis. `Family Tree Web`) dan catat **Domain** + **Client ID**-nya.
2. Di pengaturan aplikasi SPA, isi URL berikut (ganti `https://your-app.example.com` sesuai deployment):
   - **Allowed Callback URLs** : `http://localhost:3000,https://your-app.example.com`
   - **Allowed Logout URLs** : `http://localhost:3000,https://your-app.example.com`
   - **Allowed Web Origins**   : `http://localhost:3000,https://your-app.example.com`
3. **Tidak perlu membuat API** di Auth0 — karena token diverifikasi via `/userinfo`, audience/API tidak dipakai.

### 2. Variabel environment

```bash
# backend/.env
AUTH0_DOMAIN=your-tenant.auth0.com          # dari Auth0 Dashboard
ADMIN_SUBS=                                 # Auth0 user ID (sub) admin, dipisah koma

# frontend/.env.local
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your_client_id
```

### 3. Cara kerja

- Frontend memakai `@auth0/auth0-react` (Universal Login). Setelah login, access token
  dikirim ke backend sebagai header `Authorization: Bearer <token>` untuk setiap request.
- Backend memverifikasi token dengan memanggil `GET https://{domain}/userinfo`
  (hasil di-cache 5 menit per token) lewat `backend/auth/auth0.py` — semua endpoint
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
   terhubung ke user penambah (non-admin) sebagai **anak** (default) atau **pasangan**
   (field `relation`). **Admin tidak perlu memilih** — anggota yang ditambah admin dibuat
   tanpa relasi otomatis (bisa dihubungkan manual lewat halaman edit). Tombol "Tambah
   Anggota" di UI hanya tampil untuk user yang berhak.

## 🔌 API Backend

| Method | Endpoint                        | Deskripsi                                  |
|--------|---------------------------------|--------------------------------------------|
| GET    | `/health`                       | Health check                               |
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

> Semua endpoint (kecuali `/health`) memerlukan header `Authorization: Bearer <token>` dari Auth0.
> Query parameter `user_id` tetap diterima (default `0` = pohon bersama keluarga).

## ☁️ Deploy ke Google Cloud Run

- **Otomatis** — push ke branch `main` memicu workflow GitHub Actions (`.github/workflows/deploy.yml`).
- **Manual** — jalankan `./deploy.sh` (membutuhkan `gcloud` dan env var `TELEGRAM_BOT_TOKEN`).

## 🧬 Riwayat

- **v2 (saat ini)** — Migrasi dari Telegram bot ke web app Next.js + FastAPI (commit `440f7ae`).
- **v1** — Bot Telegram (`python-telegram-bot`) + Firestore — kode lama tidak dipakai lagi.
