"use client";

import { useEffect, useState } from "react";
import GroupsTable from "@/components/groups/groups-table";
import { Skeleton } from "@/components/ui/skeleton";
import { getMe } from "@/lib/api";

/**
 * Halaman Group (CRUD) — khusus admin.
 *
 * Guard di sisi klien lewat `/api/me` (`is_admin`); API di bawahnya juga
 * menolak non-admin dengan 403, jadi akses aman dua lapis.
 */
export default function GroupsPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Group</h1>
          <p className="text-sm text-muted-foreground">
            Kelola grup pengelompokan anggota keluarga — khusus admin.
          </p>
        </div>
      </div>

      {isAdmin === null ? (
        <Skeleton className="h-48 w-full" />
      ) : isAdmin ? (
        <GroupsTable />
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="mt-3 text-lg font-semibold">Akses ditolak</h2>
          <p className="text-sm text-muted-foreground">
            Halaman ini hanya bisa diakses oleh admin. Hubungi admin bila Anda
            merasa seharusnya memiliki akses.
          </p>
        </div>
      )}
    </div>
  );
}
