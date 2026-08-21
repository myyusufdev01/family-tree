"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Auth0Provider, useAuth0, type User } from "@auth0/auth0-react";
import {
  setAccessToken,
  setTokenRefreshFn,
  setSessionExpiredHandler,
} from "@/lib/auth-token";

const AUTH0_DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "";
const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "";

/**
 * Batas waktu menunggu access token. Refresh token yang sudah kedaluwarsa
 * biasanya gagal cepat (`invalid_grant`), tapi silent auth (iframe) kadang
 * menggantung tanpa balasan — timeout ini mencegah layar loading selamanya.
 */
const TOKEN_FETCH_TIMEOUT_MS = 10_000;

export const auth0Configured = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

interface AuthContextValue {
  isAuthenticated: boolean;
  /** Auth0 selesai memuat sesi (nilai `isLoading` dari SDK). */
  isReady: boolean;
  /** Access token sudah tersedia untuk dipakai API (bila sudah login). */
  tokenReady: boolean;
  /**
   * Sesi sudah berakhir — token tidak bisa diperbarui (refresh token
   * kedaluwarsa atau silent auth gagal). Pengguna dianggap belum login.
   */
  sessionExpired: boolean;
  user: User | undefined;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isReady: false,
  tokenReady: false,
  sessionExpired: false,
  user: undefined,
  error: null,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

function AuthSession({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    user,
    error,
    getAccessTokenSilently,
    logout,
  } = useAuth0();

  // Token disimpan di state (beserta `sub` user-nya) agar `tokenReady` bisa
  // diturunkan dan selalu sinkron dengan user yang sedang aktif.
  const [session, setSession] = useState<{
    sub: string | undefined;
    token: string | null;
  }>({ sub: undefined, token: null });

  /**
   * Menjadi `true` ketika access token gagal diperoleh/di-refresh — hampir
   * selalu berarti sesi sudah berakhir (refresh token kedaluwarsa). Tanpa ini,
   * SDK Auth0 tetap melaporkan `isAuthenticated: true` dari cache lokal yang
   * usang sehingga `RequireAuth` terjebak di layar loading selamanya.
   */
  const [sessionExpired, setSessionExpired] = useState(false);

  // Simpan handler refresh token terbaru agar `lib/api.ts` selalu memakai versi
  // mutakhir dari SDK tanpa memicu re-render berlebihan.
  const getTokenRef = useRef(getAccessTokenSilently);
  useEffect(() => {
    getTokenRef.current = getAccessTokenSilently;
  });

  useEffect(() => {
    setTokenRefreshFn(() => getTokenRef.current());
    // Jalur API (401 / refresh gagal) juga bisa menandai sesi sudah berakhir.
    setSessionExpiredHandler(() => setSessionExpired(true));
    return () => {
      setTokenRefreshFn(null);
      setSessionExpiredHandler(null);
    };
  }, []);

  // Ketika sesi dinyatakan berakhir, bersihkan cache Auth0 lokal tanpa membuka
  // halaman logout Auth0 (`openUrl: false`). SDK lalu mengeset
  // `isAuthenticated` menjadi `false`; state lokal di-reset di sini supaya
  // reload berikutnya mulai dari keadaan bersih, tidak mengulang loading macet.
  useEffect(() => {
    if (!sessionExpired) return;
    logout({ openUrl: false })
      .then(() => {
        setSession({ sub: undefined, token: null });
        setSessionExpired(false);
      })
      .catch(() => {
        // UI sudah mengarahkan ke layar login; kegagalan logout tidak kritis.
      });
  }, [sessionExpired, logout]);

  // Ambil access token setelah login dan perbarui saat user/sub berubah.
  useEffect(() => {
    if (!isAuthenticated) {
      // State `session`/`sessionExpired` di-reset di effect logout di atas;
      // di sini cukup bersihkan token modul-level.
      setAccessToken(null);
      return;
    }
    let cancelled = false;
    let settled = false;
    // Jaring pengaman: kalau silent auth menggantung, jangan biarkan layar
    // loading tampil selamanya.
    const timeoutId = setTimeout(() => {
      if (settled || cancelled) return;
      settled = true;
      setAccessToken(null);
      setSession({ sub: user?.sub, token: null });
      setSessionExpired(true);
    }, TOKEN_FETCH_TIMEOUT_MS);
    getTokenRef
      .current()
      .then((token) => {
        if (settled || cancelled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAccessToken(token);
        setSession({ sub: user?.sub, token });
        setSessionExpired(false);
      })
      .catch(() => {
        if (settled || cancelled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAccessToken(null);
        setSession({ sub: user?.sub, token: null });
        setSessionExpired(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isAuthenticated, user?.sub]);

  const tokenReady =
    isAuthenticated && session.token !== null && session.sub === user?.sub;

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isReady: !isLoading,
      tokenReady,
      sessionExpired,
      user,
      error: error?.message ?? null,
    }),
    [isAuthenticated, isLoading, tokenReady, sessionExpired, user, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const router = useRouter();

  if (!auth0Configured) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="max-w-md space-y-3 rounded-xl border bg-card p-6 text-center shadow-sm">
          <p className="text-3xl">🔐</p>
          <h1 className="text-lg font-semibold">Auth0 belum dikonfigurasi</h1>
          <p className="text-sm text-muted-foreground">
            Tambahkan <code>NEXT_PUBLIC_AUTH0_DOMAIN</code> dan{" "}
            <code>NEXT_PUBLIC_AUTH0_CLIENT_ID</code> di{" "}
            <code>frontend/.env.local</code>, lalu jalankan ulang{" "}
            <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri:
          typeof window !== "undefined" ? window.location.origin : undefined,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={(appState) => {
        router.replace(appState?.returnTo || "/");
      }}
    >
      <AuthSession>{children}</AuthSession>
    </Auth0Provider>
  );
}
