# 🌳 Family Tree — Frontend

Frontend web untuk aplikasi silsilah keluarga, dibangun dengan **Next.js 16**
(App Router + Turbopack), **React 19**, **Tailwind CSS 4**, dan **shadcn/ui**.

Aplikasi **sudah terpadu** — API (Route Handlers) dan akses Firestore ada di
project yang sama, tidak ada lagi backend Python terpisah.

## Struktur

```
src/
├── app/          # Halaman: / (dashboard), /members/..., /tree
│   └── api/      # Route Handlers — endpoint API (/api/health, /api/members, ...)
├── components/   # Komponen UI (shadcn/ui)
└── lib/          # API client (api.ts), types, Firestore, auth, stats, tree
```

## Menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Env yang dibutuhkan ada di `.env.local`
(contoh: `.env.example` di root repo). Jalankan test dengan `npm test`.

> Untuk dokumentasi lengkap aplikasi, lihat README utama di root project: `../README.md`.
