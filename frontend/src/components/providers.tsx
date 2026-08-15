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
import { setAccessToken, setTokenRefreshFn } from "@/lib/auth-token";

const AUTH0_DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "";
const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "";
const AUTH0_AUDIENCE = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "";

export const auth0Configured = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

interface AuthContextValue {
  isAuthenticated: boolean;
  /** Auth0 selesai memuat sesi (nilai `isLoading` dari SDK). */
  isReady: boolean;
  /** Access token sudah tersedia untuk dipakai API (bila sudah login). */
  tokenReady: boolean;
  user: User | undefined;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isReady: false,
  tokenReady: false,
  user: undefined,
  error: null,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

function AuthSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user, error, getAccessTokenSilently } =
    useAuth0();

  // Token disimpan di state (beserta `sub` user-nya) agar `tokenReady` bisa
  // diturunkan dan selalu sinkron dengan user yang sedang aktif.
  const [session, setSession] = useState<{
    sub: string | undefined;
    token: string | null;
  }>({ sub: undefined, token: null });

  // Simpan handler refresh token terbaru agar `lib/api.ts` selalu memakai versi
  // mutakhir dari SDK tanpa memicu re-render berlebihan.
  const getTokenRef = useRef(getAccessTokenSilently);
  useEffect(() => {
    getTokenRef.current = getAccessTokenSilently;
  });

  useEffect(() => {
    setTokenRefreshFn(() => getTokenRef.current());
    return () => setTokenRefreshFn(null);
  }, []);

  // Ambil access token setelah login dan perbarui saat user/sub berubah.
  useEffect(() => {
    if (!isAuthenticated) {
      setAccessToken(null);
      return;
    }
    let cancelled = false;
    getTokenRef
      .current()
      .then((token) => {
        if (cancelled) return;
        setAccessToken(token);
        setSession({ sub: user?.sub, token });
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setSession({ sub: user?.sub, token: null });
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.sub]);

  const tokenReady =
    isAuthenticated && session.token !== null && session.sub === user?.sub;

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isReady: !isLoading,
      tokenReady,
      user,
      error: error?.message ?? null,
    }),
    [isAuthenticated, isLoading, tokenReady, user, error]
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
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
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
