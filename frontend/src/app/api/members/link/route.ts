import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  linkParentChild,
  linkSiblings,
  linkSpouses,
} from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const VALID_TYPES = ["parent_child", "spouse", "sibling"] as const;
type LinkType = (typeof VALID_TYPES)[number];

interface LinkBody {
  type?: string;
  member_a_id?: string;
  member_b_id?: string;
}

function parseUserId(req: NextRequest): number {
  return Number(req.nextUrl.searchParams.get("user_id") ?? "0");
}

/** POST /api/members/link — hubungkan relasi. */
export async function POST(req: NextRequest) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = parseUserId(req);
    const body = (await req.json().catch(() => ({}))) as LinkBody;

    if (!VALID_TYPES.includes(body.type as LinkType)) {
      throw new HttpError(400, "Invalid link type");
    }
    if (!body.member_a_id || !body.member_b_id) {
      throw new HttpError(400, "member_a_id dan member_b_id wajib diisi");
    }

    switch (body.type as LinkType) {
      case "parent_child":
        await linkParentChild(userId, body.member_a_id, body.member_b_id);
        return NextResponse.json({ status: "linked", type: "parent_child" });
      case "spouse":
        await linkSpouses(userId, body.member_a_id, body.member_b_id);
        return NextResponse.json({ status: "linked", type: "spouse" });
      case "sibling":
        await linkSiblings(userId, body.member_a_id, body.member_b_id);
        return NextResponse.json({ status: "linked", type: "sibling" });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
