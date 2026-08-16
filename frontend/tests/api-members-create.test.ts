import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/types";

/**
 * Port dari `backend/tests/test_create_member_access.py`:
 * POST /api/members — hanya user tertaut (atau admin), dan anggota baru
 * otomatis terhubung sebagai anak (default) atau pasangan user penambah.
 * Firestore di-mock lewat `vi.mock`; sub user diatur lewat mock auth.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  getMemberBySub: vi.fn(),
  addMember: vi.fn(),
  getMember: vi.fn(),
  linkParentChild: vi.fn(),
  linkSpouses: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  getMemberBySub: mocks.getMemberBySub,
  addMember: mocks.addMember,
  getMember: mocks.getMember,
  linkParentChild: mocks.linkParentChild,
  linkSpouses: mocks.linkSpouses,
}));

import { POST } from "@/app/api/members/route";

const TEST_SUB = "google-oauth2|member";

function member(mid: string): Member {
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
    auth0_sub: null,
  };
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/members?user_id=0", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Mock fungsi Firestore; return penampung panggilan link. */
function setupCreate(me: Member | null, memberId: string) {
  const createdHolder: { created?: Member } = {};
  mocks.getMemberBySub.mockResolvedValue(me);
  mocks.addMember.mockImplementation(async (_userId: number, m: Member) => {
    const created: Member = {
      ...m,
      id: memberId,
      created_at: "2026-01-01T00:00:00",
      auth0_sub: null,
    };
    createdHolder.created = created;
    return created;
  });
  mocks.getMember.mockImplementation(async (_userId: number, mid: string) =>
    createdHolder.created?.id === mid ? createdHolder.created : member(mid),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("POST /api/members", () => {
  it("user belum tertaut ditolak 403", async () => {
    mocks.getMemberBySub.mockResolvedValue(null);

    const res = await POST(jsonRequest({ name: "Anak Baru" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.detail).toContain("tertaut");
  });

  it("user tertaut — anggota baru otomatis jadi anaknya", async () => {
    setupCreate(member("aku"), "member-1");

    const res = await POST(jsonRequest({ name: "Anak Baru" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("member-1");
    expect(body.name).toBe("Anak Baru");
    // Default relation=child → auto-parent ke "aku".
    expect(mocks.linkParentChild).toHaveBeenCalledWith(0, "aku", "member-1");
    expect(mocks.linkSpouses).not.toHaveBeenCalled();
  });

  it("user tertaut menambah pasangan", async () => {
    setupCreate(member("aku"), "member-4");

    const res = await POST(jsonRequest({ name: "Istri", relation: "spouse" }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("member-4");
    // relation=spouse → linkSpouses(aku, member-4), bukan parent_child.
    expect(mocks.linkSpouses).toHaveBeenCalledWith(0, "aku", "member-4");
    expect(mocks.linkParentChild).not.toHaveBeenCalled();
  });

  it("admin bypass menambah tanpa relasi saat belum tertaut", async () => {
    mocks.isAdmin.mockReturnValue(true);
    setupCreate(null, "member-2");

    const res = await POST(jsonRequest({ name: "Anggota Awal" }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("member-2");
    // Admin belum tertaut → tidak ada auto-link.
    expect(mocks.linkParentChild).not.toHaveBeenCalled();
    expect(mocks.linkSpouses).not.toHaveBeenCalled();
  });

  it("admin menambah tanpa relasi otomatis meski sudah tertaut", async () => {
    mocks.isAdmin.mockReturnValue(true);
    setupCreate(member("kakek"), "member-3");

    const res = await POST(jsonRequest({ name: "Cucu" }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("member-3");
    // Admin tidak perlu memilih anak/pasangan → tanpa auto-link.
    expect(mocks.linkParentChild).not.toHaveBeenCalled();
    expect(mocks.linkSpouses).not.toHaveBeenCalled();
  });

  it("relation tidak valid ditolak 422", async () => {
    setupCreate(member("aku"), "member-5");

    const res = await POST(jsonRequest({ name: "X", relation: "kakak" }));
    expect(res.status).toBe(422);
  });
});
