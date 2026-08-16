import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/types";

/**
 * GET/POST `/api/admin/groups` — CRUD Group khusus admin. Firestore di-mock
 * lewat `vi.mock`; sub user diatur lewat mock auth; `isAdmin` dari mock config.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  addGroup: vi.fn(),
  listGroups: vi.fn(),
  listGroupsPaginated: vi.fn(),
  countGroups: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  addGroup: mocks.addGroup,
  listGroups: mocks.listGroups,
  listGroupsPaginated: mocks.listGroupsPaginated,
  countGroups: mocks.countGroups,
}));

import { GET as ListGET, POST } from "@/app/api/admin/groups/route";

const TEST_SUB = "google-oauth2|admin";

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
  return new NextRequest("http://localhost:3000/api/admin/groups?user_id=0", {
    headers: { authorization: "Bearer test-token" },
  });
}

function jsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function asAdmin() {
  mocks.isAdmin.mockReturnValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("GET /api/admin/groups", () => {
  it("non-admin ditolak 403", async () => {
    const res = await ListGET(listRequest());
    expect(res.status).toBe(403);
    expect(mocks.listGroupsPaginated).not.toHaveBeenCalled();
  });

  it("admin menerima daftar grup paginated", async () => {
    asAdmin();
    mocks.listGroupsPaginated.mockResolvedValue({
      groups: [group("g1", "EXT", "Eksternal")],
      hasMore: false,
    });
    mocks.countGroups.mockResolvedValue(1);

    const res = await ListGET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].code).toBe("EXT");
    expect(body.total).toBe(1);
    expect(body.total_pages).toBe(1);
    expect(mocks.listGroupsPaginated).toHaveBeenCalledWith(0, 20, 0);
  });
});

describe("POST /api/admin/groups", () => {
  it("non-admin ditolak 403", async () => {
    const res = await POST(
      jsonRequest("/api/admin/groups?user_id=0", { code: "EXT", name: "X" }),
    );
    expect(res.status).toBe(403);
    expect(mocks.addGroup).not.toHaveBeenCalled();
  });

  it("code wajib diisi → 422", async () => {
    asAdmin();
    const res = await POST(
      jsonRequest("/api/admin/groups?user_id=0", { name: "X" }),
    );
    expect(res.status).toBe(422);
  });

  it("name wajib diisi → 422", async () => {
    asAdmin();
    const res = await POST(
      jsonRequest("/api/admin/groups?user_id=0", { code: "EXT" }),
    );
    expect(res.status).toBe(422);
  });

  it("code duplikat (case-insensitive) → 409", async () => {
    asAdmin();
    mocks.listGroups.mockResolvedValue([group("g1", "ext", "Lama")]);

    const res = await POST(
      jsonRequest("/api/admin/groups?user_id=0", { code: "EXT", name: "Baru" }),
    );
    expect(res.status).toBe(409);
    expect(mocks.addGroup).not.toHaveBeenCalled();
  });

  it("admin membuat grup baru", async () => {
    asAdmin();
    mocks.listGroups.mockResolvedValue([]);
    mocks.addGroup.mockImplementation(
      async (_userId: number, g: Group) => ({ ...g, id: "g-new" }),
    );

    const res = await POST(
      jsonRequest("/api/admin/groups?user_id=0", {
        code: " EXT ",
        name: " Keluarga Besar ",
        description: "Semua anggota",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("g-new");
    expect(body.code).toBe("EXT");
    expect(body.name).toBe("Keluarga Besar");
    expect(body.description).toBe("Semua anggota");
  });
});
