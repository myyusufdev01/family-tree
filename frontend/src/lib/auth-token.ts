/**
 * Penyimpanan modul-level untuk Access Token Auth0.
 *
 * Token diisi oleh AuthSession (`components/providers.tsx`) setelah login dan
 * dipakai oleh `lib/api.ts` pada setiap request sebagai `Authorization: Bearer`.
 * Bila token sudah mendekati kedaluwarsa (klaim `exp`), token di-refresh otomatis
 * lewat handler yang didaftarkan oleh AuthSession.
 */

type TokenRefreshFn = () => Promise<string | null>;

let accessToken: string | null = null;
let refreshFn: TokenRefreshFn | null = null;
/** Dipanggil saat refresh token gagal — hampir selalu berarti sesi sudah berakhir. */
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setTokenRefreshFn(fn: TokenRefreshFn | null): void {
  refreshFn = fn;
}

/** Daftarkan callback yang dipanggil ketika refresh token gagal. */
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

/** Cek apakah JWT sudah kedaluwarsa berdasarkan klaim `exp` (tanpa verifikasi). */
function isJwtExpired(token: string): boolean {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return false;
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp)) return false;
    // Refresh 30 detik lebih awal dari waktu kedaluwarsa agar aman.
    return Date.now() >= (exp - 30) * 1000;
  } catch {
    return false;
  }
}

/** Token valid (belum kedaluwarsa), atau minta token baru lewat refresh handler. */
export async function getValidAccessToken(): Promise<string | null> {
  if (accessToken && !isJwtExpired(accessToken)) return accessToken;
  return refreshAccessToken();
}

/**
 * Paksa perbarui token (dipakai api.ts saat backend menolak token dengan 401).
 * Tanpa audience, token Auth0 berbentuk opaque (bukan JWT) sehingga tidak
 * memiliki klaim `exp` yang bisa dibaca — refresh dilakukan lewat handler SDK.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshFn) return accessToken;
  try {
    const fresh = await refreshFn();
    if (fresh) accessToken = fresh;
    return fresh;
  } catch {
    // Refresh gagal (mis. refresh token sudah kedaluwarsa/`invalid_grant`).
    // Jika sebelumnya ada token, berarti sesi dianggap sudah tidak valid.
    if (accessToken) {
      accessToken = null;
      onSessionExpired?.();
    }
    return null;
  }
}
