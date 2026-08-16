"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tombol "Tambah Anggota" — hanya tampil untuk user yang akun Auth0-nya sudah
 * tertaut ke anggota silsilah, atau admin (bypass setup awal). Sama dengan
 * aturan backend di POST /api/members.
 */
export default function AddMemberButton() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) setAllowed(Boolean(me.member || me.is_admin));
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) {
    return <Skeleton className="h-9 w-36" />;
  }

  if (!allowed) return null;

  return (
    <Link href="/members/add">
      <Button>➕ Tambah Anggota</Button>
    </Link>
  );
}
