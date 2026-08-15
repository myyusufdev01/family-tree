# 🌳 Family Tree

Aplikasi web untuk mengelola **silsilah keluarga** — menambah & mengedit anggota, menghubungkan relasi orang tua–anak dan pasangan (suami–istri), mencari anggota, serta melihat pohon keluarga dari setiap anggota.

## 🧱 Teknologi

| Bagian    | Teknologi                                                                 |
|-----------|---------------------------------------------------------------------------|
| Frontend  | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/ui   |
| Backend   | Python FastAPI, Pydantic, Uvicorn                                         |
| Database  | Firebase Firestore (Cloud Firestore)                                      |
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
│       ├── app/              # Halaman: dashboard, tambah/edit, detail + silsilah
│       ├── components/ui/    # Komponen shadcn/ui
│       └── lib/              # API client, types, util
├── dev.sh                    # Jalankan backend + frontend sekaligus di local
├── Dockerfile                # Build image backend untuk Cloud Run
└── deploy.sh                 # Deploy manual ke Google Cloud Run
```

## ✅ Fitur

- Dashboard daftar anggota (paginasi + pencarian berdasarkan nama)
- Tambah / edit / hapus anggota (nama, jenis kelamin, tanggal lahir & wafat, telepon, catatan)
- Detail anggota + **pohon keluarga** (orang tua, pasangan, anak)
- Hubungkan / putuskan relasi orang tua–anak, pasangan, dan **saudara kandung**
- Format tanggal DD/MM/YYYY
- API admin (approve user & statistik)
- Data per-pengguna melalui parameter `user_id`

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
| GET    | `/api/members/{id}/tree`        | Pohon keluarga dari seorang anggota        |
| GET    | `/api/admin/users`              | Daftar user ter-approve (admin)            |
| POST   | `/api/admin/users`              | Approve user (admin)                       |
| DELETE | `/api/admin/users/{id}`         | Revoke user (admin)                        |
| GET    | `/api/admin/stats`              | Statistik aplikasi (admin)                 |

> Semua endpoint menerima query parameter opsional `user_id` untuk membedakan pohon per pengguna.

## ☁️ Deploy ke Google Cloud Run

- **Otomatis** — push ke branch `main` memicu workflow GitHub Actions (`.github/workflows/deploy.yml`).
- **Manual** — jalankan `./deploy.sh` (membutuhkan `gcloud` dan env var `TELEGRAM_BOT_TOKEN`).

## 🧬 Riwayat

- **v2 (saat ini)** — Migrasi dari Telegram bot ke web app Next.js + FastAPI (commit `440f7ae`).
- **v1** — Bot Telegram (`python-telegram-bot`) + Firestore — kode lama tidak dipakai lagi.
