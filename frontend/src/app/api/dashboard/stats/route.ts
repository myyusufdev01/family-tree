import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getDashboardStats } from "@/lib/stats";

export const runtime = "nodejs";

/** GET /api/dashboard/stats — statistik ringkas untuk dashboard. */
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = Number(req.nextUrl.searchParams.get("user_id") ?? "0");
    const stats = await getDashboardStats(userId);
    return NextResponse.json(stats);
  } catch (err) {
    return errorResponse(err);
  }
}
