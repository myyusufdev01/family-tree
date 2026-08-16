import type { Member } from "./types";

/**
 * Mapping Firestore doc ⇄ objek Member (port dari `backend/models/member.py`).
 * Dokumen di Firestore menyimpan seluruh field member (termasuk `name_lower`
 * untuk pencarian prefix), jadi mapping di sini memastikan default yang aman
 * untuk data lama yang belum memiliki field tertentu.
 */

export function memberFromDoc(data: Record<string, unknown>): Member {
  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? ""),
    name_lower: typeof data.name_lower === "string" ? data.name_lower : undefined,
    gender: data.gender === "female" ? "female" : "male",
    birth_date: (data.birth_date as string | null) ?? null,
    death_date: (data.death_date as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    parent_ids: strArray(data.parent_ids),
    spouse_ids: strArray(data.spouse_ids),
    child_ids: strArray(data.child_ids),
    sibling_ids: strArray(data.sibling_ids),
    created_at: (data.created_at as string | null) ?? null,
    auth0_sub: data.auth0_sub as string | null | undefined,
    group_ids: strArray(data.group_ids),
  };
}

/** Serialisasi Member ke Firestore — `name_lower` selalu disinkronkan. */
export function memberToDoc(member: Member): Record<string, unknown> {
  return {
    id: member.id,
    name: member.name,
    name_lower: member.name.toLowerCase(),
    gender: member.gender,
    birth_date: member.birth_date,
    death_date: member.death_date,
    phone: member.phone,
    notes: member.notes,
    parent_ids: member.parent_ids,
    spouse_ids: member.spouse_ids,
    child_ids: member.child_ids,
    sibling_ids: member.sibling_ids,
    // Format ISO tanpa zona waktu — sama seperti datetime.utcnow().isoformat()
    // di backend lama agar sortir created_at tetap konsisten.
    created_at:
      member.created_at ?? new Date().toISOString().replace("Z", ""),
    auth0_sub: member.auth0_sub ?? null,
    group_ids: member.group_ids,
  };
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}
