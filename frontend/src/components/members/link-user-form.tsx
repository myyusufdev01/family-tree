"use client";

import { useEffect, useState } from "react";
import { getMe, linkUserToMember } from "@/lib/api";
import type { Me, Member } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Form untuk menautkan akun Auth0 (sub) ke seorang anggota silsilah.
 *
 * Hanya tampil sesuai aturan backend:
 * - Admin boleh menautkan siapa saja.
 * - User lain hanya boleh menautkan anggota yang merupakan anak/cucu/keturunannya.
 */
export default function LinkUserForm({
  member,
  onLinked,
}: {
  member: Member;
  onLinked?: () => void;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [sub, setSub] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMe();
        if (!cancelled) setMe(data);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(err instanceof Error ? err.message : "Gagal memuat identitas");
        }
      } finally {
        if (!cancelled) setLoadingMe(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadingMe) return null;

  const isAdmin = me?.is_admin ?? false;
  const isMine = me?.member ? me.descendant_ids.includes(member.id) : false;
  const canLink = Boolean(me?.member && (isAdmin || isMine));
  const linked = Boolean(member.auth0_sub);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sub.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await linkUserToMember(member.id, sub.trim());
      setSuccess(true);
      setSub("");
      onLinked?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menautkan akun");
    } finally {
      setSaving(false);
    }
  }

  // Akun user yang login belum tertaut ke anggota silsilah mana pun.
  if (!me?.member) {
    return (
      <p className="text-sm text-muted-foreground">
        🔐 Akun Anda belum tertaut ke anggota silsilah. Minta admin atau keluarga
        untuk menautkan akun Anda terlebih dahulu.
      </p>
    );
  }

  // Anggota ini sudah punya akun login (non-admin tidak boleh mengganti).
  if (linked && !isAdmin) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">✅ Sudah punya akun login</Badge>
        <span className="text-muted-foreground">
          Anggota ini sudah tertaut ke akun Auth0.
        </span>
      </div>
    );
  }

  // Bukan keturunan dari anggota yang mewakili user login ini.
  if (!canLink) {
    return (
      <p className="text-sm text-muted-foreground">
        🔒 Hanya anggota yang merupakan anak/cucu/keturunan Anda yang bisa
        dijadikan user.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {linked && isAdmin && (
        <p className="text-xs text-amber-600">
          ⚠️ Anggota ini sudah tertaut ke akun lain. Menyimpan akan mengganti
          tautan lama.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          placeholder="Auth0 User ID (sub), contoh: google-oauth2|123456"
          className="sm:flex-1"
        />
        <Button type="submit" disabled={saving || !sub.trim()}>
          {saving ? "Menyimpan..." : "🔗 Tautkan"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Cara melihat User ID: Auth0 Dashboard → User Management → Users → klik
        user → salin field <b>User ID</b>.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-600">
          ✅ Berhasil menautkan akun ke anggota ini.
        </p>
      )}
    </form>
  );
}
