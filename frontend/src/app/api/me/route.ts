import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import { getMemberBySub } from "@/lib/firestore";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/me — identitas user yang sedang login di dalam silsilah keluarga.
 *
 * Mengembalikan anggota yang tertaut ke akun Auth0 user (`member`) dan
 * apakah user adalah admin (`is_admin`). Dipakai frontend untuk menentukan
 * siapa yang boleh mengakses fitur menautkan user.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("authorization"));
    const userId = Number(req.nextUrl.searchParams.get("user_id") ?? "0");

    const member = await getMemberBySub(userId, user.sub);
    return NextResponse.json({
      member,
      is_admin: isAdmin(user.sub),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
