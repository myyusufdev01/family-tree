"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { listMembers, searchMembers } from "@/lib/api";
import { toDisplayDate } from "@/lib/date-format";
import type { Member } from "@/lib/types";
import DashboardStats from "@/components/dashboard/dashboard-stats";

export default function Dashboard() {
  const PER_PAGE = 20;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listMembers(page, PER_PAGE);
        if (!cancelled) {
          setMembers(data.members);
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
  }, [page]);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const data = await searchMembers(searchQuery);
      setSearchResults(data.results);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "Gagal mencari");
    } finally {
      setSearching(false);
    }
  }

  const displayMembers = searchResults ?? members;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard Keluarga</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan data silsilah keluarga Anda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tree">
            <Button variant="outline">🌳 Lihat Pohon</Button>
          </Link>
          <Link href="/members/add">
            <Button>➕ Tambah Anggota</Button>
          </Link>
        </div>
      </div>

      <DashboardStats />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daftar Anggota Keluarga</CardTitle>
            {!searchResults && (
              <span className="text-sm text-muted-foreground">
                {total} anggota
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Cari anggota..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) setSearchResults(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button variant="secondary" onClick={handleSearch} disabled={searching}>
              {searching ? "..." : "🔍 Cari"}
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : displayMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchResults ? `Tidak ditemukan "${searchQuery}"` : "Belum ada anggota. Klik 'Tambah Anggota' untuk memulai."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenis Kelamin</TableHead>
                  <TableHead>Lahir</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <Link href={`/members/${m.id}`} className="hover:underline">
                        {m.gender === "male" ? "👨" : "👩"} {m.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.gender === "male" ? "default" : "secondary"}>
                        {m.gender === "male" ? "Laki-laki" : "Perempuan"}
                      </Badge>
                    </TableCell>
                    <TableCell>{toDisplayDate(m.birth_date) || "-"}</TableCell>
                    <TableCell>{m.phone || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/members/${m.id}/edit`}>
                        <Button variant="outline" size="sm">✏️ Edit</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!searchResults && totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Menampilkan {(page - 1) * PER_PAGE + 1}–
                {Math.min(page * PER_PAGE, total)} dari {total} anggota
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
      </Card>
    </div>
  );
}