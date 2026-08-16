import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import {
  deleteGroup,
  getGroup,
  listGroups,
  updateGroup,
} from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/** Semua endpoint grup khusus admin — non-admin ditolak 403. */
async function requireAdmin(req: NextRequest): Promise<string> {
  const user = await getCurrentUser(req.headers.get("authorization"));
  if (!isAdmin(user.sub)) {
    throw new HttpError(403, "Not authorized");
  }
  return user.sub;
}

function parseUserId(req: NextRequest): number {
  return Number(req.nextUrl.searchParams.get("user_id") ?? "0");
}

/** GET /api/admin/groups/{id} — detail grup (admin). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const group = await getGroup(parseUserId(req), id);
    if (!group) throw new HttpError(404, "Group not found");
    return NextResponse.json(group);
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PUT /api/admin/groups/{id} — update grup (admin).
 *
 * `code` dan `name` wajib non-kosong bila dikirim; `code` harus tetap unik
 * (case-insensitive, mengabaikan dirinya sendiri).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req);
    const userId = parseUserId(req);
    const { id } = await params;

    const existing = await getGroup(userId, id);
    if (!existing) throw new HttpError(404, "Group not found");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fields: Record<string, unknown> = {};

    const code =
      body.code !== undefined && body.code !== null
        ? String(body.code).trim()
        : existing.code;
    if (!code) throw new HttpError(422, "code wajib diisi");
    if (code.toLowerCase() !== existing.code.toLowerCase()) {
      const all = await listGroups(userId);
      if (all.some((g) => g.id !== id && g.code.toLowerCase() === code.toLowerCase())) {
        throw new HttpError(409, `Kode grup "${code}" sudah dipakai`);
      }
      fields.code = code;
    }

    const name =
      body.name !== undefined && body.name !== null
        ? String(body.name).trim()
        : existing.name;
    if (!name) throw new HttpError(422, "name wajib diisi");
    if (name !== existing.name) fields.name = name;

    if (
      body.description !== undefined &&
      body.description !== null &&
      String(body.description).trim() !== existing.description
    ) {
      fields.description = String(body.description).trim();
    }

    if (Object.keys(fields).length > 0) {
      await updateGroup(userId, id, fields);
    }

    const updated = await getGroup(userId, id);
    return NextResponse.json(updated ?? existing);
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/admin/groups/{id} — hapus grup (admin). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req);
    const userId = parseUserId(req);
    const { id } = await params;

    const existing = await getGroup(userId, id);
    if (!existing) throw new HttpError(404, "Group not found");

    await deleteGroup(userId, id);
    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    return errorResponse(err);
  }
}
