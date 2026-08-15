import Link from "next/link";
import { Button } from "@/components/ui/button";
import DashboardStats from "@/components/dashboard/dashboard-stats";
import AddMemberButton from "@/components/members/add-member-button";

export default function Dashboard() {
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
          <Link href="/members">
            <Button variant="outline">📋 Daftar Anggota</Button>
          </Link>
          <Link href="/tree">
            <Button variant="outline">🌳 Lihat Pohon</Button>
          </Link>
          <AddMemberButton />
        </div>
      </div>

      <DashboardStats />
    </div>
  );
}