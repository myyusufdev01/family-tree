import type { Group } from "./types";

/**
 * Mapping Firestore doc ⇄ objek Group.
 *
 * Dokumen di Firestore menyimpan `code_lower` untuk pengurutan/pencarian prefix
 * (pola sama seperti `name_lower` pada Member). Mapping di sini memastikan
 * default yang aman untuk data lama yang belum memiliki field tertentu.
 */

export function groupFromDoc(data: Record<string, unknown>): Group {
  return {
    id: String(data.id ?? ""),
    code: String(data.code ?? ""),
    code_lower:
      typeof data.code_lower === "string" ? data.code_lower : undefined,
    name: String(data.name ?? ""),
    description: (data.description as string | null) ?? null,
    created_at: (data.created_at as string | null) ?? null,
  };
}

/** Serialisasi Group ke Firestore — `code_lower` selalu disinkronkan. */
export function groupToDoc(group: Group): Record<string, unknown> {
  return {
    id: group.id,
    code: group.code,
    code_lower: group.code.toLowerCase(),
    name: group.name,
    description: group.description,
    // Format ISO tanpa zona waktu — sama seperti Member (created_at).
    created_at:
      group.created_at ?? new Date().toISOString().replace("Z", ""),
  };
}
