import { getAuth0Domain } from "./config";
import { HttpError } from "./http";

/**
 * Verifikasi token Auth0 (port dari `backend/auth/auth0.py`).
 *
 * Aplikasi SPA tidak memakai audience/API Auth0, sehingga access token yang
 * diterbitkan Auth0 berbentuk *opaque* (bukan JWT) dan tidak bisa diverifikasi
 * lokal. Karena itu token diverifikasi dengan memanggil endpoint ``/userinfo``
 * Auth0 (pola standar Auth0 untuk SPA tanpa audience):
 *
 *   1. Baca header `Authorization: Bearer <token>`.
 *   2. Panggil GET https://<domain>/userinfo dengan token tersebut.
 *   3. Respons 200 = token valid → profil user (klaim `sub`, `email`, dst.).
 *      Respons 401 = token tidak valid / kedaluwarsa.
 *
 * Hasil verifikasi di-cache per token (5 menit) agar tidak memanggil Auth0
 * berulang-ulang.
 */

export interface UserProfile {
  sub: string;
  [key: string]: unknown;
}

const USERINFO_CACHE_TTL_SECONDS = 300; // 5 menit
const USERINFO_CACHE_MAX_ENTRIES = 200;

const _cache = new Map<string, { time: number; profile: UserProfile }>();

function userinfoUrl(): string {
  return `https://${getAuth0Domain()}/userinfo`;
}

async function _verify(token: string): Promise<UserProfile> {
  let response: Response;
  try {
    response = await fetch(userinfoUrl(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new HttpError(
      503,
      "Gagal menghubungi Auth0 untuk verifikasi token",
    );
  }

  if (response.status !== 200) {
    throw new HttpError(401, "Token tidak valid atau kedaluwarsa");
  }
  return (await response.json()) as UserProfile;
}

/** Verifikasi token via /userinfo Auth0; hasil di-cache per token. */
export async function verifyAccessToken(token: string): Promise<UserProfile> {
  const now = Date.now();
  const cached = _cache.get(token);
  if (cached && now - cached.time < USERINFO_CACHE_TTL_SECONDS * 1000) {
    return cached.profile;
  }

  const profile = await _verify(token);
  if (_cache.size >= USERINFO_CACHE_MAX_ENTRIES) {
    _cache.clear();
  }
  _cache.set(token, { time: now, profile });
  return profile;
}

/** Profil user Auth0 yang login, dari header `Authorization: Bearer <token>`. */
export async function getCurrentUser(
  authorization: string | null | undefined,
): Promise<UserProfile> {
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(
      401,
      "Autentikasi diperlukan (Authorization: Bearer <token>)",
    );
  }
  const token = authorization.split(" ", 2)[1]?.trim() ?? "";
  return verifyAccessToken(token);
}
