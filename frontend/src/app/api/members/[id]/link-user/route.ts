import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import { getMember, linkUserToMember } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/members/{id}/link-user — tautkan akun Auth0 ke seorang anggota
 * silsilah. Khusus admin: admin bebas menautkan siapa saja — termasuk dirinya
 * sendiri untuk setup awal — dan boleh mengganti tautan yang sudah ada.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser(req.headers.get("authorization"));
    const userId = Number(req.nextUrl.searchParams.get("user_id") ?? "0");
    const { id } = await params;

    if (!isAdmin(user.sub)) {
      throw new HttpError(403, "Hanya admin yang dapat menautkan akun ke anggota.");
    }

    const body = (await req.json().catch(() => ({}))) as { sub?: string };
    const sub = (body.sub ?? "").trim();
    if (!sub) {
      throw new HttpError(400, "sub (Auth0 User ID) wajib diisi");
    }

    const target = await getMember(userId, id);
    if (!target) throw new HttpError(404, "Member not found");

    await linkUserToMember(userId, id, sub);
    const updated = await getMember(userId, id);
    return NextResponse.json(updated ?? target);
  } catch (err) {
    return errorResponse(err);
  }
}
