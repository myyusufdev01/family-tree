import os
import logging
from collections import deque
from datetime import date
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from db.firestore import (
    add_member, get_member, update_member, delete_member,
    list_members, list_members_paginated, count_members, search_members, get_db,
    link_parent_child, link_spouses, link_siblings,
    unlink_parent_child, unlink_spouses, unlink_siblings,
    approve_user, revoke_user, list_approved_users,
    get_member_by_sub, get_descendant_ids, link_user_to_member,
)
from models.member import Member
from utils.tree_renderer import render_family_of
from auth.auth0 import get_current_user, get_user_sub

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Family Tree API", version="1.0.0")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,https://localhost:3000"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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

class LinkUserRequest(BaseModel):
    sub: str  # Auth0 User ID (contoh: "google-oauth2|123456")

# ── Member endpoints ─────────────────────────────────────────────────────────

@app.get("/api/members")
def list_members_endpoint(
    _auth: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: int = Query(0),
):
    members, next_cursor = list_members_paginated(
        user_id,
        per_page=per_page,
        offset=(page - 1) * per_page,
    )
    total = count_members(user_id)
    total_pages = (total + per_page - 1) // per_page if total else 0
    return {
        "members": [m.to_dict() for m in members],
        "page": page,
        "per_page": per_page,
        "has_more": next_cursor is not None,
        "total": total,
        "total_pages": total_pages,
    }


@app.get("/api/members/search")
def search_members_endpoint(
    _auth: dict = Depends(get_current_user),
    q: str = Query(..., min_length=1),
    user_id: int = Query(0),
):
    results = search_members(user_id, q)
    return {"results": [m.to_dict() for m in results]}


@app.get("/api/me")
def get_me(
    user_sub: str = Depends(get_user_sub),
    user_id: int = Query(0),
):
    """Identitas user yang sedang login di dalam silsilah keluarga.

    Mengembalikan anggota yang tertaut ke akun Auth0 user (``member``), daftar
    keturunannya (``descendants``), dan apakah user adalah admin (``is_admin``).
    Dipakai frontend untuk menentukan anggota mana yang boleh dijadikan user.
    """
    from config import ADMIN_SUBS
    member = get_member_by_sub(user_id, user_sub)
    if member is None:
        return {
            "member": None,
            "descendant_ids": [],
            "descendants": [],
            "is_admin": user_sub in ADMIN_SUBS,
        }
    descendant_ids = get_descendant_ids(user_id, member.id)
    descendants = [m for m in list_members(user_id) if m.id in descendant_ids]
    descendants.sort(key=lambda m: m.name.lower())
    return {
        "member": member.to_dict(),
        "descendant_ids": sorted(descendant_ids),
        "descendants": [m.to_dict() for m in descendants],
        "is_admin": user_sub in ADMIN_SUBS,
    }


