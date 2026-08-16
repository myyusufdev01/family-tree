import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/types";

/**
 * PUT /api/members/{id}/pic — jadikan/batalkan user sebagai PIC (khusus admin).
 * Firestore di-mock lewat `vi.mock`; sub user diatur lewat mock auth.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  getMember: vi.fn(),
  setMemberPic: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  getMember: mocks.getMember,
  setMemberPic: mocks.setMemberPic,
}));

import { PUT } from "@/app/api/members/[id]/pic/route";

const TEST_SUB = "google-oauth2|admin";

function member(mid: string, isPic = false): Member {
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
    group_ids: [],
    is_pic: isPic,
  };
}

function jsonRequest(memberId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/members/${memberId}/pic?user_id=0`,
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

/** target menyimpan is_pic terbaru (meniru update Firestore). */
function setupTarget(target: Member) {
  mocks.getMember.mockImplementation(
    async (_userId: number, mid: string) =>
      mid === target.id ? { ...target } : null,
  );
  mocks.setMemberPic.mockImplementation(
    async (_userId: number, _mid: string, isPic: boolean) => {
      target.is_pic = isPic;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("PUT /api/members/{id}/pic", () => {
  it("non-admin ditolak 403", async () => {
    const target = member("anak");
    setupTarget(target);

    const res = await PUT(jsonRequest("anak", { is_pic: true }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(403);
    expect(mocks.setMemberPic).not.toHaveBeenCalled();
  });

  it("member tidak ditemukan → 404", async () => {
    mocks.isAdmin.mockReturnValue(true);
    mocks.getMember.mockResolvedValue(null);

    const res = await PUT(jsonRequest("nonexistent", { is_pic: true }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("is_pic bukan boolean → 422", async () => {
    mocks.isAdmin.mockReturnValue(true);
    setupTarget(member("anak"));

    const res = await PUT(jsonRequest("anak", { is_pic: "yes" }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(422);
    expect(mocks.setMemberPic).not.toHaveBeenCalled();
  });

  it("admin menjadikan user sebagai PIC", async () => {
    mocks.isAdmin.mockReturnValue(true);
    const target = member("anak", false);
    setupTarget(target);

    const res = await PUT(jsonRequest("anak", { is_pic: true }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).is_pic).toBe(true);
    expect(mocks.setMemberPic).toHaveBeenCalledWith(0, "anak", true);
  });

  it("admin membatalkan status PIC", async () => {
    mocks.isAdmin.mockReturnValue(true);
    const target = member("anak", true);
    setupTarget(target);

    const res = await PUT(jsonRequest("anak", { is_pic: false }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).is_pic).toBe(false);
    expect(mocks.setMemberPic).toHaveBeenCalledWith(0, "anak", false);
  });
});
