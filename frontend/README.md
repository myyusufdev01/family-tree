# 🌳 Family Tree — Frontend

Frontend web untuk aplikasi silsilah keluarga, dibangun dengan **Next.js 16** (App Router + Turbopack), **React 19**, **Tailwind CSS 4**, dan **shadcn/ui**.

## Struktur

```
src/
├── app/          # Halaman: / (dashboard), /members/add, /members/[id], /members/[id]/edit
├── components/   # Komponen UI (shadcn/ui)
└── lib/          # API client (api.ts), types, util
```

## Menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Frontend mengakses backend melalui env `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) — lihat `.env.local`.

> Untuk menjalankan **seluruh aplikasi** (backend + frontend), lihat README utama di root project: `../README.md`.
