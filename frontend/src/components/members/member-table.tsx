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
import { listMembers, listPublicGroups, searchMembers } from "@/lib/api";
import { toDisplayMonthYear } from "@/lib/date-format";
import type { Group, Member } from "@/lib/types";

const PER_PAGE = 20;

/** Tag status di samping nama: 🔑 login, 🛡️ admin, ⭐ PIC. */
function MemberStatusBadges({ member }: { member: Member }) {
  return (
    <>
      {member.auth0_sub && (
        <Badge
          variant="outline"
          className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-400"
          title="Anggota ini sudah punya akun login (tertaut User ID Auth0)"
        >
          🔑 Login
        </Badge>
      )}
      {member.is_admin && (
        <Badge
          variant="outline"
          className="border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-400"
          title="Anggota ini berstatus admin"
        >
          🛡️ Admin
        </Badge>
      )}
      {member.is_pic && (
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-400"
          title="Anggota ini berstatus PIC (Person In Charge)"
        >
          ⭐ PIC
        </Badge>
      )}
    </>
  );
}

export default function MemberTable() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listPublicGroups();
        if (!cancelled) setGroups(data.groups);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(err instanceof Error ? err.message : "Gagal memuat group");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const groupById = new Map(groups.map((g) => [g.id, g]));

  function memberGroups(m: Member): Group[] {
    return (m.group_ids ?? []).map((id) => groupById.get(id)).filter((g): g is Group => !!g);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Daftar Anggota Keluarga</CardTitle>
          {!searchResults && (
            <span className="text-sm text-muted-foreground">{total} anggota</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2">
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

        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>🔑 = Punya akses login</span>
          <span>🛡️ = Admin</span>
          <span>⭐ = PIC</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : displayMembers.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            {searchResults
              ? `Tidak ditemukan "${searchQuery}"`
              : "Belum ada anggota. Klik 'Tambah Anggota' untuk memulai."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Bulan/Tahun Lahir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayMembers.map((m) => {
                const groupsOfMember = memberGroups(m);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/members/${m.id}`} className="hover:underline">
                          {m.gender === "male" ? "👨" : "👩"} {m.name}
                        </Link>
                        <MemberStatusBadges member={m} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {groupsOfMember.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {groupsOfMember.map((g) => (
                            <Badge key={g.id} variant="secondary">
                              {g.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{toDisplayMonthYear(m.birth_date) || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!searchResults && members.length > 0 && (
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
  );
}
