import type {
  Member, FamilyTree, PaginatedMembers, SearchResults,
  AdminUsers, AdminStats,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(page = 1) {
  return request<PaginatedMembers>(`/api/members?page=${page}&per_page=20&user_id=0`);
}

export async function searchMembers(q: string) {
  return request<SearchResults>(`/api/members/search?q=${encodeURIComponent(q)}&user_id=0`);
}

export async function getMember(id: string) {
  return request<Member>(`/api/members/${id}?user_id=0`);
}

export async function createMember(data: Partial<Member>) {
  return request<Member>("/api/members?user_id=0", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMember(id: string, data: Partial<Member>) {
  return request<Member>(`/api/members/${id}?user_id=0`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMember(id: string) {
  return request<{ status: string }>(`/api/members/${id}?user_id=0`, {
    method: "DELETE",
  });
}

// ── Relations ───────────────────────────────────────────────────────────────

export type RelationType = "parent_child" | "spouse" | "sibling";

export async function linkMembers(type: RelationType, memberA: string, memberB: string) {
  return request<{ status: string; type: string }>("/api/members/link?user_id=0", {
    method: "POST",
    body: JSON.stringify({ type, member_a_id: memberA, member_b_id: memberB }),
  });
}

export async function unlinkMembers(type: RelationType, memberA: string, memberB: string) {
  return request<{ status: string; type: string }>("/api/members/unlink?user_id=0", {
    method: "POST",
    body: JSON.stringify({ type, member_a_id: memberA, member_b_id: memberB }),
  });
}

// ── Tree ────────────────────────────────────────────────────────────────────

export interface TreeOptions {
  max_nodes?: number;
  depth_up?: number;
  depth_down?: number;
}

export async function getTree(memberId: string, options?: TreeOptions) {
  const params = new URLSearchParams({ user_id: "0" });
  if (options?.max_nodes) params.set("max_nodes", String(options.max_nodes));
  if (options?.depth_up !== undefined) params.set("depth_up", String(options.depth_up));
  if (options?.depth_down !== undefined) params.set("depth_down", String(options.depth_down));
  return request<FamilyTree>(`/api/members/${memberId}/tree?${params.toString()}`);
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function getAdminUsers() {
  return request<AdminUsers>("/api/admin/users?user_id=0");
}

export async function getAdminStats() {
  return request<AdminStats>("/api/admin/stats?user_id=0");
}