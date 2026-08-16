/**
 * Konfigurasi server (port dari `backend/config.py`).
 *
 * Nilai dibaca dari `process.env` saat dipanggil (lazy), bukan saat modul
 * di-import, supaya aman untuk test dan build (env hanya dibutuhkan di
 * runtime). Variabel ini bersifat server-only — jangan beri prefix
 * `NEXT_PUBLIC_`.
 */

export function getFirestoreProjectId(): string {
  const value = process.env.FIRESTORE_PROJECT_ID;
  if (!value) {
    throw new Error("FIRESTORE_PROJECT_ID tidak ditemukan di .env");
  }
  return value;
}

/** Tenant Auth0 (contoh: family-tree.us.auth0.com). */
export function getAuth0Domain(): string {
  const value = process.env.AUTH0_DOMAIN;
  if (!value) {
    throw new Error(
      "AUTH0_DOMAIN tidak ditemukan di .env — tambahkan tenant Auth0 " +
        "(contoh: family-tree.us.auth0.com). Lihat .env.example.",
    );
  }
  return value;
}

/**
 * Daftar Auth0 user ID (`sub`, contoh: "google-oauth2|123456") yang punya
 * akses admin (approve/revoke user, statistik), dipisah koma.
 */
export function getAdminSubs(): Set<string> {
  const value = process.env.ADMIN_SUBS ?? "";
  return new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Apakah `sub` termasuk admin (ADMIN_SUBS). */
export function isAdmin(sub: string | undefined | null): boolean {
  return Boolean(sub && getAdminSubs().has(sub));
}
