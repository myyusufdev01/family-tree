import os
import uuid
from google.cloud import firestore
from models.member import Member

PAGE_SIZE = 20
SEARCH_LIMIT = 10

_db = None


def get_db() -> firestore.Client:
    global _db
    if _db is None:
        _db = firestore.Client(project=os.getenv("FIRESTORE_PROJECT_ID"))
    return _db


def _tree_ref(user_id: int):
    return get_db().collection("family_trees").document(str(user_id))


def _members_ref(user_id: int):
    return _tree_ref(user_id).collection("members")


# --- Member CRUD ---

def add_member(user_id: int, member: Member) -> Member:
    if not member.id:
        member.id = str(uuid.uuid4())
    _members_ref(user_id).document(member.id).set(member.to_dict())
    return member


def get_member(user_id: int, member_id: str) -> Member | None:
    doc = _members_ref(user_id).document(member_id).get()
    return Member.from_dict(doc.to_dict()) if doc.exists else None


def update_member(user_id: int, member_id: str, fields: dict):
    # Keep name_lower in sync when name is updated
    if "name" in fields:
        fields["name_lower"] = fields["name"].lower()
    _members_ref(user_id).document(member_id).update(fields)


def delete_member(user_id: int, member_id: str):
    """Hapus anggota dan bersihkan semua referensinya dari anggota lain."""
    _members_ref(user_id).document(member_id).delete()
    # Putuskan relasi: keluarkan member_id dari daftar relasi anggota lain.
    for m in list_members(user_id):
        updates: dict[str, list[str]] = {}
        for attr in ("parent_ids", "sibling_ids", "spouse_ids", "child_ids"):
            ids = getattr(m, attr)
            if member_id in ids:
                updates[attr] = [i for i in ids if i != member_id]
        if updates:
            update_member(user_id, m.id, updates)


def list_members(user_id: int) -> list[Member]:
    """Fetch all members — use only for small trees or relation lookups."""
    docs = _members_ref(user_id).order_by("name_lower").stream()
    return [Member.from_dict(d.to_dict()) for d in docs]


def list_members_paginated(user_id: int, start_after_name: str | None = None) -> tuple[list[Member], str | None]:
    """Return PAGE_SIZE members + next cursor (name_lower value), or None if last page."""
    ref = _members_ref(user_id).order_by("name_lower").limit(PAGE_SIZE + 1)
    if start_after_name:
        ref = ref.start_after({"name_lower": start_after_name})
    docs = list(ref.stream())
    has_more = len(docs) > PAGE_SIZE
    members = [Member.from_dict(d.to_dict()) for d in docs[:PAGE_SIZE]]
    next_cursor = members[-1].name.lower() if has_more else None
    return members, next_cursor


def search_members(user_id: int, query: str) -> list[Member]:
    """Prefix search on name_lower field. Falls back to substring scan for old records."""
    q = query.lower().strip()
    # Firestore prefix range query
    docs = list(
        _members_ref(user_id)
        .order_by("name_lower")
        .where("name_lower", ">=", q)
        .where("name_lower", "<=", q + "")
        .limit(SEARCH_LIMIT)
        .stream()
    )
    results = [Member.from_dict(d.to_dict()) for d in docs]

    # Fallback: substring search for older records that have no name_lower
    if not results:
        fallback = list(
            _members_ref(user_id).limit(200).stream()
        )
        results = [
            Member.from_dict(d.to_dict())
            for d in fallback
            if q in d.to_dict().get("name", "").lower()
        ][:SEARCH_LIMIT]

    return results


def count_members(user_id: int) -> int:
    result = _members_ref(user_id).count().get()
    return result[0][0].value


# --- Approved Users ---

def _approved_ref():
    return get_db().collection("approved_users")


def approve_user(user_id: int, name: str = "", added_by: int = 0):
    from datetime import datetime
    _approved_ref().document(str(user_id)).set({
        "user_id": user_id,
        "name": name,
        "added_by": added_by,
        "approved_at": datetime.utcnow().isoformat(),
    })


def revoke_user(user_id: int):
    _approved_ref().document(str(user_id)).delete()


