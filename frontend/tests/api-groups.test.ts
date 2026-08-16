import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
import type { Group } from "@/lib/types";

/**
 * GET `/api/groups` — daftar grup read-only untuk semua user terautentikasi
 * (dipakai tabel daftar anggota). Firestore di-mock lewat `vi.mock`.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listGroups: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/firestore", () => ({ listGroups: mocks.listGroups }));

import { GET } from "@/app/api/groups/route";

const TEST_SUB = "google-oauth2|user";

function group(gid: string, code: string, name = code): Group {
  return {
    id: gid,
    code,
    name,
    description: null,
    created_at: "2026-01-01T00:00:00",
  };
}

function listRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/groups?user_id=0", {
    headers: { authorization: "Bearer test-token" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
});

describe("GET /api/groups", () => {
  it("tanpa token → 401", async () => {
    mocks.getCurrentUser.mockRejectedValue(
      new HttpError(401, "Autentikasi diperlukan (Authorization: Bearer <token>)"),
    );
    const res = await GET(
      new NextRequest("http://localhost:3000/api/groups?user_id=0"),
    );
    expect(res.status).toBe(401);
    expect(mocks.listGroups).not.toHaveBeenCalled();
  });

  it("mengembalikan daftar grup untuk user biasa (bukan admin)", async () => {
    mocks.listGroups.mockResolvedValue([
      group("g1", "EXT", "Eksternal"),
      group("g2", "INT", "Internal"),
    ]);

    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(2);
    expect(body.groups[0].code).toBe("EXT");
    expect(body.groups[1].name).toBe("Internal");
    expect(mocks.listGroups).toHaveBeenCalledWith(0);
  });

  it("daftar grup kosong → { groups: [] }", async () => {
    mocks.listGroups.mockResolvedValue([]);

    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toEqual([]);
  });
});
