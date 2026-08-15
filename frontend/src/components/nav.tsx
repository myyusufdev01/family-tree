"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string; isActive: (p: string) => boolean }[] = [
  { href: "/", label: "Dashboard", isActive: (p) => p === "/" },
  {
    href: "/members",
    label: "List",
    isActive: (p) =>
      p === "/members" || (p.startsWith("/members/") && !p.startsWith("/members/add")),
  },
  { href: "/tree", label: "Pohon", isActive: (p) => p.startsWith("/tree") },
  { href: "/members/add", label: "Tambah", isActive: (p) => p === "/members/add" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="ml-auto flex items-center gap-4 text-sm">
      {NAV_ITEMS.map((item) => {
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
