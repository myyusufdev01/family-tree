import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchMembers } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/members/search?q= — cari anggota berdasarkan nama. */
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = Number(req.nextUrl.searchParams.get("user_id") ?? "0");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (!q.trim()) throw new HttpError(422, "q wajib diisi");

    const results = await searchMembers(userId, q);
    return NextResponse.json({ results });
  } catch (err) {
    return errorResponse(err);
  }
}
