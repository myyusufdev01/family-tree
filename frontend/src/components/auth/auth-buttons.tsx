"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers";

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AuthButtons() {
  const { isLoading, loginWithRedirect, logout } = useAuth0();
  // Pakai status efektif dari context: saat sesi berakhir (`sessionExpired`),
  // pengguna harus diperlakukan seperti belum login walau SDK masih melaporkan
  // `isAuthenticated: true` dari cache lokal yang usang.
  const { isAuthenticated, sessionExpired, user } = useAuth();
  const pathname = usePathname();

  const loggedIn = isAuthenticated && !sessionExpired;

  if (isLoading) {
    return <Skeleton className="h-8 w-24 rounded-md" />;
  }

  if (!loggedIn) {
    return (
      <Button
        size="sm"
        className="hidden md:inline-flex"
        onClick={() =>
          loginWithRedirect({
            appState: { returnTo: pathname || "/" },
            authorizationParams: { screen_hint: "login" },
          })
        }
      >
        Masuk
      </Button>
    );
  }

  const displayName =
    user?.name || user?.email || user?.nickname || "Pengguna";

  return (
    <div className="flex items-center gap-2">
      <div className="hidden flex-col items-end sm:flex">
        <span className="max-w-[160px] truncate text-xs font-medium leading-tight">
          {displayName}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Terhubung via Auth0
        </span>
      </div>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        title={displayName}
      >
        {initials(displayName)}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="hidden md:inline-flex"
        onClick={() =>
          logout({ logoutParams: { returnTo: window.location.origin } })
        }
      >
        Keluar
      </Button>
    </div>
  );
}
