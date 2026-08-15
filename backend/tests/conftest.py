"""Setup env vars yang dibutuhkan sebelum modul app diimpor (dijalankan pytest lebih dulu)."""
import os

os.environ.setdefault("FIRESTORE_PROJECT_ID", "family-tree-test")
os.environ.setdefault("AUTH0_DOMAIN", "test.auth0.com")
os.environ.setdefault("ADMIN_SUBS", "")