@app.post("/api/members")
def create_member(
    body: MemberCreate,
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
):
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
def get_member_endpoint(
    member_id: str,
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
):
    member = get_member(user_id, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member.to_dict()


@app.put("/api/members/{member_id}")
def update_member_endpoint(
    member_id: str,
    body: MemberUpdate,
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
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
def delete_member_endpoint(
    member_id: str,
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
):
    existing = get_member(user_id, member_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    delete_member(user_id, member_id)
    return {"status": "deleted"}


@app.post("/api/members/{member_id}/link-user")
def link_user_endpoint(
    member_id: str,
    body: LinkUserRequest,
    user_sub: str = Depends(get_user_sub),
    user_id: int = Query(0),
):
    """Tautkan akun Auth0 (``sub``) ke seorang anggota silsilah.

    Aturan akses (jawaban: user hanya boleh menambah *user lain* yang merupakan
    anak/cucu/keturunannya):
    - Admin (``ADMIN_SUBS``) boleh menautkan siapa saja.
    - User lain hanya boleh menautkan akun ke anggota yang merupakan keturunan
      (anak, cucu, cicit, dst.) dari anggota yang diwakili akunnya sendiri.
      Kalau bukan keturunan → HTTP 403.
    """
    from config import ADMIN_SUBS

    sub = body.sub.strip()
    if not sub:
        raise HTTPException(status_code=400, detail="sub (Auth0 User ID) wajib diisi")

    target = get_member(user_id, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if user_sub not in ADMIN_SUBS:
        me = get_member_by_sub(user_id, user_sub)
        if me is None:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Akun Anda belum tertaut ke anggota silsilah. "
                    "Minta admin atau keluarga untuk menautkan akun Anda terlebih dahulu."
                ),
            )
        if member_id not in get_descendant_ids(user_id, me.id):
            raise HTTPException(
                status_code=403,
                detail="Hanya boleh menambah user untuk anak/cucu/keturunan sendiri.",
            )
        if target.auth0_sub:
            raise HTTPException(
                status_code=409,
                detail="Anggota ini sudah tertaut ke akun lain. Hubungi admin jika ingin mengganti.",
            )

    link_user_to_member(user_id, member_id, sub)
    updated = get_member(user_id, member_id)
    return updated.to_dict() if updated else target.to_dict()


# ── Relation endpoints ───────────────────────────────────────────────────────

@app.post("/api/members/link")
def link_members(
    body: LinkRequest,
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
):
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
def unlink_members(
    body: LinkRequest,
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
):
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

# Batas pohon keluarga agar tetap ringan walau total anggota banyak (mis. 1000+).
MAX_TREE_NODES = 80
MAX_DEPTH_UP = 3
MAX_DEPTH_DOWN = 3


@app.get("/api/members/{member_id}/tree")
def get_tree(
    member_id: str,
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
    max_nodes: int = Query(MAX_TREE_NODES, ge=10, le=200),
    depth_up: int = Query(MAX_DEPTH_UP, ge=0, le=5),
    depth_down: int = Query(MAX_DEPTH_DOWN, ge=0, le=5),
):
    """Pohon keluarga terfokus pada satu anggota.

    Traversal BFS mengikuti generasi relatif terhadap anggota fokus
    (root=0, orang tua=-1, kakek/nenek=-2, anak=+1, cucu=+2, dst.) dan
    dibatasi oleh `max_nodes` + `depth_up`/`depth_down` supaya tetap
    ringan walau total anggota mencapai ribuan.
    """
    member = get_member(user_id, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    by_id = {member.id: member}
    generations = {member.id: 0}
    truncated = False
    queue = deque([member.id])

    def try_add(rid: str, gen: int) -> None:
        nonlocal truncated
        if rid in by_id:
            return
        if len(by_id) >= max_nodes:
            truncated = True
            return
        rel = get_member(user_id, rid)
        if rel is None:
            return
        by_id[rid] = rel
        generations[rid] = gen
        queue.append(rid)

    while queue:
        if len(by_id) >= max_nodes:
            truncated = True
            break
        mid = queue.popleft()
        m = by_id[mid]
        g = generations[mid]

        rel_spec = [("sibling_ids", 0), ("spouse_ids", 0)]
        if g - 1 >= -depth_up:
            rel_spec.append(("parent_ids", -1))
        if g + 1 <= depth_down:
            rel_spec.append(("child_ids", 1))

        for attr, delta in rel_spec:
            for rid in getattr(m, attr):
                try_add(rid, g + delta)
                if truncated:
                    break
            if truncated:
                break

    return {
        "member": member.to_dict(),
        "family": {mid: m.to_dict() for mid, m in by_id.items()},
        "generations": {str(mid): g for mid, g in generations.items()},
        "root_id": member.id,
        "truncated": truncated,
        "total_nodes": len(by_id),
    }
# ── Dashboard stats ───────────────────────────────────────────────────────────

def _parse_iso_date(value: Optional[str]):
    """Parse tanggal ISO (YYYY-MM-DD) menjadi datetime.date. None jika tidak valid."""
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _age_on(birth: date, ref: date) -> int:
    return ref.year - birth.year - ((ref.month, ref.day) < (birth.month, birth.day))


@app.get("/api/dashboard/stats")
def dashboard_stats(
    _auth: dict = Depends(get_current_user),
    user_id: int = Query(0),
):
    """Statistik ringkas untuk dashboard, dihitung dari seluruh anggota milik user."""
    members = list_members(user_id)
    today = date.today()

    total = len(members)
    male_count = sum(1 for m in members if m.gender == "male")
    female_count = sum(1 for m in members if m.gender == "female")
    deceased_count = sum(1 for m in members if m.death_date)
    without_birthdate_count = sum(1 for m in members if not m.birth_date)

    # ── Kelompok usia (usia saat ini; bila wafat, usia saat wafat) ──
    age_groups = [
        {"key": "anak", "label": "Anak-anak (0–11)", "count": 0},
        {"key": "remaja", "label": "Remaja (12–17)", "count": 0},
        {"key": "dewasa", "label": "Dewasa (18–59)", "count": 0},
        {"key": "lansia", "label": "Lansia (60+)", "count": 0},
        {"key": "unknown", "label": "Usia tidak diketahui", "count": 0},
    ]
    group_idx = {g["key"]: i for i, g in enumerate(age_groups)}
    ages: list[int] = []

    for m in members:
        birth = _parse_iso_date(m.birth_date)
        if not birth:
            age_groups[group_idx["unknown"]]["count"] += 1
            continue
        death = _parse_iso_date(m.death_date)
        ref = death or today
        age = _age_on(birth, ref)
        ages.append(age)
        if age < 12:
            key = "anak"
        elif age < 18:
            key = "remaja"
        elif age < 60:
            key = "dewasa"
        else:
            key = "lansia"
        age_groups[group_idx[key]]["count"] += 1

    avg_age = round(sum(ages) / len(ages), 1) if ages else None

    # ── Relasi keluarga ──
    spouse_pairs = {frozenset((m.id, s)) for m in members for s in m.spouse_ids}
    parent_child_pairs = {frozenset((p, m.id)) for m in members for p in m.parent_ids}
    connected_count = sum(
        1 for m in members
        if m.parent_ids or m.child_ids or m.spouse_ids or m.sibling_ids
    )

    # ── Ulang tahun dalam 14 hari ke depan ──
    upcoming_birthdays = []
    for m in members:
        birth = _parse_iso_date(m.birth_date)
        if not birth or _parse_iso_date(m.death_date):
            continue
        try:
            next_birth = birth.replace(year=today.year)
        except ValueError:
            continue  # mis. 29 Februari di tahun non-kabisat
        if next_birth < today:
            try:
                next_birth = birth.replace(year=today.year + 1)
            except ValueError:
                continue
        days_until = (next_birth - today).days
        if 0 <= days_until <= 14:
            upcoming_birthdays.append(
                {
                    "id": m.id,
                    "name": m.name,
                    "gender": m.gender,
                    "birth_date": m.birth_date,
                    "days_until": days_until,
                }
            )
    upcoming_birthdays.sort(key=lambda x: x["days_until"])

    # ── Generasi keluarga (rantai orang tua → anak; 1 = generasi tertua) ──
    by_id = {m.id: m for m in members}
    generation_of: dict[str, int] = {}
    pending = deque()
    for m in members:
        if not m.parent_ids or all(p not in by_id for p in m.parent_ids):
            generation_of[m.id] = 1
            pending.append(m.id)
    while pending:
        mid = pending.popleft()
        for cid in by_id[mid].child_ids:
            if cid in by_id and cid not in generation_of:
                generation_of[cid] = generation_of[mid] + 1
                pending.append(cid)
    for m in members:  # relasi yang terputus dianggap generasi 1
        if m.id not in generation_of:
            generation_of[m.id] = 1
    level_counts: dict[int, int] = {}
    for g in generation_of.values():
        level_counts[g] = level_counts.get(g, 0) + 1
    generation_levels = [
        {"level": lvl, "label": f"Generasi {lvl}", "count": level_counts[lvl]}
        for lvl in sorted(level_counts)
    ]
    generation_depth = max(level_counts) if level_counts else 0

    # ── Ulang tahun bulan ini ──
    birthdays_this_month = []
    for m in members:
        birth = _parse_iso_date(m.birth_date)
        if not birth or _parse_iso_date(m.death_date):
            continue
        if birth.month == today.month:
            try:
                this_year_birth = birth.replace(year=today.year)
            except ValueError:
                continue
            birthdays_this_month.append(
                {
                    "id": m.id,
                    "name": m.name,
                    "gender": m.gender,
                    "birth_date": m.birth_date,
                    "days_until": (this_year_birth - today).days,
                }
            )
    birthdays_this_month.sort(key=lambda x: (x["days_until"] < 0, x["days_until"]))

    # ── Anggota hidup termuda & tertua ──
    living = [
        m for m in members
        if m.birth_date and not _parse_iso_date(m.death_date)
    ]
    oldest_living = None
    youngest_member = None
    if living:
        by_birth = sorted(living, key=lambda m: m.birth_date or "")
        oldest_living = {
            "id": by_birth[0].id,
            "name": by_birth[0].name,
            "gender": by_birth[0].gender,
            "birth_date": by_birth[0].birth_date,
            "age": _age_on(_parse_iso_date(by_birth[0].birth_date), today),
        }
        youngest_member = {
            "id": by_birth[-1].id,
            "name": by_birth[-1].name,
            "gender": by_birth[-1].gender,
            "birth_date": by_birth[-1].birth_date,
            "age": _age_on(_parse_iso_date(by_birth[-1].birth_date), today),
        }

    # ── Peran & kelengkapan data ──
    parents_count = sum(1 for m in members if m.child_ids)
    single_parent_count = sum(1 for m in members if m.child_ids and not m.spouse_ids)
    without_phone_count = sum(1 for m in members if not m.phone)

    # ── Anggota terbaru (berdasarkan created_at) ──
    recent_members = sorted(
        members, key=lambda m: m.created_at or "", reverse=True
    )[:5]

    return {
        "total_members": total,
        "male_count": male_count,
        "female_count": female_count,
        "deceased_count": deceased_count,
        "avg_age": avg_age,
        "age_groups": age_groups,
        "couples_count": len(spouse_pairs),
        "parent_child_count": len(parent_child_pairs),
        "connected_count": connected_count,
        "isolated_count": total - connected_count,
        "without_birthdate_count": without_birthdate_count,
        "upcoming_birthdays": upcoming_birthdays[:6],
        "birthdays_this_month": birthdays_this_month[:6],
        "generation_depth": generation_depth,
        "generation_levels": generation_levels,
        "oldest_living": oldest_living,
        "youngest_member": youngest_member,
        "parents_count": parents_count,
        "single_parent_count": single_parent_count,
        "without_phone_count": without_phone_count,
        "recent_members": [
            {
                "id": m.id,
                "name": m.name,
                "gender": m.gender,
                "birth_date": m.birth_date,
                "created_at": m.created_at,
            }
            for m in recent_members
        ],
    }


# ── Admin endpoints ──────────────────────────────────────────────────────────

@app.get("/api/admin/users")
def admin_list_users(
    user_sub: str = Depends(get_user_sub),
    user_id: int = Query(0),
):
    from config import ADMIN_SUBS
    if user_sub not in ADMIN_SUBS:
        raise HTTPException(status_code=403, detail="Not authorized")
    users = list_approved_users()
    return {"users": users, "admin_subs": list(ADMIN_SUBS)}


@app.post("/api/admin/users")
def admin_approve_user(
    body: ApproveUserRequest,
    user_sub: str = Depends(get_user_sub),
    user_id: int = Query(0),
):
    from config import ADMIN_SUBS
    if user_sub not in ADMIN_SUBS:
        raise HTTPException(status_code=403, detail="Not authorized")
    approve_user(body.user_id, name=body.name, added_by=user_id)
    return {"status": "approved", "user_id": body.user_id}


@app.delete("/api/admin/users/{target_id}")
def admin_revoke_user(
    target_id: int,
    user_sub: str = Depends(get_user_sub),
    user_id: int = Query(0),
):
    from config import ADMIN_SUBS
    if user_sub not in ADMIN_SUBS:
        raise HTTPException(status_code=403, detail="Not authorized")
    revoke_user(target_id)
    return {"status": "revoked", "user_id": target_id}


@app.get("/api/admin/stats")
def admin_stats(
    user_sub: str = Depends(get_user_sub),
    user_id: int = Query(0),
):
    from config import ADMIN_SUBS
    if user_sub not in ADMIN_SUBS:
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