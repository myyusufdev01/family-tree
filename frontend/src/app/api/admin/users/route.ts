import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSubs, isAdmin } from "@/lib/config";
import { approveUser, listApprovedUsers } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest): Promise<string> {
  return getCurrentUser(req.headers.get("authorization")).then((user) => {
    if (!isAdmin(user.sub)) {
      throw new HttpError(403, "Not authorized");
    }
    return user.sub;
  });
}

function parseUserId(req: NextRequest): number {
  return Number(req.nextUrl.searchParams.get("user_id") ?? "0");
}

/** GET /api/admin/users — daftar user ter-approve (admin). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const users = await listApprovedUsers();
    return NextResponse.json({ users, admin_subs: [...getAdminSubs()] });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/admin/users — approve user (admin). */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const userId = parseUserId(req);
    const body = (await req.json().catch(() => ({}))) as {
      user_id?: unknown;
      name?: unknown;
    };
    const targetId = Number(body.user_id);
    if (!Number.isInteger(targetId)) {
      throw new HttpError(422, "user_id wajib berupa angka");
    }

    await approveUser(
      targetId,
      typeof body.name === "string" ? body.name : "",
      userId,
    );
    return NextResponse.json({ status: "approved", user_id: targetId });
  } catch (err) {
    return errorResponse(err);
  }
}
