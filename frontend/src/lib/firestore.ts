import { randomUUID } from "node:crypto";
import { Firestore } from "@google-cloud/firestore";
import { getFirestoreProjectId } from "./config";
import { memberFromDoc, memberToDoc } from "./member";
import type { Member } from "./types";

/**
 * Akses Firestore (port dari `backend/db/firestore.py`).
 *
 * Struktur data:
 *   family_trees/{user_id}/members/{member_id}
 *   approved_users/{user_id}
 *
 * `user_id=0` dipakai sebagai pohon bersama keluarga (default).
 */

export const SEARCH_LIMIT = 10;

let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (!_db) {
    _db = new Firestore({ projectId: getFirestoreProjectId() });
  }
  return _db;
}

function _treeRef(userId: number) {
  return getDb().collection("family_trees").doc(String(userId));
}

function _membersRef(userId: number) {
  return _treeRef(userId).collection("members");
}

function _approvedRef() {
  return getDb().collection("approved_users");
}

// ── Member CRUD ─────────────────────────────────────────────────────────────

export async function addMember(userId: number, member: Member): Promise<Member> {
  const id = member.id || randomUUID();
  const doc = { ...memberToDoc(member), id };
  await _membersRef(userId).doc(id).set(doc);
  return memberFromDoc(doc);
}

export async function getMember(
  userId: number,
  memberId: string,
): Promise<Member | null> {
  const doc = await _membersRef(userId).doc(memberId).get();
  return doc.exists ? memberFromDoc(doc.data() ?? {}) : null;
}

// ── List / pagination / search ───────────────────────────────────────────────

/** Ambil semua anggota — hanya untuk pohon kecil atau lookup relasi. */
export async function listMembers(userId: number): Promise<Member[]> {
  const snapshot = await _membersRef(userId).orderBy("name_lower").get();
  return snapshot.docs.map((d) => memberFromDoc(d.data()));
}

/** Return `per_page` anggota mulai dari `offset` + info apakah masih ada lagi. */
export async function listMembersPaginated(
  userId: number,
  perPage = 20,
  offset = 0,
): Promise<{ members: Member[]; hasMore: boolean }> {
  const snapshot = await _membersRef(userId)
    .orderBy("name_lower")
    .offset(offset)
    .limit(perPage + 1)
    .get();
  const docs = snapshot.docs;
  const hasMore = docs.length > perPage;
  return {
    members: docs.slice(0, perPage).map((d) => memberFromDoc(d.data())),
    hasMore,
  };
}

/** Jumlah seluruh anggota milik user (untuk pagination & statistik). */
export async function countMembers(userId: number): Promise<number> {
  const snapshot = await _membersRef(userId).count().get();
  return snapshot.data().count;
}

/** Prefix search pada field name_lower; fallback substring untuk data lama. */
export async function searchMembers(
  userId: number,
  query: string,
): Promise<Member[]> {
  const q = query.toLowerCase().trim();
  const snapshot = await _membersRef(userId)
    .orderBy("name_lower")
    .where("name_lower", ">=", q)
    .where("name_lower", "<=", q + "\uf8ff")
    .limit(SEARCH_LIMIT)
    .get();
  let results = snapshot.docs.map((d) => memberFromDoc(d.data()));

  // Fallback: substring search untuk data lama tanpa name_lower.
  if (results.length === 0) {
    const fallback = await _membersRef(userId).limit(200).get();
    results = fallback.docs
      .map((d) => memberFromDoc(d.data()))
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, SEARCH_LIMIT);
  }

  return results;
}

// ── User ↔ Member (Auth0) ────────────────────────────────────────────────────

/** Cari anggota yang akun Auth0-nya (`sub`) tertaut padanya. */
export async function getMemberBySub(
  userId: number,
  sub: string,
): Promise<Member | null> {
  if (!sub) return null;
  const snapshot = await _membersRef(userId)
    .where("auth0_sub", "==", sub)
    .limit(1)
    .get();
  return snapshot.docs.length > 0
    ? memberFromDoc(snapshot.docs[0].data())
    : null;
}

/** Tautkan akun Auth0 (`sub`) ke seorang anggota silsilah. */
export async function linkUserToMember(
  userId: number,
  memberId: string,
  sub: string,
): Promise<void> {
  await updateMember(userId, memberId, { auth0_sub: sub });
}

// ── Approved Users ───────────────────────────────────────────────────────────

export async function approveUser(
  userId: number,
  name = "",
  addedBy = 0,
): Promise<void> {
  await _approvedRef().doc(String(userId)).set({
    user_id: userId,
    name,
    added_by: addedBy,
    approved_at: new Date().toISOString().replace("Z", ""),
  });
}

export async function revokeUser(userId: number): Promise<void> {
  await _approvedRef().doc(String(userId)).delete();
}

export async function listApprovedUsers(): Promise<Record<string, unknown>[]> {
  const snapshot = await _approvedRef().get();
  return snapshot.docs.map((d) => d.data());
}

export async function updateMember(
  userId: number,
  memberId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  // Jaga name_lower tetap sinkron saat name diubah.
  if (typeof fields.name === "string") {
    fields.name_lower = fields.name.toLowerCase();
  }
  await _membersRef(userId).doc(memberId).update(fields);
}

