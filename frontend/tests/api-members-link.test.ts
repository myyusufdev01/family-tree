import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/types";

/**
 * POST /api/members/link — koneksi hanya boleh antar user yang berada di group
 * yang sama (pembuat, A, dan B berbagi minimal satu group). Admin bebas.
 * Firestore di-mock lewat `vi.mock`.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  getMemberBySub: vi.fn(),
  getMember: vi.fn(),
  linkParentChild: vi.fn(),
  linkSpouses: vi.fn(),
  linkSiblings: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  getMemberBySub: mocks.getMemberBySub,
  getMember: mocks.getMember,
  linkParentChild: mocks.linkParentChild,
  linkSpouses: mocks.linkSpouses,
  linkSiblings: mocks.linkSiblings,
}));

import { POST } from "@/app/api/members/link/route";

const TEST_SUB = "google-oauth2|member";

function member(mid: string, groupIds: string[] = []): Member {
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
    auth0_sub: "google-oauth2|" + mid,
    group_ids: groupIds,
    is_pic: false,
  };
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/members/link?user_id=0", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("POST /api/members/link — aturan group yang sama", () => {
  it("non-admin belum tertaut → 403", async () => {
    mocks.getMemberBySub.mockResolvedValue(null);

    const res = await POST(
      jsonRequest({ type: "parent_child", member_a_id: "a", member_b_id: "b" }),
    );
    expect(res.status).toBe(403);
    expect(mocks.linkParentChild).not.toHaveBeenCalled();
  });

  it("non-admin tertaut tanpa group → 403 (koneksi hanya di group yang sama)", async () => {
    mocks.getMemberBySub.mockResolvedValue(member("aku", []));
    mocks.getMember.mockImplementation(
      async (_userId: number, mid: string) =>
        mid === "a" ? member("a", []) : member("b", []),
    );

    const res = await POST(
      jsonRequest({ type: "parent_child", member_a_id: "a", member_b_id: "b" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.detail).toContain("group yang sama");
    expect(mocks.linkParentChild).not.toHaveBeenCalled();
  });

  it("A dan B di group yang sama dengan pembuat → 200", async () => {
    mocks.getMemberBySub.mockResolvedValue(member("aku", ["g1", "g2"]));
    mocks.getMember.mockImplementation(
      async (_userId: number, mid: string) =>
        mid === "a" ? member("a", ["g1"]) : member("b", ["g1"]),
    );

    const res = await POST(
      jsonRequest({ type: "parent_child", member_a_id: "a", member_b_id: "b" }),
    );
    expect(res.status).toBe(200);
    expect(mocks.linkParentChild).toHaveBeenCalledWith(0, "a", "b");
  });

  it("B di group lain (bukan group pembuat) → 403", async () => {
    mocks.getMemberBySub.mockResolvedValue(member("aku", ["g1"]));
    mocks.getMember.mockImplementation(
      async (_userId: number, mid: string) =>
        mid === "a" ? member("a", ["g1"]) : member("b", ["g2"]),
    );

    const res = await POST(
      jsonRequest({ type: "spouse", member_a_id: "a", member_b_id: "b" }),
    );
    expect(res.status).toBe(403);
    expect(mocks.linkSpouses).not.toHaveBeenCalled();
  });

  it("admin bebas walau tanpa group → 200", async () => {
    mocks.isAdmin.mockReturnValue(true);

    const res = await POST(
      jsonRequest({ type: "parent_child", member_a_id: "a", member_b_id: "b" }),
    );
    expect(res.status).toBe(200);
    expect(mocks.linkParentChild).toHaveBeenCalledWith(0, "a", "b");
  });

  it("member tidak ditemukan → 404", async () => {
    mocks.getMemberBySub.mockResolvedValue(member("aku", ["g1"]));
    mocks.getMember.mockResolvedValue(null);

    const res = await POST(
      jsonRequest({ type: "parent_child", member_a_id: "a", member_b_id: "b" }),
    );
    expect(res.status).toBe(404);
  });
});
