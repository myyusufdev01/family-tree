import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/config";
import {
  addGroup,
  countGroups,
  listGroups,
  listGroupsPaginated,
} from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";
import type { Group } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function parseUserId(req: NextRequest): number {
  return Number(req.nextUrl.searchParams.get("user_id") ?? "0");
}

/** Semua endpoint grup khusus admin — non-admin ditolak 403. */
async function requireAdmin(req: NextRequest): Promise<string> {
  const user = await getCurrentUser(req.headers.get("authorization"));
  if (!isAdmin(user.sub)) {
    throw new HttpError(403, "Not authorized");
  }
  return user.sub;
}

/**
 * GET /api/admin/groups — daftar grup (paginated, diurutkan berdasarkan kode).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const userId = parseUserId(req);
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
    const perPageRaw = Number(
      req.nextUrl.searchParams.get("per_page") ?? String(DEFAULT_PER_PAGE),
    );
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageRaw));

    const { groups, hasMore } = await listGroupsPaginated(
      userId,
      perPage,
      (page - 1) * perPage,
    );
    const total = await countGroups(userId);
    const totalPages = total > 0 ? Math.ceil(total / perPage) : 0;

    return NextResponse.json({
      groups,
      page,
      per_page: perPage,
      has_more: hasMore,
      total,
      total_pages: totalPages,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/admin/groups — tambah grup baru (admin).
 *
 * `code` bersifat unik (case-insensitive) dan wajib, begitu juga `name`.
 * `description` opsional.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const userId = parseUserId(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const code = typeof body.code === "string" ? body.code.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!code) throw new HttpError(422, "code wajib diisi");
    if (!name) throw new HttpError(422, "name wajib diisi");

    const existing = await listGroups(userId);
    if (existing.some((g) => g.code.toLowerCase() === code.toLowerCase())) {
      throw new HttpError(409, `Kode grup "${code}" sudah dipakai`);
    }

    const group: Group = {
      id: "",
      code,
      name,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      created_at: null,
    };

    const created = await addGroup(userId, group);
    return NextResponse.json(created);
  } catch (err) {
    return errorResponse(err);
  }
}
