import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import {
  getMember,
  getMemberBySub,
  linkParentChild,
  linkSiblings,
  linkSpouses,
} from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";
import type { Member } from "@/lib/types";

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

/**
 * Aturan akses: admin bebas. Non-admin hanya boleh menghubungkan dua anggota
 * yang berada di group yang sama dengannya — pembuat koneksi, anggota A, dan
 * anggota B harus berbagi setidaknya satu group yang sama. User yang belum
 * punya group tidak bisa membuat koneksi.
 */
async function assertCanLink(me: Member, a: Member, b: Member): Promise<void> {
  if (!me.group_ids.length || !a.group_ids.length || !b.group_ids.length) {
    throw new HttpError(
      403,
      "Koneksi hanya bisa dibuat antar user yang berada di group yang sama.",
    );
  }
  const shared = a.group_ids.some(
    (gid) => b.group_ids.includes(gid) && me.group_ids.includes(gid),
  );
  if (!shared) {
    throw new HttpError(
      403,
      "Koneksi hanya bisa dibuat antar user yang berada di group yang sama.",
    );
  }
}

/** POST /api/members/link — hubungkan relasi. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("authorization"));
    const userId = parseUserId(req);
    const body = (await req.json().catch(() => ({}))) as LinkBody;

    if (!VALID_TYPES.includes(body.type as LinkType)) {
      throw new HttpError(400, "Invalid link type");
    }
    if (!body.member_a_id || !body.member_b_id) {
      throw new HttpError(400, "member_a_id dan member_b_id wajib diisi");
    }

    // Non-admin wajib tertaut; koneksi hanya boleh antar user di group yang sama.
    const admin = isAdmin(user.sub);
    if (!admin) {
      const me = await getMemberBySub(userId, user.sub);
      if (!me) {
        throw new HttpError(
          403,
          "Hanya user yang sudah tertaut ke anggota silsilah yang dapat " +
            "membuat koneksi. Hubungi admin untuk menautkan akun Anda.",
        );
      }
      const [a, b] = await Promise.all([
        getMember(userId, body.member_a_id),
        getMember(userId, body.member_b_id),
      ]);
      if (!a || !b) throw new HttpError(404, "Member not found");
      await assertCanLink(me, a, b);
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
