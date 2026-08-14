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
import { listMembers, searchMembers, getAdminStats } from "@/lib/api";
import { toDisplayDate } from "@/lib/date-format";
import type { Member } from "@/lib/types";

export default function Dashboard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<{
    total_members: number;
    total_users: number;
    total_trees?: number;
  } | null>(null);

  useEffect(() => {
    loadMembers();
    loadStats();
  }, []);

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await listMembers();
      setMembers(data.members);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch {
      /* admin stats optional */
    }
  }

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
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Anggota</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_members}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Pohon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_trees ?? "-"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Pengguna</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_users}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daftar Anggota Keluarga</CardTitle>
            <Link href="/members/add">
              <Button>➕ Tambah Anggota</Button>
            </Link>
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
        </CardContent>
      </Card>
    </div>
  );
}