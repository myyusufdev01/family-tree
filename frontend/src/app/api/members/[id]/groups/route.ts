import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import { getMember, listGroups, setMemberGroups } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * PUT /api/members/{id}/groups — atur group tempat akun user (anggota) ini
 * terdaftar. Khusus admin.
 *
 * Body: `{ "group_ids": ["g1", "g2"] }`.
 * - `group_ids` wajib berupa array string.
 * - Id duplikat dibuang; id yang tidak dikenal (mis. grup sudah dihapus)
 *   diabaikan secara diam-diam agar penyimpanan tidak terblokir.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser(req.headers.get("authorization"));
    const userId = Number(req.nextUrl.searchParams.get("user_id") ?? "0");
    const { id } = await params;

    if (!isAdmin(user.sub)) {
      throw new HttpError(403, "Hanya admin yang dapat mengatur group anggota.");
    }

    const target = await getMember(userId, id);
    if (!target) throw new HttpError(404, "Member not found");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const raw = body.group_ids;
    if (!Array.isArray(raw)) {
      throw new HttpError(422, "group_ids wajib berupa array");
    }
    if (raw.some((v) => typeof v !== "string" || !v.trim())) {
      throw new HttpError(422, "group_ids wajib berisi id group (string)");
    }

    // Hanya simpan group yang masih ada — data lama yang merujuk grup terhapus
    // akan otomatis dibersihkan pada penyimpanan berikutnya.
    const allGroups = await listGroups(userId);
    const validIds = new Set(allGroups.map((g) => g.id));
    const groupIds = [...new Set(raw.map((v) => v.trim()))].filter((gid) =>
      validIds.has(gid),
    );

    await setMemberGroups(userId, id, groupIds);
    const updated = await getMember(userId, id);
    return NextResponse.json(updated ?? target);
  } catch (err) {
    return errorResponse(err);
  }
}
