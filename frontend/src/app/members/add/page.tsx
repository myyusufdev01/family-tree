"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createMember,
  getMe,
  linkMembers,
  listGroups,
  searchMembers,
  setMemberGroups,
} from "@/lib/api";
import { GENDER_LABELS, REL_ROLE_LABELS } from "@/lib/labels";
import type { Group, Me, Member, NewMemberRelation } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Relasi otomatis untuk user biasa (non-admin, non-PIC): anggota baru dibuat
 * sebagai anak atau pasangan dari anggota yang mewakili akun user di silsilah.
 */
const RELATION_LABELS: Record<NewMemberRelation, string> = {
  child: "👶 Anak dari Anda",
  spouse: "💑 Pasangan dari Anda",
};

/** Peran relasi untuk admin & PIC (sama seperti halaman edit anggota). */
type AddRelRole = "parent" | "child" | "spouse" | "sibling";
const ADD_REL_ROLES: AddRelRole[] = ["parent", "child", "spouse", "sibling"];

export default function AddMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    gender: "male" as "male" | "female",
    relation: "child" as NewMemberRelation,
    birth_date: "",
    death_date: "",
    phone: "",
    notes: "",
  });

  // State "Tambah Relasi Baru" — khusus admin/PIC (opsional).
  const [relRole, setRelRole] = useState<AddRelRole>("parent");
  const [relSearch, setRelSearch] = useState("");
  const [relResults, setRelResults] = useState<Member[]>([]);
  const [relTarget, setRelTarget] = useState<Member | null>(null);

  // State "Group User" — khusus admin (opsional).
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMe();
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = me?.is_admin ?? false;
  const isPic = me?.member?.is_pic ?? false;
  const canPickAnyRelation = isAdmin || isPic;
  // Hanya user yang akun Auth0-nya sudah tertaut ke anggota silsilah (atau
  // admin) yang boleh membuka halaman tambah anggota — sama dengan aturan
  // backend di POST /api/members dan tombol "Tambah Anggota".
  const canAdd = isAdmin || Boolean(me?.member);

  // Muat daftar group untuk admin (dipakai di bagian "Group User").
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setGroupsLoading(true);
      try {
        const data = await listGroups(1, 100);
        if (!cancelled) setGroups(data.groups);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(
            err instanceof Error ? err.message : "Gagal memuat group",
          );
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function handleRelSearch() {
    if (!relSearch.trim()) return;
    try {
      const data = await searchMembers(relSearch);
      setRelResults(data.results);
    } catch {
      setRelResults([]);
    }
  }

  function toggleGroup(groupId: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const member = await createMember({
        name: form.name.trim(),
        gender: form.gender,
        // Relasi otomatis (anak/pasangan dari akun sendiri) hanya untuk user
        // biasa. Admin/PIC menambah tanpa relasi otomatis.
        ...(!canPickAnyRelation ? { relation: form.relation } : {}),
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
        phone: form.phone || null,
        notes: form.notes || null,
      });

      // Admin: assign group yang dipilih ke anggota baru.
      if (isAdmin && selectedGroups.size > 0) {
        try {
          await setMemberGroups(member.id, [...selectedGroups]);
        } catch (err: unknown) {
          // Anggota tetap tersimpan; group bisa diatur lagi lewat halaman edit.
          alert(
            `Anggota berhasil disimpan, tapi gagal menyimpan group: ${
              err instanceof Error ? err.message : "Terjadi kesalahan"
            }`,
          );
        }
      }

      // Admin/PIC: hubungkan relasi yang dipilih setelah anggota dibuat.
      if (canPickAnyRelation && relTarget) {
        try {
          if (relRole === "parent") {
            // "Orang tua dari X" → anggota baru jadi orang tua dari X.
            await linkMembers("parent_child", member.id, relTarget.id);
          } else if (relRole === "child") {
            // "Anak dari X" → anggota baru jadi anak dari X.
            await linkMembers("parent_child", relTarget.id, member.id);
          } else if (relRole === "sibling") {
            await linkMembers("sibling", member.id, relTarget.id);
          } else {
            await linkMembers("spouse", member.id, relTarget.id);
          }
        } catch (err: unknown) {
          // Anggota tetap tersimpan; relasi bisa dihubungkan lagi lewat edit.
          alert(
            `Anggota berhasil disimpan, tapi relasi gagal dihubungkan: ${
              err instanceof Error ? err.message : "Terjadi kesalahan"
            }`,
          );
        }
      }

      router.push(`/members/${member.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  // Guard akses: user belum tertaut (bukan admin) tidak boleh melihat form —
  // dialihkan ke pesan penjelasan. Backend tetap memblokir 403 sebagai lapisan
  // keamanan terakhir.
  if (meLoading) {
    return (
      <div className="max-w-xl mx-auto">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!canAdd) {
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>🔒 Akses Dibatasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Hanya user yang akunnya sudah <b>tertaut ke anggota silsilah</b>{" "}
              yang dapat menambah anggota baru.
            </p>
            <p className="text-sm text-muted-foreground">
              Akun Anda belum ditautkan ke anggota silsilah. Hubungi admin untuk
              menautkan akun Anda terlebih dahulu.
            </p>
            <Button type="button" onClick={() => router.push("/")}>
              ← Kembali ke Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>➕ Tambah Anggota Keluarga</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? (
                <>
                  Anda (admin) menambah anggota <b>tanpa relasi otomatis</b>.
                  Hubungkan relasinya lewat bagian <b>Tambah Relasi Baru</b> di
                  bawah (opsional) atau halaman edit.
                </>
              ) : isPic ? (
                <>
                  Anggota baru akan otomatis <b>masuk ke group Anda</b> (status
                  PIC) dan dibuat <b>tanpa relasi otomatis</b> dengan Anda.
                  Hubungkan relasinya lewat bagian <b>Tambah Relasi Baru</b> di
                  bawah (opsional) atau halaman edit.
                </>
              ) : (
                <>
                  Anggota baru akan otomatis terhubung sebagai <b>anak</b> atau{" "}
                  <b>pasangan</b> dari akun Anda di silsilah.
                </>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm({ ...form, gender: v as "male" | "female" })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) => GENDER_LABELS[(v ?? "male") as "male" | "female"]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">👨 Laki-laki</SelectItem>
                  <SelectItem value="female">👩 Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {me !== null && !isAdmin && !isPic && (
              <div className="space-y-2">
                <Label>Hubungan dengan Anda</Label>
                <Select
                  value={form.relation}
                  onValueChange={(v) =>
                    setForm({ ...form, relation: v as NewMemberRelation })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(v) => RELATION_LABELS[(v ?? "child") as NewMemberRelation]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="child">👶 Anak dari Anda</SelectItem>
                    <SelectItem value="spouse">💑 Pasangan dari Anda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth">Tanggal Lahir</Label>
                <DateInput
                  id="birth"
                  value={form.birth_date}
                  onChange={(iso) => setForm({ ...form, birth_date: iso })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="death">Tanggal Wafat</Label>
                <DateInput
                  id="death"
                  value={form.death_date}
                  onChange={(iso) => setForm({ ...form, death_date: iso })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor Telepon</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0812-3456-7890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Catatan tambahan..."
              />
            </div>

          </CardContent>
        </Card>

        {/* Group User — khusus admin (opsional). */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>👥 Group User</CardTitle>
              <p className="text-sm text-muted-foreground">
                Opsional — pilih group tempat anggota baru terdaftar. Diterapkan
                saat menyimpan.
              </p>
            </CardHeader>
            <CardContent>
              {groupsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada group. Admin dapat membuat group di halaman{" "}
                  <b>Group</b>.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const active = selectedGroups.has(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
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
              )}
              {selectedGroups.size > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {selectedGroups.size} group dipilih.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tambah Relasi Baru — khusus admin/PIC (opsional). */}
        {canPickAnyRelation && (
          <Card>
            <CardHeader>
              <CardTitle>➕ Tambah Relasi Baru</CardTitle>
              <p className="text-sm text-muted-foreground">
                Opsional — hubungkan anggota baru dengan anggota yang sudah ada.
                Relasi dipasang setelah anggota tersimpan.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={relRole}
                  onValueChange={(v) => setRelRole(v as AddRelRole)}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue>
                      {(v) => REL_ROLE_LABELS[(v ?? "parent") as AddRelRole]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ADD_REL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {REL_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Cari anggota..."
                  value={relSearch}
                  onChange={(e) => setRelSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleRelSearch();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={handleRelSearch}
                >
                  🔍 Cari
                </Button>
              </div>

              {relResults.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Hasil pencarian:
                  </p>
                  {relResults.map((m) => {
                    const selected = relTarget?.id === m.id;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between py-1"
                      >
                        <span>
                          {m.gender === "male" ? "👨" : "👩"} {m.name}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "secondary"}
                          onClick={() => setRelTarget(selected ? null : m)}
                        >
                          {selected ? "✓ Terpilih" : "Pilih"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {relTarget && (
                <p className="text-sm text-muted-foreground">
                  Akan dihubungkan sebagai{" "}
                  <b>{REL_ROLE_LABELS[relRole].replace("...", "")}</b>{" "}
                  <b>{relTarget.name}</b>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={loading || !form.name.trim()}>
            {loading ? "Menyimpan..." : "💾 Simpan"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
          >
            ❌ Batal
          </Button>
        </div>
      </form>
    </div>
  );
}