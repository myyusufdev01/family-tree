"use client";

import { useEffect, useState } from "react";
import { getMe, linkUserToMember } from "@/lib/api";
import type { Me, Member } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Form untuk menautkan akun Auth0 (sub) ke seorang anggota silsilah.
 *
 * Fitur ini **khusus admin** (``ADMIN_SUBS``). Non-admin hanya melihat
 * keterangan bahwa fitur ini terbatas untuk admin.
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

  // Non-admin tidak punya akses ke fitur ini.
  if (!me?.is_admin) {
    return (
      <p className="text-sm text-muted-foreground">
        🔐 Hanya <b>admin</b> yang dapat menautkan akun user ke anggota silsilah.
      </p>
    );
  }

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

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {member.auth0_sub ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 dark:border-emerald-800/60 dark:bg-emerald-950/20">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              🔗 Tertaut ke User ID:
            </span>
            <code className="break-all rounded bg-background px-1.5 py-0.5 font-mono text-xs text-emerald-900 dark:text-emerald-300">
              {member.auth0_sub}
            </code>
          </div>
          <p className="text-xs text-amber-600">
            ⚠️ Menyimpan akan mengganti tautan lama.
          </p>
        </div>
      ) : null}
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
