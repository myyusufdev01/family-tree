import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import { revokeUser } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/** DELETE /api/admin/users/{target_id} — revoke user (admin). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser(req.headers.get("authorization"));
    if (!isAdmin(user.sub)) {
      throw new HttpError(403, "Not authorized");
    }
    const { id } = await params;
    const targetId = Number(id);
    if (!Number.isInteger(targetId)) {
      throw new HttpError(422, "target_id wajib berupa angka");
    }

    await revokeUser(targetId);
    return NextResponse.json({ status: "revoked", user_id: targetId });
  } catch (err) {
    return errorResponse(err);
  }
}
