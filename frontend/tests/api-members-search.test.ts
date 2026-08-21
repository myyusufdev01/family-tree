import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/types";

/**
 * GET /api/members/search — pencarian anggota berdasarkan nama. Setiap hasil
 * ditandai `is_admin` (true jika `auth0_sub`-nya termasuk `ADMIN_SUBS`) agar
 * frontend bisa menampilkan tag "Admin" saat pencarian di halaman daftar.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminSubs: vi.fn(),
  searchMembers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ getAdminSubs: mocks.getAdminSubs }));
vi.mock("@/lib/firestore", () => ({ searchMembers: mocks.searchMembers }));

import { GET } from "@/app/api/members/search/route";

const TEST_SUB = "google-oauth2|user";

function member(mid: string, auth0Sub: string | null): Member {
  return {
    id: mid,
    name: mid,
    gender: "female",
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
  };
}

function searchRequest(q: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/members/search?q=${encodeURIComponent(q)}&user_id=0`,
    { headers: { authorization: "Bearer test-token" } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
});

describe("GET /api/members/search — tag admin", () => {
  it("hasil dengan auth0_sub di ADMIN_SUBS ditandai is_admin=true", async () => {
    mocks.getAdminSubs.mockReturnValue(new Set(["google-oauth2|dewi"]));
    mocks.searchMembers.mockResolvedValue([
      member("dewi", "google-oauth2|dewi"),
      member("dewi-cabang", "google-oauth2|lain"),
    ]);

    const res = await GET(searchRequest("dewi"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].is_admin).toBe(true);
    expect(body.results[1].is_admin).toBe(false);
  });

  it("hasil tanpa auth0_sub selalu is_admin=false", async () => {
    mocks.getAdminSubs.mockReturnValue(new Set(["google-oauth2|dewi"]));
    mocks.searchMembers.mockResolvedValue([member("bayi-dewi", null)]);

    const res = await GET(searchRequest("dewi"));
    const body = await res.json();
    expect(body.results[0].is_admin).toBe(false);
  });
});
