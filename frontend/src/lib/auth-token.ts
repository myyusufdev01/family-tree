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

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setTokenRefreshFn(fn: TokenRefreshFn | null): void {
  refreshFn = fn;
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
  if (refreshFn) {
    const fresh = await refreshFn();
    if (fresh) accessToken = fresh;
    return fresh;
  }
  return accessToken;
}
