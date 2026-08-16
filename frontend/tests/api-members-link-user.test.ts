import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/types";

/**
 * Port dari `backend/tests/test_link_user_endpoint.py`:
 * POST /api/members/{id}/link-user — khusus admin. Firestore di-mock lewat
 * `vi.mock`; sub user diatur lewat mock auth.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  getMember: vi.fn(),
  linkUserToMember: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  getMember: mocks.getMember,
  linkUserToMember: mocks.linkUserToMember,
}));

import { POST } from "@/app/api/members/[id]/link-user/route";

const TEST_SUB = "google-oauth2|admin";

function member(mid: string, auth0Sub: string | null = null): Member {
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
  };
}

function jsonRequest(memberId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/members/${memberId}/link-user?user_id=0`,
    {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

function asAdmin() {
  mocks.isAdmin.mockReturnValue(true);
}

/** target berperan seperti mock get_member di test Python. */
function setupTarget(target: Member) {
  mocks.getMember.mockImplementation(
    async (_userId: number, mid: string) => (mid === target.id ? target : null),
  );
  mocks.linkUserToMember.mockImplementation(
    async (_userId: number, _mid: string, sub: string) => {
      target.auth0_sub = sub;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false); // ADMIN_SUBS default kosong → bukan admin
});

describe("POST /api/members/{id}/link-user", () => {
  it("non-admin ditolak 403", async () => {
    const res = await POST(jsonRequest("anak", { sub: "google-oauth2|anak" }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.detail.toLowerCase()).toContain("admin");
  });

  it("admin boleh menautkan anggota manapun", async () => {
    asAdmin();
    // sengaja bukan keturunan — admin bebas
    setupTarget(member("sepupu"));

    const res = await POST(jsonRequest("sepupu", { sub: "google-oauth2|sepupu" }), {
      params: Promise.resolve({ id: "sepupu" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).auth0_sub).toBe("google-oauth2|sepupu");
  });

  it("admin bisa menautkan dirinya sendiri setup awal", async () => {
    asAdmin();
    setupTarget(member("kakek"));

    const res = await POST(jsonRequest("kakek", { sub: TEST_SUB }), {
      params: Promise.resolve({ id: "kakek" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).auth0_sub).toBe(TEST_SUB);
  });

  it("admin boleh mengganti tautan lama", async () => {
    asAdmin();
    setupTarget(member("anak", "google-oauth2|orang_lama"));

    const res = await POST(jsonRequest("anak", { sub: "google-oauth2|orang_baru" }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).auth0_sub).toBe("google-oauth2|orang_baru");
  });

  it("member tidak ditemukan → 404", async () => {
    asAdmin();
    mocks.getMember.mockResolvedValue(null);

    const res = await POST(jsonRequest("nonexistent", { sub: "google-oauth2|x" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("sub kosong ditolak 400", async () => {
    asAdmin();
    mocks.getMember.mockResolvedValue(member("anak"));

    const res = await POST(jsonRequest("anak", { sub: "   " }), {
      params: Promise.resolve({ id: "anak" }),
    });
    expect(res.status).toBe(400);
  });
});