def is_approved(user_id: int) -> bool:
    from config import ADMIN_IDS
    if user_id in ADMIN_IDS:
        return True
    return _approved_ref().document(str(user_id)).get().exists


def list_approved_users() -> list[dict]:
    return [d.to_dict() for d in _approved_ref().stream()]


# --- Relationship helpers ---

def link_parent_child(user_id: int, parent_id: str, child_id: str):
    parent = get_member(user_id, parent_id)
    child = get_member(user_id, child_id)
    if not parent or not child:
        return
    if child_id not in parent.child_ids:
        parent.child_ids.append(child_id)
        update_member(user_id, parent_id, {"child_ids": parent.child_ids})
    if parent_id not in child.parent_ids:
        child.parent_ids.append(parent_id)
        update_member(user_id, child_id, {"parent_ids": child.parent_ids})


def link_spouses(user_id: int, member_a_id: str, member_b_id: str):
    a = get_member(user_id, member_a_id)
    b = get_member(user_id, member_b_id)
    if not a or not b:
        return
    if member_b_id not in a.spouse_ids:
        a.spouse_ids.append(member_b_id)
        update_member(user_id, member_a_id, {"spouse_ids": a.spouse_ids})
    if member_a_id not in b.spouse_ids:
        b.spouse_ids.append(member_a_id)
        update_member(user_id, member_b_id, {"spouse_ids": b.spouse_ids})


def unlink_parent_child(user_id: int, member_a_id: str, member_b_id: str):
    """Putuskan relasi orang tua–anak.

    Relasi dihapus dari kedua arah sehingga hasilnya sama walau urutan
    ``member_a_id``/``member_b_id`` tertukar (mis. A=anak, B=orang tua).
    """
    a = get_member(user_id, member_a_id)
    b = get_member(user_id, member_b_id)
    if a:
        if member_b_id in a.child_ids:
            a.child_ids.remove(member_b_id)
            update_member(user_id, member_a_id, {"child_ids": a.child_ids})
        if member_b_id in a.parent_ids:
            a.parent_ids.remove(member_b_id)
            update_member(user_id, member_a_id, {"parent_ids": a.parent_ids})
    if b:
        if member_a_id in b.child_ids:
            b.child_ids.remove(member_a_id)
            update_member(user_id, member_b_id, {"child_ids": b.child_ids})
        if member_a_id in b.parent_ids:
            b.parent_ids.remove(member_a_id)
            update_member(user_id, member_b_id, {"parent_ids": b.parent_ids})


def unlink_spouses(user_id: int, member_a_id: str, member_b_id: str):
    a = get_member(user_id, member_a_id)
    b = get_member(user_id, member_b_id)
    if a and member_b_id in a.spouse_ids:
        a.spouse_ids.remove(member_b_id)
        update_member(user_id, member_a_id, {"spouse_ids": a.spouse_ids})
    if b and member_a_id in b.spouse_ids:
        b.spouse_ids.remove(member_a_id)
        update_member(user_id, member_b_id, {"spouse_ids": b.spouse_ids})


def link_siblings(user_id: int, member_a_id: str, member_b_id: str):
    a = get_member(user_id, member_a_id)
    b = get_member(user_id, member_b_id)
    if not a or not b:
        return
    if member_b_id not in a.sibling_ids:
        a.sibling_ids.append(member_b_id)
        update_member(user_id, member_a_id, {"sibling_ids": a.sibling_ids})
    if member_a_id not in b.sibling_ids:
        b.sibling_ids.append(member_a_id)
        update_member(user_id, member_b_id, {"sibling_ids": b.sibling_ids})


def unlink_siblings(user_id: int, member_a_id: str, member_b_id: str):
    a = get_member(user_id, member_a_id)
    b = get_member(user_id, member_b_id)
    if a and member_b_id in a.sibling_ids:
        a.sibling_ids.remove(member_b_id)
        update_member(user_id, member_a_id, {"sibling_ids": a.sibling_ids})
    if b and member_a_id in b.sibling_ids:
        b.sibling_ids.remove(member_a_id)
        update_member(user_id, member_b_id, {"sibling_ids": b.sibling_ids})
