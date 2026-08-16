import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/types";

/**
 * PUT/DELETE /api/members/{id} — non-admin hanya boleh mengubah anggota yang
 * berada di group yang sama (self-edit diizinkan); admin bebas.
 * Firestore di-mock lewat `vi.mock`.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  getMemberBySub: vi.fn(),
  getMember: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  getMemberBySub: mocks.getMemberBySub,
  getMember: mocks.getMember,
  updateMember: mocks.updateMember,
  deleteMember: mocks.deleteMember,
}));

import { DELETE, PUT } from "@/app/api/members/[id]/route";

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

function jsonRequest(memberId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/members/${memberId}?user_id=0`,
    {
      method: "PUT",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

function deleteRequest(memberId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/members/${memberId}?user_id=0`,
    { method: "DELETE", headers: { authorization: "Bearer test-token" } },
  );
}

/** Siapkan user `me` dan target member. */
function setup(me: Member, target: Member) {
  mocks.getMemberBySub.mockResolvedValue(me);
  mocks.getMember.mockImplementation(
    async (_userId: number, mid: string) =>
      mid === target.id ? { ...target } : null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("PUT /api/members/{id} — aturan satu group", () => {
  it("non-admin belum tertaut → 403", async () => {
    mocks.getMemberBySub.mockResolvedValue(null);
    mocks.getMember.mockResolvedValue(member("orang-lain", ["g1"]));

    const res = await PUT(jsonRequest("orang-lain", { name: "X" }), {
      params: Promise.resolve({ id: "orang-lain" }),
    });
    expect(res.status).toBe(403);
    expect(mocks.updateMember).not.toHaveBeenCalled();
  });

  it("target beda group → 403", async () => {
    setup(member("aku", ["g1"]), member("orang-lain", ["g2"]));

    const res = await PUT(jsonRequest("orang-lain", { name: "X" }), {
      params: Promise.resolve({ id: "orang-lain" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.detail).toContain("group yang sama");
    expect(mocks.updateMember).not.toHaveBeenCalled();
  });

  it("target satu group → 200", async () => {
    const target = member("kolega", ["g1"]);
    setup(member("aku", ["g1"]), target);

    const res = await PUT(jsonRequest("kolega", { name: "Nama Baru" }), {
      params: Promise.resolve({ id: "kolega" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.updateMember).toHaveBeenCalledWith(0, "kolega", {
      name: "Nama Baru",
    });
  });

  it("self-edit diizinkan walau tanpa group → 200", async () => {
    setup(member("aku", []), member("aku", []));

    const res = await PUT(jsonRequest("aku", { phone: "0812" }), {
      params: Promise.resolve({ id: "aku" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.updateMember).toHaveBeenCalledWith(0, "aku", {
      phone: "0812",
    });
  });

  it("admin bebas walau beda group → 200", async () => {
    mocks.isAdmin.mockReturnValue(true);
    mocks.getMember.mockResolvedValue(member("orang-lain", ["g9"]));

    const res = await PUT(jsonRequest("orang-lain", { name: "X" }), {
      params: Promise.resolve({ id: "orang-lain" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.updateMember).toHaveBeenCalledWith(0, "orang-lain", {
      name: "X",
    });
  });
});

describe("DELETE /api/members/{id} — aturan satu group", () => {
  it("target beda group → 403", async () => {
    setup(member("aku", ["g1"]), member("orang-lain", ["g2"]));

    const res = await DELETE(deleteRequest("orang-lain"), {
      params: Promise.resolve({ id: "orang-lain" }),
    });
    expect(res.status).toBe(403);
    expect(mocks.deleteMember).not.toHaveBeenCalled();
  });

  it("target satu group → 200", async () => {
    setup(member("aku", ["g1"]), member("kolega", ["g1"]));

    const res = await DELETE(deleteRequest("kolega"), {
      params: Promise.resolve({ id: "kolega" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.deleteMember).toHaveBeenCalledWith(0, "kolega");
  });
});
