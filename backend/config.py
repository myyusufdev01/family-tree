import os
from dotenv import load_dotenv

load_dotenv()

FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID")

# ── Auth0 ────────────────────────────────────────────────────────────────────
# Tenant Auth0 (contoh: family-tree.us.auth0.com). Backend memverifikasi token
# via endpoint /userinfo Auth0, jadi tidak perlu audience/API terpisah.
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")

# Opsional/legacy — dipakai bila suatu saat ingin verifikasi JWT via JWKS
# (mengharuskan pembuatan API di Auth0 dan audience yang sama di frontend).
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE") or None
AUTH0_ISSUER = f"https://{AUTH0_DOMAIN}/" if AUTH0_DOMAIN else None

# Daftar Auth0 user ID (`sub`, contoh: "google-oauth2|123456") yang punya akses
# admin (approve/revoke user, statistik), dipisah koma.
ADMIN_SUBS = {s.strip() for s in os.getenv("ADMIN_SUBS", "").split(",") if s.strip()}

# Telegram (legacy — hanya dipakai alat migrasi dari versi 1, opsional)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not FIRESTORE_PROJECT_ID:
    raise ValueError("FIRESTORE_PROJECT_ID tidak ditemukan di .env")
if not AUTH0_DOMAIN:
    raise ValueError(
        "AUTH0_DOMAIN tidak ditemukan di .env — tambahkan tenant Auth0 "
        "(contoh: family-tree.us.auth0.com). Lihat backend/.env.example."
    )
