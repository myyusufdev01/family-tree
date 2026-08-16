#!/usr/bin/env bash
#
# dev.sh — Jalankan aplikasi Family Tree (Next.js terpadu: UI + API + Firestore).
#
#   ./dev.sh
#   PORT=3000 ./dev.sh
#
# Aplikasi : http://localhost:3000  (health API: /api/health)
#
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT="${PORT:-3000}"

info()    { echo -e "\033[1;36m[dev]\033[0m $*"; }
success() { echo -e "\033[1;32m[dev]\033[0m $*"; }
error()   { echo -e "\033[1;31m[dev]\033[0m $*" >&2; }

# ── Validasi environment ─────────────────────────────────────────────────────
if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  error "Dependensi belum diinstall (frontend/node_modules)."
  error "Install dulu:"
  echo ""
  echo "  cd frontend && npm install"
  echo ""
  exit 1
fi

if [ ! -f "$ROOT_DIR/frontend/.env.local" ]; then
  error "frontend/.env.local belum ada. Salin dari contoh:"
  echo ""
  echo "  cp .env.example frontend/.env.local"
  echo ""
  error "Lalu isi FIRESTORE_PROJECT_ID, AUTH0_DOMAIN, ADMIN_SUBS, dan"
  error "letakkan serviceAccountKey.json di folder frontend/."
  exit 1
fi

# ── Aplikasi (Next.js — UI + API + Firestore) ────────────────────────────────
info "Menjalankan Family Tree di http://localhost:${FRONTEND_PORT}  (health: /api/health)"
(
  cd "$ROOT_DIR/frontend"
  exec npm run dev -- -p "$FRONTEND_PORT"
)

