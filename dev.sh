#!/usr/bin/env bash
#
# dev.sh — Jalankan aplikasi Family Tree (backend + frontend) di local.
#
#   ./dev.sh
#   PORT=8080 ./dev.sh        # ganti port backend
#
# Backend  : http://localhost:8000  (docs: /docs, health: /health)
# Frontend : http://localhost:3000
#
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${PORT:-8000}"
FRONTEND_PORT=3000

BACKEND_PID=""
FRONTEND_PID=""

info()    { echo -e "\033[1;36m[dev]\033[0m $*"; }
success() { echo -e "\033[1;32m[dev]\033[0m $*"; }
error()   { echo -e "\033[1;31m[dev]\033[0m $*" >&2; }

# ── Validasi environment ─────────────────────────────────────────────────────
if [ ! -x "$ROOT_DIR/backend/venv/bin/python" ]; then
  error "Virtualenv backend tidak ditemukan (backend/venv)."
  error "Buat dulu:"
  echo ""
  echo "  cd backend"
  echo "  python3 -m venv venv"
  echo "  venv/bin/pip install -r requirements.txt"
  echo ""
  exit 1
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  error "Dependensi frontend belum diinstall (frontend/node_modules)."
  error "Install dulu:"
  echo ""
  echo "  cd frontend && npm install"
  echo ""
  exit 1
fi

if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  error "backend/.env belum ada. Salin dari contoh:"
  echo ""
  echo "  cp backend/.env.example backend/.env"
  echo ""
  error "Lalu isi FIRESTORE_PROJECT_ID dan letakkan serviceAccountKey.json di backend/."
  exit 1
fi

# ── Cleanup saat Ctrl+C / exit ───────────────────────────────────────────────
cleanup() {
  echo ""
  success "Menghentikan server dev..."
  [ -n "$BACKEND_PID" ] && kill -TERM "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  sleep 1
  [ -n "$BACKEND_PID" ] && kill -KILL "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill -KILL "$FRONTEND_PID" 2>/dev/null || true
  success "Selesai."
}
trap cleanup EXIT INT TERM

# ── Backend (FastAPI) ────────────────────────────────────────────────────────
info "Menjalankan backend FastAPI di http://localhost:${BACKEND_PORT} (docs: /docs)"
(
  cd "$ROOT_DIR/backend"
  exec venv/bin/python -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "$BACKEND_PORT" \
    --reload
) &
BACKEND_PID=$!

# ── Frontend (Next.js) ───────────────────────────────────────────────────────
info "Menjalankan frontend Next.js di http://localhost:${FRONTEND_PORT}"
(
  cd "$ROOT_DIR/frontend"
  exec npm run dev
) &
FRONTEND_PID=$!

success "Semua server berjalan. Tekan Ctrl+C untuk menghentikan keduanya."
success "  → Frontend : http://localhost:${FRONTEND_PORT}"
success "  → Backend  : http://localhost:${BACKEND_PORT}  (health: /health, docs: /docs)"

# ── Tunggu hingga salah satu server berhenti ─────────────────────────────────
wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || wait "$BACKEND_PID" "$FRONTEND_PID"
