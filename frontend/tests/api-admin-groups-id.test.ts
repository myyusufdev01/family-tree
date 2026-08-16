import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/types";

/**
 * GET/PUT/DELETE `/api/admin/groups/[id]` — CRUD Group khusus admin.
 * Firestore di-mock lewat `vi.mock`; sub user diatur lewat mock auth.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  getGroup: vi.fn(),
  listGroups: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/config", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/firestore", () => ({
  getGroup: mocks.getGroup,
  listGroups: mocks.listGroups,
  updateGroup: mocks.updateGroup,
  deleteGroup: mocks.deleteGroup,
}));

import { GET as DetailGET, PUT, DELETE } from "@/app/api/admin/groups/[id]/route";

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

function asAdmin() {
  mocks.isAdmin.mockReturnValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ sub: TEST_SUB });
  mocks.isAdmin.mockReturnValue(false);
});

describe("GET /api/admin/groups/[id]", () => {
  it("non-admin ditolak 403", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/admin/groups/g1?user_id=0",
      { headers: { authorization: "Bearer test-token" } },
    );
    const res = await DetailGET(req, { params: Promise.resolve({ id: "g1" }) });
    expect(res.status).toBe(403);
  });

  it("grup tidak ditemukan → 404", async () => {
    asAdmin();
    mocks.getGroup.mockResolvedValue(null);
    const req = new NextRequest(
      "http://localhost:3000/api/admin/groups/none?user_id=0",
      { headers: { authorization: "Bearer test-token" } },
    );
    const res = await DetailGET(req, {
      params: Promise.resolve({ id: "none" }),
    });
    expect(res.status).toBe(404);
  });

  it("mengembalikan detail grup", async () => {
    asAdmin();
    mocks.getGroup.mockResolvedValue(group("g1", "EXT", "Eksternal"));
    const req = new NextRequest(
      "http://localhost:3000/api/admin/groups/g1?user_id=0",
      { headers: { authorization: "Bearer test-token" } },
    );
    const res = await DetailGET(req, { params: Promise.resolve({ id: "g1" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).code).toBe("EXT");
  });
});

describe("PUT /api/admin/groups/[id]", () => {
  function putRequest(id: string, body: unknown): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/admin/groups/${id}?user_id=0`,
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

  it("non-admin ditolak 403", async () => {
    const res = await PUT(putRequest("g1", { name: "X" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(403);
  });

  it("grup tidak ditemukan → 404", async () => {
    asAdmin();
    mocks.getGroup.mockResolvedValue(null);
    const res = await PUT(putRequest("none", { name: "X" }), {
      params: Promise.resolve({ id: "none" }),
    });
    expect(res.status).toBe(404);
  });

  it("code duplikat ke grup lain → 409", async () => {
    asAdmin();
    mocks.getGroup.mockResolvedValue(group("g1", "EXT", "Eksternal"));
    mocks.listGroups.mockResolvedValue([
      group("g1", "EXT", "Eksternal"),
      group("g2", "INT", "Internal"),
    ]);

    const res = await PUT(putRequest("g1", { code: "int" }), {
      params: Promise.resolve({ id: "g1" }),
    });
    expect(res.status).toBe(409);
    expect(mocks.updateGroup).not.toHaveBeenCalled();
  });

  it("admin mengupdate grup", async () => {
    asAdmin();
    // Store mutable agar getGroup (yang dipanggil ulang setelah update)
    // mengembalikan data yang sudah diperbarui.
    const store: Record<string, Group> = {
      g1: group("g1", "EXT", "Eksternal"),
    };
    mocks.getGroup.mockImplementation(
      async (_userId: number, gid: string) => store[gid] ?? null,
    );
    mocks.listGroups.mockResolvedValue([store.g1]);
    mocks.updateGroup.mockImplementation(
      async (_userId: number, gid: string, fields: Record<string, unknown>) => {
        store[gid] = { ...store[gid], ...fields } as Group;
      },
    );

    const res = await PUT(
      putRequest("g1", { name: "Eksternal Baru", description: "Updated" }),
      { params: Promise.resolve({ id: "g1" }) },
    );
    expect(res.status).toBe(200);
    expect(mocks.updateGroup).toHaveBeenCalledWith(0, "g1", {
      name: "Eksternal Baru",
      description: "Updated",
    });
    expect((await res.json()).name).toBe("Eksternal Baru");
  });
});

describe("DELETE /api/admin/groups/[id]", () => {
  it("non-admin ditolak 403", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/admin/groups/g1?user_id=0",
      { method: "DELETE", headers: { authorization: "Bearer test-token" } },
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "g1" }) });
    expect(res.status).toBe(403);
  });

  it("admin menghapus grup", async () => {
    asAdmin();
    mocks.getGroup.mockResolvedValue(group("g1", "EXT", "Eksternal"));

    const req = new NextRequest(
      "http://localhost:3000/api/admin/groups/g1?user_id=0",
      { method: "DELETE", headers: { authorization: "Bearer test-token" } },
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: "g1" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("deleted");
    expect(mocks.deleteGroup).toHaveBeenCalledWith(0, "g1");
  });
});
