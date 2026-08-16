import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteMember,
  getMember,
  updateMember,
} from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const UPDATABLE_KEYS = [
  "name",
  "gender",
  "birth_date",
  "death_date",
  "phone",
  "notes",
] as const;

function parseUserId(req: NextRequest): number {
  return Number(req.nextUrl.searchParams.get("user_id") ?? "0");
}

/** GET /api/members/{id} — detail anggota. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const { id } = await params;
    const member = await getMember(parseUserId(req), id);
    if (!member) throw new HttpError(404, "Member not found");
    return NextResponse.json(member);
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/members/{id} — update anggota. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = parseUserId(req);
    const { id } = await params;

    const existing = await getMember(userId, id);
    if (!existing) throw new HttpError(404, "Member not found");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fields: Record<string, unknown> = {};
    for (const key of UPDATABLE_KEYS) {
      if (body[key] !== undefined && body[key] !== null) {
        fields[key] = body[key];
      }
    }
    if (Object.keys(fields).length > 0) {
      await updateMember(userId, id, fields);
    }

    const updated = await getMember(userId, id);
    return NextResponse.json(updated ?? existing);
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/members/{id} — hapus anggota + bersihkan relasi. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = parseUserId(req);
    const { id } = await params;

    const existing = await getMember(userId, id);
    if (!existing) throw new HttpError(404, "Member not found");

    await deleteMember(userId, id);
    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    return errorResponse(err);
  }
}
