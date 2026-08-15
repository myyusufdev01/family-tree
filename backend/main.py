import os
import logging
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from db.firestore import (
    add_member, get_member, update_member, delete_member,
    list_members_paginated, search_members, get_db,
    link_parent_child, link_spouses, link_siblings,
    unlink_parent_child, unlink_spouses, unlink_siblings,
    approve_user, revoke_user, list_approved_users,
)
from models.member import Member
from utils.tree_renderer import render_family_of

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Family Tree API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ──────────────────────────────────────────────────────────────────

class MemberCreate(BaseModel):
    name: str
    gender: str = "male"
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class LinkRequest(BaseModel):
    type: str  # "parent_child" | "spouse"
    member_a_id: str
    member_b_id: str

class ApproveUserRequest(BaseModel):
    user_id: int
    name: str = ""

# ── Member endpoints ─────────────────────────────────────────────────────────

@app.get("/api/members")
def list_members_endpoint(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: int = Query(0),
):
    members, next_cursor = list_members_paginated(
        user_id,
        start_after_name=None if page == 1 else None,
    )
    return {
        "members": [m.to_dict() for m in members],
        "page": page,
        "per_page": per_page,
        "has_more": next_cursor is not None,
    }


@app.get("/api/members/search")
def search_members_endpoint(
    q: str = Query(..., min_length=1),
    user_id: int = Query(0),
):
    results = search_members(user_id, q)
    return {"results": [m.to_dict() for m in results]}


@app.post("/api/members")
def create_member(body: MemberCreate, user_id: int = Query(0)):
    member = Member(
        id="",
        name=body.name,
        gender=body.gender,
        birth_date=body.birth_date,
        death_date=body.death_date,
        phone=body.phone,
        notes=body.notes,
    )
    created = add_member(user_id, member)
    return created.to_dict()


@app.get("/api/members/{member_id}")
def get_member_endpoint(member_id: str, user_id: int = Query(0)):
    member = get_member(user_id, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member.to_dict()


@app.put("/api/members/{member_id}")
def update_member_endpoint(
    member_id: str, body: MemberUpdate, user_id: int = Query(0)
):
    existing = get_member(user_id, member_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        update_member(user_id, member_id, fields)
    updated = get_member(user_id, member_id)
    return updated.to_dict() if updated else existing.to_dict()


@app.delete("/api/members/{member_id}")
def delete_member_endpoint(member_id: str, user_id: int = Query(0)):
    existing = get_member(user_id, member_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    delete_member(user_id, member_id)
    return {"status": "deleted"}


# ── Relation endpoints ───────────────────────────────────────────────────────

@app.post("/api/members/link")
def link_members(body: LinkRequest, user_id: int = Query(0)):
    if body.type == "parent_child":
        link_parent_child(user_id, body.member_a_id, body.member_b_id)
        return {"status": "linked", "type": "parent_child"}
    elif body.type == "spouse":
        link_spouses(user_id, body.member_a_id, body.member_b_id)
        return {"status": "linked", "type": "spouse"}
    elif body.type == "sibling":
        link_siblings(user_id, body.member_a_id, body.member_b_id)
        return {"status": "linked", "type": "sibling"}
    raise HTTPException(status_code=400, detail="Invalid link type")


@app.post("/api/members/unlink")
def unlink_members(body: LinkRequest, user_id: int = Query(0)):
    if body.type == "parent_child":
        unlink_parent_child(user_id, body.member_a_id, body.member_b_id)
        return {"status": "unlinked", "type": "parent_child"}
    elif body.type == "spouse":
        unlink_spouses(user_id, body.member_a_id, body.member_b_id)
        return {"status": "unlinked", "type": "spouse"}
    elif body.type == "sibling":
        unlink_siblings(user_id, body.member_a_id, body.member_b_id)
        return {"status": "unlinked", "type": "sibling"}
    raise HTTPException(status_code=400, detail="Invalid link type")
# ── Tree endpoint ────────────────────────────────────────────────────────────

@app.get("/api/members/{member_id}/tree")
def get_tree(member_id: str, user_id: int = Query(0)):
    member = get_member(user_id, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    rel_ids = set(member.parent_ids + member.spouse_ids + member.child_ids + member.sibling_ids)
    for pid in member.parent_ids:
        p = get_member(user_id, pid)
        if p:
            rel_ids.update(p.parent_ids)
            rel_ids.update(p.child_ids)
    by_id = {member.id: member}
    for rid in rel_ids:
        m = get_member(user_id, rid)
        if m:
            by_id[rid] = m
    return {
        "member": member.to_dict(),
        "family": {mid: m.to_dict() for mid, m in by_id.items()},
    }
# ── Admin endpoints ──────────────────────────────────────────────────────────

@app.get("/api/admin/users")
def admin_list_users(user_id: int = Query(0)):
    from config import ADMIN_IDS
    users = list_approved_users()
    return {"users": users, "admin_ids": list(ADMIN_IDS)}


@app.post("/api/admin/users")
def admin_approve_user(body: ApproveUserRequest, user_id: int = Query(0)):
    from config import ADMIN_IDS
    if user_id not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")
    approve_user(body.user_id, name=body.name, added_by=user_id)
    return {"status": "approved", "user_id": body.user_id}


@app.delete("/api/admin/users/{target_id}")
def admin_revoke_user(target_id: int, user_id: int = Query(0)):
    from config import ADMIN_IDS
    if user_id not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")
    if target_id in ADMIN_IDS:
        raise HTTPException(status_code=400, detail="Cannot revoke admin")
    revoke_user(target_id)
    return {"status": "revoked", "user_id": target_id}


@app.get("/api/admin/stats")
def admin_stats(user_id: int = Query(0)):
    from config import ADMIN_IDS
    if user_id not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")
    db = get_db()
    trees = list(db.collection("family_trees").stream())
    approved = list_approved_users()
    total_members = sum(
        len(list(doc.reference.collection("members").stream()))
        for doc in trees
    )
    return {
        "total_users": len(approved),
        "total_members": total_members,
        "total_trees": len(trees),
    }


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)