/** Hapus anggota dan bersihkan semua referensinya dari anggota lain. */
export async function deleteMember(userId: number, memberId: string): Promise<void> {
  await _membersRef(userId).doc(memberId).delete();
  const all = await listMembers(userId);
  for (const m of all) {
    const updates: Record<string, string[]> = {};
    for (const attr of ["parent_ids", "sibling_ids", "spouse_ids", "child_ids"] as const) {
      const ids = m[attr];
      if (ids.includes(memberId)) {
        updates[attr] = ids.filter((id) => id !== memberId);
      }
    }
    if (Object.keys(updates).length > 0) {
      await updateMember(userId, m.id, updates);
    }
  }
}

// ── Relationship helpers ─────────────────────────────────────────────────────

export async function linkParentChild(
  userId: number,
  parentId: string,
  childId: string,
): Promise<void> {
  const [parent, child] = await Promise.all([
    getMember(userId, parentId),
    getMember(userId, childId),
  ]);
  if (!parent || !child) return;
  if (!parent.child_ids.includes(childId)) {
    await updateMember(userId, parentId, {
      child_ids: [...parent.child_ids, childId],
    });
  }
  if (!child.parent_ids.includes(parentId)) {
    await updateMember(userId, childId, {
      parent_ids: [...child.parent_ids, parentId],
    });
  }
}

export async function linkSpouses(
  userId: number,
  memberAId: string,
  memberBId: string,
): Promise<void> {
  const [a, b] = await Promise.all([
    getMember(userId, memberAId),
    getMember(userId, memberBId),
  ]);
  if (!a || !b) return;
  if (!a.spouse_ids.includes(memberBId)) {
    await updateMember(userId, memberAId, {
      spouse_ids: [...a.spouse_ids, memberBId],
    });
  }
  if (!b.spouse_ids.includes(memberAId)) {
    await updateMember(userId, memberBId, {
      spouse_ids: [...b.spouse_ids, memberAId],
    });
  }
}

/**
 * Putuskan relasi orang tua–anak.
 *
 * Relasi dihapus dari kedua arah sehingga hasilnya sama walau urutan
 * `memberAId`/`memberBId` tertukar (mis. A=anak, B=orang tua).
 */
export async function unlinkParentChild(
  userId: number,
  memberAId: string,
  memberBId: string,
): Promise<void> {
  const [a, b] = await Promise.all([
    getMember(userId, memberAId),
    getMember(userId, memberBId),
  ]);
  if (a) {
    const updates: Record<string, string[]> = {};
    if (a.child_ids.includes(memberBId)) {
      updates.child_ids = a.child_ids.filter((id) => id !== memberBId);
    }
    if (a.parent_ids.includes(memberBId)) {
      updates.parent_ids = a.parent_ids.filter((id) => id !== memberBId);
    }
    if (Object.keys(updates).length > 0) {
      await updateMember(userId, memberAId, updates);
    }
  }
  if (b) {
    const updates: Record<string, string[]> = {};
    if (b.child_ids.includes(memberAId)) {
      updates.child_ids = b.child_ids.filter((id) => id !== memberAId);
    }
    if (b.parent_ids.includes(memberAId)) {
      updates.parent_ids = b.parent_ids.filter((id) => id !== memberAId);
    }
    if (Object.keys(updates).length > 0) {
      await updateMember(userId, memberBId, updates);
    }
  }
}

export async function unlinkSpouses(
  userId: number,
  memberAId: string,
  memberBId: string,
): Promise<void> {
  const [a, b] = await Promise.all([
    getMember(userId, memberAId),
    getMember(userId, memberBId),
  ]);
  if (a && a.spouse_ids.includes(memberBId)) {
    await updateMember(userId, memberAId, {
      spouse_ids: a.spouse_ids.filter((id) => id !== memberBId),
    });
  }
  if (b && b.spouse_ids.includes(memberAId)) {
    await updateMember(userId, memberBId, {
      spouse_ids: b.spouse_ids.filter((id) => id !== memberAId),
    });
  }
}

export async function linkSiblings(
  userId: number,
  memberAId: string,
  memberBId: string,
): Promise<void> {
  const [a, b] = await Promise.all([
    getMember(userId, memberAId),
    getMember(userId, memberBId),
  ]);
  if (!a || !b) return;
  if (!a.sibling_ids.includes(memberBId)) {
    await updateMember(userId, memberAId, {
      sibling_ids: [...a.sibling_ids, memberBId],
    });
  }
  if (!b.sibling_ids.includes(memberAId)) {
    await updateMember(userId, memberBId, {
      sibling_ids: [...b.sibling_ids, memberAId],
    });
  }
}

export async function unlinkSiblings(
  userId: number,
  memberAId: string,
  memberBId: string,
): Promise<void> {
  const [a, b] = await Promise.all([
    getMember(userId, memberAId),
    getMember(userId, memberBId),
  ]);
  if (a && a.sibling_ids.includes(memberBId)) {
    await updateMember(userId, memberAId, {
      sibling_ids: a.sibling_ids.filter((id) => id !== memberBId),
    });
  }
  if (b && b.sibling_ids.includes(memberAId)) {
    await updateMember(userId, memberBId, {
      sibling_ids: b.sibling_ids.filter((id) => id !== memberAId),
    });
  }
}

