import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listGroups } from "@/lib/firestore";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

function parseUserId(req: NextRequest): number {
  return Number(req.nextUrl.searchParams.get("user_id") ?? "0");
}

/**
 * GET /api/groups — daftar seluruh grup (read-only) untuk semua user yang
 * terautentikasi. Dipakai tabel daftar anggota untuk menampilkan nama group
 * tanpa perlu akses admin (endpoint `/api/admin/groups` khusus admin).
 */
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const groups = await listGroups(parseUserId(req));
    return NextResponse.json({ groups });
  } catch (err) {
    return errorResponse(err);
  }
}
