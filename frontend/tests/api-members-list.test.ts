import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/types";

/**
 * GET /api/members — daftar anggota (paginated). Setiap anggota ditandai
 * `is_admin` (true jika `auth0_sub`-nya termasuk `ADMIN_SUBS`) agar frontend
 * bisa menampilkan tag "Admin" di halaman daftar.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminSubs: vi.fn(),
  isAdmin: vi.fn(),
  listMembersPaginated: vi.fn(),
  countMembers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({
  getAdminSubs: mocks.getAdminSubs,
  isAdmin: mocks.isAdmin,
}));
vi.mock("@/lib/firestore", () => ({
  addMember: vi.fn(),
  countMembers: mocks.countMembers,
  getMember: vi.fn(),
  getMemberBySub: vi.fn(),
  linkParentChild: vi.fn(),
  linkSpouses: vi.fn(),
  listMembersPaginated: mocks.listMembersPaginated,
  setMemberGroups: vi.fn(),
}));

import { GET } from "@/app/api/members/route";

const TEST_SUB = "google-oauth2|user";

function member(
  mid: string,
  auth0Sub: string | null,
  overrides: Partial<Member> = {},
): Member {
  return {
    id: mid,
    name: mid,
    gender: "male",
    birth_date: null,
    death_date: null,
    phone: null,
    notes: null,
    parent_ids: [],
    spouse_ids: [],
    child_ids: [],
    sibling_ids: [],
    created_at: null,
    auth0_sub: auth0Sub,
    group_ids: [],
    is_pic: false,
    ...overrides,
  };
}

function listRequest(page = 1): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/members?page=${page}&per_page=20&user_id=0`,
    { headers: { authorization: "Bearer test-token" } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("GET /api/members — tag admin", () => {
  it("member dengan auth0_sub di ADMIN_SUBS ditandai is_admin=true", async () => {
    mocks.getAdminSubs.mockReturnValue(new Set(["google-oauth2|budi"]));
    mocks.listMembersPaginated.mockResolvedValue({
      members: [
        member("budi", "google-oauth2|budi"),
        member("siti", "google-oauth2|siti"),
      ],
      hasMore: false,
    });
    mocks.countMembers.mockResolvedValue(2);

    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members[0].is_admin).toBe(true);
    expect(body.members[1].is_admin).toBe(false);
  });

  it("member tanpa auth0_sub selalu is_admin=false", async () => {
    mocks.getAdminSubs.mockReturnValue(new Set(["google-oauth2|budi"]));
    mocks.listMembersPaginated.mockResolvedValue({
      members: [member("bayi", null)],
      hasMore: false,
    });
    mocks.countMembers.mockResolvedValue(1);

    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members[0].is_admin).toBe(false);
    expect(body.members[0].auth0_sub).toBeNull();
  });

  it("respons tetap berisi pagination & total", async () => {
    mocks.getAdminSubs.mockReturnValue(new Set());
    mocks.listMembersPaginated.mockResolvedValue({
      members: [member("a", null)],
      hasMore: false,
    });
    mocks.countMembers.mockResolvedValue(1);

    const res = await GET(listRequest());
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.per_page).toBe(20);
    expect(body.total).toBe(1);
    expect(body.total_pages).toBe(1);
    expect(body.has_more).toBe(false);
  });
});
