import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import MemberTable from "@/components/members/member-table";

export const metadata: Metadata = {
  title: "Daftar Anggota | Family Tree",
};

export default function MembersListPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daftar Anggota</h1>
          <p className="text-sm text-muted-foreground">
            Seluruh anggota keluarga dalam satu daftar, lengkap dengan pencarian dan pagination.
          </p>
        </div>
        <Link href="/members/add">
          <Button>➕ Tambah Anggota</Button>
        </Link>
      </div>

      <MemberTable />
    </div>
  );
}
