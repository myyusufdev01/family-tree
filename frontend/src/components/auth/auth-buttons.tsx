"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout } =
    useAuth0();
  const pathname = usePathname();

  if (isLoading) {
    return <Skeleton className="h-8 w-24 rounded-md" />;
  }

  if (!isAuthenticated) {
    return (
      <Button
        size="sm"
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
        onClick={() =>
          logout({ logoutParams: { returnTo: window.location.origin } })
        }
      >
        Keluar
      </Button>
    </div>
  );
}
