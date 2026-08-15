"""Endpoint tests: POST /api/members — hanya user tertaut (atau admin), dan
anggota baru otomatis menjadi anak dari user penambah.

Firestore di-mock via monkeypatch fungsi pada namespace ``main``; sub user diatur
lewat fixture ``set_sub``.
"""
import config
import main
from models.member import Member

TEST_SUB = "google-oauth2|member"


def _member(mid: str, children: list[str] | None = None) -> Member:
    return Member(id=mid, name=mid, gender="male", child_ids=children or [])


def _setup_create(monkeypatch, me, member_id: str):
    """Mock add_member/get_member/get_member_by_sub; return penampung link calls."""
    calls: list[tuple] = []
    created_holder: dict = {}

    def _fake_add(user_id, member):
        member.id = member_id
        created_holder["m"] = member
        return member

    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: me)
    monkeypatch.setattr(main, "add_member", _fake_add)
    # get_member dipanggil ulang endpoint setelah auto-link → kembalikan member yang sama.
    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: created_holder.get("m") or _member(mid),
    )
    monkeypatch.setattr(
        main, "link_parent_child",
        lambda user_id, parent_id, child_id: calls.append((parent_id, child_id)),
    )
    return calls


def test_user_belum_tertaut_ditolak_403(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    monkeypatch.setattr(config, "ADMIN_SUBS", set())
    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: None)

    resp = client.post("/api/members?user_id=0", json={"name": "Anak Baru"})
    assert resp.status_code == 403
    assert "tertaut" in resp.json()["detail"]


def test_user_tertaut_anggota_baru_otomatis_jadi_anaknya(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    monkeypatch.setattr(config, "ADMIN_SUBS", set())
    me = _member("aku")
    calls = _setup_create(monkeypatch, me, "member-1")

    resp = client.post("/api/members?user_id=0", json={"name": "Anak Baru"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == "member-1"
    assert resp.json()["name"] == "Anak Baru"
    # Auto-parent: anggota baru terhubung sebagai anak dari "aku".
    assert calls == [("aku", "member-1")]


def test_admin_bypass_menambah_tanpa_orang_tua_saat_belum_tertaut(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    monkeypatch.setattr(config, "ADMIN_SUBS", {TEST_SUB})
    calls = _setup_create(monkeypatch, None, "member-2")

    resp = client.post("/api/members?user_id=0", json={"name": "Anggota Awal"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == "member-2"
    # Admin belum tertaut → tidak ada auto-parent.
    assert calls == []


def test_admin_yang_tertaut_anggota_barunya_tetap_jadi_anaknya(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    monkeypatch.setattr(config, "ADMIN_SUBS", {TEST_SUB})
    me = _member("kakek")
    calls = _setup_create(monkeypatch, me, "member-3")

    resp = client.post("/api/members?user_id=0", json={"name": "Cucu"})
    assert resp.status_code == 200, resp.text
    assert calls == [("kakek", "member-3")]
