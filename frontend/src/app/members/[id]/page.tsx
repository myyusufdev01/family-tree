"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { getTree } from "@/lib/api";
import { toDisplayDate } from "@/lib/date-format";
import type { Member, FamilyTree } from "@/lib/types";

function MemberCard({ member, label }: { member: Member; label?: string }) {
  return (
    <div className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors">
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      <p className="font-medium">
        {member.gender === "male" ? "👨" : "👩"} {member.name}
      </p>
      {member.birth_date && (
        <p className="text-sm text-muted-foreground">Lahir: {toDisplayDate(member.birth_date)}</p>
      )}
      {member.death_date && (
        <p className="text-sm text-muted-foreground">Wafat: {toDisplayDate(member.death_date)}</p>
      )}
    </div>
  );
}

function FamilySection({
  title, members, emptyText,
}: {
  title: string; members: Member[]; emptyText?: string;
}) {
  if (members.length === 0 && !emptyText) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">{emptyText}</p>
        ) : (
          members.map((m) => (
            <Link key={m.id} href={`/members/${m.id}`}>
              <MemberCard member={m} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [loading, setLoading] = useState(true);
  const memberId = params.id as string;

  useEffect(() => {
    loadData();
  }, [memberId]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getTree(memberId);
      setTree(data);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Anggota tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
          Kembali
        </Button>
      </div>
    );
  }

  const { member, family } = tree;
  const all = Object.values(family);

  const grandparents = all.filter(
    (m) => member.parent_ids.some((pid) => family[pid]?.parent_ids.includes(m.id))
  );
  const parents = member.parent_ids.map((id) => family[id]).filter(Boolean);
  const siblings = all.filter(
    (m) => m.id !== member.id && member.parent_ids.some((pid) => m.parent_ids.includes(pid))
  );
  const spouses = member.spouse_ids.map((id) => family[id]).filter(Boolean);
  const children = member.child_ids.map((id) => family[id]).filter(Boolean);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {member.gender === "male" ? "👨" : "👩"} {member.name}
            </CardTitle>
            <div className="flex gap-2">
              <Link href={`/members/${member.id}/edit`}>
                <Button variant="outline" size="sm">✏️ Edit</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Jenis Kelamin</TableCell>
                <TableCell>
                  <Badge variant={member.gender === "male" ? "default" : "secondary"}>
                    {member.gender === "male" ? "Laki-laki" : "Perempuan"}
                  </Badge>
                </TableCell>
              </TableRow>
              {member.birth_date && (
                <TableRow>
                  <TableCell className="font-medium">Tanggal Lahir</TableCell>
                  <TableCell>{toDisplayDate(member.birth_date)}</TableCell>
                </TableRow>
              )}
              {member.death_date && (
                <TableRow>
                  <TableCell className="font-medium">Tanggal Wafat</TableCell>
                  <TableCell>{toDisplayDate(member.death_date)}</TableCell>
                </TableRow>
              )}
              {member.phone && (
                <TableRow>
                  <TableCell className="font-medium">Telepon</TableCell>
                  <TableCell>{member.phone}</TableCell>
                </TableRow>
              )}
              {member.notes && (
                <TableRow>
                  <TableCell className="font-medium">Catatan</TableCell>
                  <TableCell>{member.notes}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🌳 Silsilah Keluarga</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FamilySection title="👴👵 Kakek/Nenek" members={grandparents} />
          <FamilySection title="👨‍👩‍👧 Orang Tua" members={parents} />
          <FamilySection title="👫 Saudara" members={siblings} emptyText="Tidak ada saudara" />
          <FamilySection title="💑 Pasangan" members={spouses} emptyText="Tidak ada pasangan" />
          <FamilySection title="👶 Anak" members={children} emptyText="Tidak memiliki anak" />
        </CardContent>
      </Card>
    </div>
  );
}

