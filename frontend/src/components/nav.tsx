"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMe } from "@/lib/api";

const NAV_ITEMS: { href: string; label: string; isActive: (p: string) => boolean }[] = [
  { href: "/", label: "Dashboard", isActive: (p) => p === "/" },
  {
    href: "/members",
    label: "List",
    isActive: (p) =>
      p === "/members" || (p.startsWith("/members/") && !p.startsWith("/members/add")),
  },
  { href: "/tree", label: "Pohon", isActive: (p) => p.startsWith("/tree") },
];

/** Item nav yang hanya tampil untuk admin. */
const ADMIN_NAV_ITEMS: { href: string; label: string; isActive: (p: string) => boolean }[] = [
  {
    href: "/groups",
    label: "Group",
    isActive: (p) => p === "/groups" || p.startsWith("/groups/"),
  },
];

export default function Nav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
    <nav className="ml-auto flex items-center gap-4 text-sm">
      {items.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition-colors",
              active
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

