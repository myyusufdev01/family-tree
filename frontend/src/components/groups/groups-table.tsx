"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listGroups, deleteGroup } from "@/lib/api";
import GroupDialog from "@/components/groups/group-dialog";
import type { Group } from "@/lib/types";

const PER_PAGE = 20;

/**
 * Tabel grup + tombol aksi (tambah/edit/hapus) — khusus admin. Halaman
 * `/groups` yang memastikan pemanggilnya admin; API juga menolak non-admin.
 */
export default function GroupsTable() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listGroups(page, PER_PAGE);
        if (!cancelled) {
          setGroups(data.groups);
          setTotalPages(data.total_pages ?? 1);
          setTotal(data.total ?? 0);
        }
      } catch (err: unknown) {
        console.error(err instanceof Error ? err.message : "Gagal memuat data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(group: Group) {
    setEditing(group);
    setDialogOpen(true);
  }

  function handleDialogSaved() {
    setReloadKey((k) => k + 1);
  }

  async function handleDelete(group: Group) {
    const ok = window.confirm(
      `Yakin ingin menghapus grup "${group.name}" (${group.code})?\n\nTindakan ini tidak bisa dibatalkan.`,
    );
    if (!ok) return;
    try {
      await deleteGroup(group.id);
      // Jika halaman terakhir jadi kosong, mundur satu halaman.
      if (groups.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setReloadKey((k) => k + 1);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus grup");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Daftar Grup</CardTitle>
          <div className="flex items-center gap-3">
            {!loading && (
              <span className="text-sm text-muted-foreground">{total} grup</span>
            )}
            <Button onClick={openCreate}>➕ Tambah Grup</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Belum ada grup. Klik &apos;Tambah Grup&apos; untuk membuat yang pertama.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {g.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                    {g.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(g)}>
                        ✏️ Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(g)}
                      >
                        🗑 Hapus
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {groups.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Menampilkan {(page - 1) * PER_PAGE + 1}–
              {Math.min(page * PER_PAGE, total)} dari {total} grup
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹ Sebelumnya
              </Button>
              <span className="text-sm text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya ›
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <GroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={editing}
        onSaved={handleDialogSaved}
      />
    </Card>
  );
}
