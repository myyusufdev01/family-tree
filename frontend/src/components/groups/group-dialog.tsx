"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createGroup, updateGroup } from "@/lib/api";
import type { Group } from "@/lib/types";

/**
 * Dialog tambah/edit grup. `group === null` berarti mode tambah; selain itu
 * mode edit dengan data grup yang dipilih. Dipanggil `onSaved` setelah
 * berhasil disimpan agar tabel bisa dimuat ulang.
 */
export default function GroupDialog({
  open,
  onOpenChange,
  group,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  onSaved: () => void;
}) {
  const isEdit = group !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "✏️ Edit Grup" : "➕ Tambah Grup"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi grup di bawah ini."
              : "Buat grup baru untuk mengelompokkan anggota keluarga."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <GroupForm
            key={group?.id ?? "new"}
            group={group}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onOpenChange(false);
              onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Form tambah/edit grup. Di-mount hanya saat dialog terbuka (dengan `key`
 * mengikuti id grup) sehingga state form selalu ter-reset sesuai data yang
 * diedit — tanpa perlu sinkronisasi via `useEffect`.
 */
function GroupForm({
  group,
  onCancel,
  onSaved,
}: {
  group: Group | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(group?.code ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    try {
      const data = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
      };
      if (group) {
        await updateGroup(group.id, data);
      } else {
        await createGroup(data);
      }
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="group-code">Kode *</Label>
        <Input
          id="group-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="mis. EXT"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="group-name">Nama *</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Keluarga Besar"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="group-desc">Deskripsi</Label>
        <Textarea
          id="group-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsi grup (opsional)..."
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          ❌ Batal
        </Button>
        <Button type="submit" disabled={saving || !code.trim() || !name.trim()}>
          {saving ? "Menyimpan..." : "💾 Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

