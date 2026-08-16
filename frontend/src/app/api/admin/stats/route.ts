import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import { getDb, listApprovedUsers } from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/admin/stats — statistik aplikasi (admin). */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("authorization"));
    if (!isAdmin(user.sub)) {
      throw new HttpError(403, "Not authorized");
    }

    const db = getDb();
    const trees = await db.collection("family_trees").get();
    let totalMembers = 0;
    for (const treeDoc of trees.docs) {
      const membersSnap = await treeDoc.ref.collection("members").get();
      totalMembers += membersSnap.size;
    }
    const approved = await listApprovedUsers();

    return NextResponse.json({
      total_users: approved.length,
      total_members: totalMembers,
      total_trees: trees.size,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
