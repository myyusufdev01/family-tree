import os
import uuid
from google.cloud import firestore
from models.member import Member


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
    _members_ref(user_id).document(member_id).update(fields)


def delete_member(user_id: int, member_id: str):
    _members_ref(user_id).document(member_id).delete()


def list_members(user_id: int) -> list[Member]:
    docs = _members_ref(user_id).stream()
    return [Member.from_dict(d.to_dict()) for d in docs]


def search_members(user_id: int, query: str) -> list[Member]:
    query_lower = query.lower()
    return [m for m in list_members(user_id) if query_lower in m.name.lower()]


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
