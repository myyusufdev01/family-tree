import os
from dotenv import load_dotenv

load_dotenv()

FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID")

# ── Auth0 ────────────────────────────────────────────────────────────────────
# Tenant Auth0 (contoh: family-tree.us.auth0.com) dan identifier API (audience)
# yang didaftarkan di Auth0. Audience dipakai juga oleh frontend
# (NEXT_PUBLIC_AUTH0_AUDIENCE) supaya access token berupa JWT RS256.
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
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
