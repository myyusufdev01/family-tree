"use client";

import { useEffect, useState } from "react";
import { getMe, setMemberPic } from "@/lib/api";
import type { Me, Member } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Toggle status PIC (Person In Charge) — khusus admin.
 *
 * Tampil di kartu "Akses Login" pada halaman detail anggota. PIC bisa menambah
 * anggota baru (otomatis masuk ke group-nya) dan membuat koneksi antar user di
 * group yang sama.
 */
export default function MemberPicToggle({
  member,
  onSaved,
}: {
  member: Member;
  onSaved?: () => void;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPic, setIsPic] = useState(Boolean(member.is_pic));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meData = await getMe();
        if (!cancelled) setMe(meData);
      } catch {
        // getMe gagal → tetap render sebagai non-admin.
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
        🔐 Hanya <b>admin</b> yang dapat mengatur status PIC.
      </p>
    );
  }

  async function handleToggle() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const next = !isPic;
      await setMemberPic(member.id, next);
      setIsPic(next);
      setSuccess(true);
      onSaved?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan status PIC",
      );
    } finally {
      setSaving(false);
    }
  }

  // Syarat menjadi PIC: akun sudah tertaut ke User ID (auth0_sub). Membatalkan
  // PIC tetap diizinkan meski tanpa tautan (mis. perbaikan data lama).
  const canEnablePic = Boolean(member.auth0_sub);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={isPic ? "default" : "outline"}
          onClick={handleToggle}
          disabled={saving || (!isPic && !canEnablePic)}
          title={
            !isPic && !canEnablePic
              ? "Anggota ini belum memiliki tautan User ID (Auth0)"
              : undefined
          }
        >
          {saving ? "Menyimpan..." : isPic ? "⭐ Batalkan PIC" : "⭐ Jadikan PIC"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {isPic ? "User ini berstatus PIC." : "User ini bukan PIC."}
        </span>
      </div>
      {!canEnablePic && !isPic && (
        <p className="text-xs text-amber-600">
          ⚠️ Anggota ini belum memiliki tautan User ID (Auth0). Tautkan akun di
          bagian atas terlebih dahulu sebelum dijadikan PIC.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        PIC dapat menambah anggota baru (otomatis masuk ke group-nya) dan
        membuat koneksi antar user di group yang sama.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-600">✅ Status PIC tersimpan.</p>
      )}
    </div>
  );
}
