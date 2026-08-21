"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMe } from "@/lib/api";
import { useAuth0 } from "@auth0/auth0-react";
import { useAuth } from "@/components/providers";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, List, LogIn, LogOut, Menu, TreePine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (p: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, isActive: (p) => p === "/" },
  {
    href: "/members",
    label: "List",
    icon: List,
    isActive: (p) =>
      p === "/members" || (p.startsWith("/members/") && !p.startsWith("/members/add")),
  },
  { href: "/tree", label: "Pohon", icon: TreePine, isActive: (p) => p.startsWith("/tree") },
];

/** Item nav yang hanya tampil untuk admin. */
const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    href: "/groups",
    label: "Group",
    icon: Users,
    isActive: (p) => p === "/groups" || p.startsWith("/groups/"),
  },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    isLoading: isAuthLoading,
    loginWithRedirect,
    logout,
  } = useAuth0();
  // Status efektif dari context — saat sesi berakhir (`sessionExpired`),
  // menu harus menampilkan opsi "Masuk" alih-alih informasi pengguna yang usang.
  const { isAuthenticated, sessionExpired } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const loggedIn = isAuthenticated && !sessionExpired;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) setIsAdmin(me.is_admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [...NAV_ITEMS, ...(isAdmin ? ADMIN_NAV_ITEMS : [])];

  return (
    <>
      {/* Navigasi horizontal — ditampilkan dari layar md ke atas */}
      <nav className="ml-auto hidden items-center gap-1 md:flex">
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Menu burger — ditampilkan di layar kecil (di bawah md) */}
      <div className="ml-auto md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Buka menu navigasi"
                title="Menu"
              >
                <Menu className="size-5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-56 p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Menu</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {items.map((item) => {
                const active = item.isActive(pathname);
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "gap-2 py-2",
                      active && "bg-accent font-semibold text-accent-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                    {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            {!isAuthLoading && (
              <>
                <DropdownMenuSeparator />
                {loggedIn ? (
                  <DropdownMenuGroup>
                    <div className="px-1.5 py-1">
                      <p className="truncate text-sm font-medium leading-tight">
                        {user?.name || user?.email || user?.nickname || "Pengguna"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Terhubung via Auth0</p>
                    </div>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        logout({ logoutParams: { returnTo: window.location.origin } })
                      }
                      className="gap-2 py-2"
                    >
                      <LogOut className="size-4" />
                      Keluar
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                ) : (
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() =>
                        loginWithRedirect({
                          appState: { returnTo: pathname || "/" },
                          authorizationParams: { screen_hint: "login" },
                        })
                      }
                      className="gap-2 py-2"
                    >
                      <LogIn className="size-4" />
                      Masuk
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

