"use client";

import type { ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingScreen() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="animate-pulse text-4xl">🌳</div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-64" />
      <p className="text-sm text-muted-foreground">Memeriksa sesi Anda…</p>
    </div>
  );
}

function LoginScreen() {
  const { loginWithRedirect, error } = useAuth0();

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="text-5xl">🌳</div>
        <h1 className="text-2xl font-semibold tracking-tight">Family Tree</h1>
        <p className="text-sm text-muted-foreground">
          Masuk untuk mengelola silsilah keluarga Anda.
        </p>
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error.message}
          </p>
        ) : null}
        <Button
          className="w-full"
          size="lg"
          onClick={() =>
            loginWithRedirect({
              appState: {
                returnTo:
                  window.location.pathname + window.location.search,
              },
              authorizationParams: { screen_hint: "login" },
            })
          }
        >
          Masuk dengan Auth0
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Anda akan diarahkan ke halaman login Auth0.
        </p>
      </div>
    </div>
  );
}

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isReady, isAuthenticated, tokenReady } = useAuth();

  if (!isReady || (isAuthenticated && !tokenReady)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
