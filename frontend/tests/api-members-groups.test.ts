import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, Member } from "@/lib/types";

/**
 * PUT /api/members/{id}/groups — atur group akun user (khusus admin).
 * Firestore di-mock lewat `vi.mock`; sub user diatur lewat mock auth.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  getMember: vi.fn(),
  listGroups: vi.fn(),
  setMemberGroups: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  getMember: mocks.getMember,
  listGroups: mocks.listGroups,
  setMemberGroups: mocks.setMemberGroups,
}));

import { PUT } from "@/app/api/members/[id]/groups/route";

const TEST_SUB = "google-oauth2|admin";

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

function group(gid: string, code: string): Group {
  return {
    id: gid,
    code,
    name: code,
    description: null,
    created_at: "2026-01-01T00:00:00",
  };
}

function jsonRequest(memberId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/members/${memberId}/groups?user_id=0`,
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

/** target menyimpan group_ids terbaru (meniru update Firestore). */
function setupTarget(target: Member) {
  mocks.getMember.mockImplementation(
    async (_userId: number, mid: string) =>
      mid === target.id ? { ...target } : null,
  );
  mocks.setMemberGroups.mockImplementation(
    async (_userId: number, _mid: string, groupIds: string[]) => {
      target.group_ids = groupIds;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("PUT /api/members/{id}/groups", () => {
  it("non-admin ditolak 403", async () => {
    const target = member("anak");
    setupTarget(target);
    mocks.listGroups.mockResolvedValue([group("g1", "EXT")]);

    const res = await PUT(jsonRequest("anak", { group_ids: ["g1"] }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.detail.toLowerCase()).toContain("admin");
    expect(mocks.setMemberGroups).not.toHaveBeenCalled();
  });

  it("member tidak ditemukan → 404", async () => {
    mocks.isAdmin.mockReturnValue(true);
    mocks.getMember.mockResolvedValue(null);

    const res = await PUT(jsonRequest("nonexistent", { group_ids: [] }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("group_ids bukan array → 422", async () => {
    mocks.isAdmin.mockReturnValue(true);
    setupTarget(member("anak"));

    const res = await PUT(jsonRequest("anak", { group_ids: "g1" }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(422);
    expect(mocks.setMemberGroups).not.toHaveBeenCalled();
  });

  it("group_ids berisi non-string → 422", async () => {
    mocks.isAdmin.mockReturnValue(true);
    setupTarget(member("anak"));

    const res = await PUT(jsonRequest("anak", { group_ids: [123] }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(422);
    expect(mocks.setMemberGroups).not.toHaveBeenCalled();
  });

  it("admin menyimpan group_ids (duplikat dibuang, id asing difilter)", async () => {
    mocks.isAdmin.mockReturnValue(true);
    const target = member("anak", ["g1"]);
    setupTarget(target);
    mocks.listGroups.mockResolvedValue([
      group("g1", "EXT"),
      group("g2", "INT"),
    ]);

    const res = await PUT(
      jsonRequest("anak", {
        group_ids: ["g1", "g2", "g1", "g-hapus"],
      }),
      { params: Promise.resolve({ id: "anak" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.group_ids).toEqual(["g1", "g2"]);
    expect(mocks.setMemberGroups).toHaveBeenCalledWith(0, "anak", [
      "g1",
      "g2",
    ]);
  });

  it("admin menghapus semua group", async () => {
    mocks.isAdmin.mockReturnValue(true);
    const target = member("anak", ["g1"]);
    setupTarget(target);
    mocks.listGroups.mockResolvedValue([group("g1", "EXT")]);

    const res = await PUT(jsonRequest("anak", { group_ids: [] }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).group_ids).toEqual([]);
    expect(mocks.setMemberGroups).toHaveBeenCalledWith(0, "anak", []);
  });
});
