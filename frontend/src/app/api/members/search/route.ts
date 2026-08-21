import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSubs } from "@/lib/config";
import { searchMembers } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";
import { withAdminFlag } from "@/lib/member";

export const runtime = "nodejs";

/** GET /api/members/search?q= — cari anggota berdasarkan nama. */
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = Number(req.nextUrl.searchParams.get("user_id") ?? "0");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (!q.trim()) throw new HttpError(422, "q wajib diisi");

    const results = await searchMembers(userId, q);
    // Tandai anggota yang termasuk admin (ADMIN_SUBS) untuk tag di UI.
    return NextResponse.json({ results: withAdminFlag(results, getAdminSubs()) });
  } catch (err) {
    return errorResponse(err);
  }
}
