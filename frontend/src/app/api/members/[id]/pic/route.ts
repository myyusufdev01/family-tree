import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import { getMember, setMemberPic } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * PUT /api/members/{id}/pic — jadikan/batalkan user sebagai PIC (Person In
 * Charge). Khusus admin.
 *
 * Body: `{ "is_pic": true }`.
 * - PIC bisa menambah anggota baru (otomatis masuk ke group-nya) dan membuat
 *   koneksi antar user di group yang sama.
 * - Syarat menjadi PIC: anggota harus sudah memiliki tautan User ID (Auth0
 *   `auth0_sub`). Membatalkan PIC tetap boleh walau tanpa tautan.
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
      throw new HttpError(403, "Hanya admin yang dapat mengatur status PIC.");
    }

    const target = await getMember(userId, id);
    if (!target) throw new HttpError(404, "Member not found");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.is_pic !== "boolean") {
      throw new HttpError(422, "is_pic wajib berupa boolean");
    }

    if (body.is_pic && !target.auth0_sub) {
      throw new HttpError(
        422,
        "Anggota belum memiliki tautan User ID (Auth0). Tautkan akun terlebih dahulu sebelum dijadikan PIC.",
      );
    }

    await setMemberPic(userId, id, body.is_pic);
    const updated = await getMember(userId, id);
    return NextResponse.json(updated ?? target);
  } catch (err) {
    return errorResponse(err);
  }
}
