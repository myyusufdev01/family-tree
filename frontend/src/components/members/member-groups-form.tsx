"use client";

import { useEffect, useState } from "react";
import { getMe, listGroups, setMemberGroups } from "@/lib/api";
import type { Group, Me, Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Form keanggotaan group untuk akun user (anggota) — khusus admin.
 *
 * Tampil di kartu "Akses Login" pada halaman detail anggota. Admin memilih satu
 * atau lebih group (toggle chips); non-admin hanya melihat keterangan bahwa
 * fitur ini khusus admin. Daftar group dimuat dari `/api/admin/groups`.
 */
export default function MemberGroupsForm({
  member,
  onSaved,
}: {
  member: Member;
  onSaved?: () => void;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(member.group_ids ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meData = await getMe();
        if (cancelled) return;
        setMe(meData);
        if (meData.is_admin) {
          const groupData = await listGroups(1, 100);
          if (cancelled) return;
          setGroups(groupData.groups);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(
            err instanceof Error ? err.message : "Gagal memuat group",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton className="h-10 w-full" />;

  // Non-admin tidak punya akses ke fitur ini.
  if (!me?.is_admin) {
    return (
      <p className="text-sm text-muted-foreground">
        🔐 Hanya <b>admin</b> yang dapat mengatur group user.
      </p>
    );
  }

  function toggle(groupId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await setMemberGroups(member.id, [...selected]);
      setSuccess(true);
      onSaved?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan group");
    } finally {
      setSaving(false);
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada group. Admin dapat membuat group di halaman <b>Group</b>.
      </p>
    );
  }

  const selectedCount = groups.filter((g) => selected.has(g.id)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => {
          const active = selected.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {g.code} · {g.name}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Menyimpan..." : "💾 Simpan Group"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {selectedCount} group dipilih
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-600">
          ✅ Keanggotaan group tersimpan.
        </p>
      )}
    </div>
  );
}
