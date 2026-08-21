import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminSubs, isAdmin } from "@/lib/config";
import {
  addMember,
  countMembers,
  getMember,
  getMemberBySub,
  linkParentChild,
  linkSpouses,
  listMembersPaginated,
  setMemberGroups,
} from "@/lib/firestore";
import { errorResponse, HttpError } from "@/lib/http";
import { withAdminFlag } from "@/lib/member";
import type { Member } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function parseUserId(req: NextRequest): number {
  return Number(req.nextUrl.searchParams.get("user_id") ?? "0");
}

/**
 * GET /api/members — daftar anggota (paginated).
 */
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser(req.headers.get("authorization"));
    const userId = parseUserId(req);
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
    const perPageRaw = Number(
      req.nextUrl.searchParams.get("per_page") ?? String(DEFAULT_PER_PAGE),
    );
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageRaw));

    const { members, hasMore } = await listMembersPaginated(
      userId,
      perPage,
      (page - 1) * perPage,
    );
    const total = await countMembers(userId);
    const totalPages = total > 0 ? Math.ceil(total / perPage) : 0;

    return NextResponse.json({
      // Tandai anggota yang termasuk admin (ADMIN_SUBS) untuk tag di UI.
      members: withAdminFlag(members, getAdminSubs()),
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
 * POST /api/members — tambah anggota baru.
 *
 * Aturan akses:
 * - Non-admin (bukan PIC): wajib akun Auth0 sudah tertaut ke anggota silsilah
 *   (`auth0_sub`), dan anggota baru otomatis terhubung sebagai **anak**
 *   (`relation=child`, default) atau **pasangan** (`relation=spouse`)
 *   dari anggota yang mewakilinya.
 * - PIC: menambah anggota **tanpa relasi otomatis** (tidak perlu memilih
 *   anak/pasangan) — anggota baru otomatis masuk ke semua group-nya.
 * - Admin (`ADMIN_SUBS`): menambah anggota **tanpa relasi otomatis**
 *   (tidak perlu memilih anak/pasangan) — bisa untuk setup awal maupun
 *   anggota berdiri sendiri.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req.headers.get("authorization"));
    const userId = parseUserId(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new HttpError(422, "name wajib diisi");

    const relation = body.relation ?? "child";
    if (relation !== "child" && relation !== "spouse") {
      throw new HttpError(422, 'relation harus "child" atau "spouse"');
    }

    const admin = isAdmin(user.sub);
    if (!admin && !(await getMemberBySub(userId, user.sub))) {
      throw new HttpError(
        403,
        "Hanya user yang sudah tertaut ke anggota silsilah yang dapat " +
          "menambah anggota. Hubungi admin untuk menautkan akun Anda.",
      );
    }

    const member: Member = {
      id: "",
      name,
      gender: body.gender === "female" ? "female" : "male",
      birth_date: typeof body.birth_date === "string" ? body.birth_date : null,
      death_date: typeof body.death_date === "string" ? body.death_date : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      parent_ids: [],
      spouse_ids: [],
      child_ids: [],
      sibling_ids: [],
      created_at: null,
      auth0_sub: null,
      group_ids: [],
      is_pic: false,
    };

    let created = await addMember(userId, member);

    // Auto-link anak/pasangan hanya untuk user tertaut biasa (bukan PIC/bukan
    // admin). PIC & admin menambah tanpa relasi otomatis.
    if (!admin) {
      const me = await getMemberBySub(userId, user.sub);
      if (me) {
        if (me.is_pic) {
          // PIC: tanpa relasi otomatis, anggota baru otomatis masuk ke semua
          // group-nya (relasi bisa dihubungkan manual lewat halaman edit).
          if (me.group_ids.length > 0) {
            await setMemberGroups(userId, created.id, me.group_ids);
          }
        } else if (relation === "spouse") {
          await linkSpouses(userId, me.id, created.id);
        } else {
          await linkParentChild(userId, me.id, created.id);
        }
      }
      created = (await getMember(userId, created.id)) ?? created;
    }

    return NextResponse.json(created);
  } catch (err) {
    return errorResponse(err);
  }
}
