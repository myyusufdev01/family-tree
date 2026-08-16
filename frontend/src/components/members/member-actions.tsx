"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MemberActionsProps {
  memberId: string;
  canManage: boolean;
  onDelete: () => void;
}

/**
 * Aksi cepat anggota (Pohon / Edit / Hapus).
 * Di layar md ke atas tampil sebagai tombol berjejer; di layar kecil (smartphone)
 * dirapikan menjadi satu dropdown "⋯" agar header kartu tidak lebar.
 */
export default function MemberActions({
  memberId,
  canManage,
  onDelete,
}: MemberActionsProps) {
  const router = useRouter();

  return (
    <>
      {/* Layar md ke atas: tombol berjejer */}
      <div className="hidden items-center gap-2 md:flex">
        <Link href={`/tree?member=${memberId}`}>
          <Button size="sm">
            <TreePine className="size-4" />
            Pohon
          </Button>
        </Link>
        {canManage && (
          <>
            <Link href={`/members/${memberId}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="size-4" />
              Hapus
            </Button>
          </>
        )}
      </div>

      {/* Layar kecil: dropdown aksi (⋯) */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Aksi anggota"
                title="Aksi"
              >
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-44 p-1.5">
            <DropdownMenuItem
              onClick={() => router.push(`/tree?member=${memberId}`)}
              className="gap-2 py-2"
            >
              <TreePine className="size-4" />
              Pohon
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push(`/members/${memberId}/edit`)}
                  className="gap-2 py-2"
                >
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={onDelete}
                  className="gap-2 py-2"
                >
                  <Trash2 className="size-4" />
                  Hapus
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
