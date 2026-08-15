"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { getMember, updateMember, searchMembers, linkMembers, unlinkMembers } from "@/lib/api";
import type { Member } from "@/lib/types";
import { GENDER_LABELS, REL_ROLE_LABELS } from "@/lib/labels";

export default function EditMemberPage() {
  const params = useParams();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    gender: "male" as "male" | "female",
    birth_date: "",
    death_date: "",
    phone: "",
    notes: "",
  });
  const [relTab, setRelTab] = useState<"add" | "remove" | null>(null);
  const [relSearch, setRelSearch] = useState("");
  const [relResults, setRelResults] = useState<Member[]>([]);
  const [relType, setRelType] = useState<"parent_child" | "spouse">("parent_child");
  const [relRole, setRelRole] = useState<"parent" | "child" | "spouse" | "sibling">("parent");
  const memberId = params.id as string;

  useEffect(() => {
    loadMember();
  }, [memberId]);

  async function loadMember() {
    setLoading(true);
    try {
      const m = await getMember(memberId);
      setMember(m);
      setForm({
        name: m.name || "",
        gender: m.gender || "male",
        birth_date: m.birth_date || "",
        death_date: m.death_date || "",
        phone: m.phone || "",
        notes: m.notes || "",
      });
    } catch {
      alert("Gagal memuat data anggota");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }
async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateMember(memberId, {
        name: form.name.trim(),
        gender: form.gender,
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
        phone: form.phone || null,
        notes: form.notes || null,
      });
      setMember(updated);
      alert("✅ Data berhasil disimpan!");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleRelSearch() {
    if (!relSearch.trim()) return;
    try {
      const data = await searchMembers(relSearch);
      setRelResults(data.results.filter((m) => m.id !== memberId));
    } catch {
      setRelResults([]);
    }
  }

  async function handleAddRelation(targetId: string) {
    try {
      const target = relResults.find((m) => m.id === targetId);
      const targetName = target?.name || "?";
      if (relRole === "parent") {
        // "Orang tua dari X" → [member] jadi orang tua dari X (member=ortu, X=anak)
        await linkMembers("parent_child", memberId, targetId);
        alert(`✅ ${member?.name} jadi orang tua dari ${targetName}`);
      } else if (relRole === "child") {
        // "Anak dari X" → [member] jadi anak dari X (X=ortu, member=anak)
        await linkMembers("parent_child", targetId, memberId);
        alert(`✅ ${targetName} jadi orang tua dari ${member?.name}`);
      } else if (relRole === "sibling") {
        await linkMembers("sibling", memberId, targetId);
        alert(`✅ ${member?.name} & ${targetName} jadi saudara kandung`);
      } else {
        await linkMembers("spouse", memberId, targetId);
        alert(`✅ ${member?.name} & ${targetName} jadi pasangan`);
      }
      setRelTab(null);
      setRelSearch("");
      setRelResults([]);
      loadMember();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menambah relasi");
    }
  }

  async function handleRemoveRelation(type: "parent_child" | "spouse" | "sibling", targetId: string) {
    try {
      if (type === "parent_child") {
        // Backend mengharapkan member_a = orang tua, member_b = anak.
        // Jika target adalah orang tua, balik urutannya supaya terhapus.
        const targetIsParent = !!member && member.parent_ids.includes(targetId);
        if (targetIsParent) {
          await unlinkMembers("parent_child", targetId, memberId);
        } else {
          await unlinkMembers("parent_child", memberId, targetId);
        }
      } else if (type === "sibling") {
        await unlinkMembers("sibling", memberId, targetId);
      } else {
        await unlinkMembers("spouse", memberId, targetId);
      }
      loadMember();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus relasi");
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat...</div>;
  }

  if (!member) return null;
return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>✏️ Edit: {member.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as "male" | "female" })}>
                <SelectTrigger><SelectValue>
                  {(v) => GENDER_LABELS[(v ?? "male") as "male" | "female"]}
                </SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">👨 Laki-laki</SelectItem>
                  <SelectItem value="female">👩 Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth">Tanggal Lahir</Label>
                <DateInput id="birth" value={form.birth_date} onChange={(iso) => setForm({ ...form, birth_date: iso })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="death">Tanggal Wafat</Label>
                <DateInput id="death" value={form.death_date} onChange={(iso) => setForm({ ...form, death_date: iso })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telepon</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "💾 Simpan"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push(`/members/${memberId}`)}>Kembali</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* Current Relations */}
      <Card>
        <CardHeader>
          <CardTitle>🔗 Relasi Saat Ini</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {member.parent_ids.length > 0 && (
            <RelationList title="Orang Tua" ids={member.parent_ids} onRemove={(id) => handleRemoveRelation("parent_child", id)} />
          )}
          {member.sibling_ids.length > 0 && (
            <RelationList title="Saudara Kandung" ids={member.sibling_ids} onRemove={(id) => handleRemoveRelation("sibling", id)} />
          )}
          {member.spouse_ids.length > 0 && (
            <RelationList title="Pasangan" ids={member.spouse_ids} onRemove={(id) => handleRemoveRelation("spouse", id)} />
          )}
          {member.child_ids.length > 0 && (
            <RelationList title="Anak" ids={member.child_ids} onRemove={(id) => handleRemoveRelation("parent_child", id)} />
          )}
          {member.parent_ids.length === 0 && member.sibling_ids.length === 0 && member.spouse_ids.length === 0 && member.child_ids.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada relasi.</p>
          )}
        </CardContent>
      </Card>

      {/* Add Relation */}
      <Card>
        <CardHeader>
          <CardTitle>➕ Tambah Relasi Baru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={relRole} onValueChange={(v) => setRelRole(v as "parent" | "child" | "spouse")}>
              <SelectTrigger className="w-44"><SelectValue>
                {(v) => REL_ROLE_LABELS[(v ?? "parent") as "parent" | "child" | "spouse"]}
              </SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Orang tua dari...</SelectItem>
                <SelectItem value="child">Anak dari...</SelectItem>
                <SelectItem value="spouse">Pasangan dari...</SelectItem>
                <SelectItem value="sibling">Saudara kandung dari...</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Cari..." value={relSearch} onChange={(e) => setRelSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRelSearch()} />
            <Button variant="secondary" onClick={handleRelSearch}>🔍 Cari</Button>
          </div>
          {relResults.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Hasil pencarian:</p>
              {relResults.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1">
                  <span>{m.gender === "male" ? "👨" : "👩"} {m.name}</span>
                  <Button size="sm" onClick={() => handleAddRelation(m.id)}>Tambah</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RelationList({ title, ids, onRemove }: { title: string; ids: string[]; onRemove: (id: string) => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(ids.map((id) => getMember(id).catch(() => null))).then((results) => {
      setMembers(results.filter(Boolean) as Member[]);
      setLoading(false);
    });
  }, [ids]);

  if (loading) return null;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}:</h4>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1 text-sm">
            <span>{m.gender === "male" ? "👨" : "👩"} {m.name}</span>
            <button
              type="button"
              onClick={() => onRemove(m.id)}
              title={`Hapus relasi dengan ${m.name}`}
              aria-label={`Hapus relasi dengan ${m.name}`}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm leading-none text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive/80"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}