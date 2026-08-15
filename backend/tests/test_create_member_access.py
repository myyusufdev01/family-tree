"""Endpoint tests: POST /api/members — hanya user yang sudah tertaut (atau admin).

Firestore di-mock via monkeypatch fungsi pada namespace ``main``; sub user diatur
lewat fixture ``set_sub``.
"""
import config
import main
from models.member import Member

TEST_SUB = "google-oauth2|member"


def _member(mid: str) -> Member:
    return Member(id=mid, name=mid, gender="male")


def test_user_belum_tertaut_ditolak_403(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    monkeypatch.setattr(config, "ADMIN_SUBS", set())
    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: None)

    resp = client.post("/api/members?user_id=0", json={"name": "Anak Baru"})
    assert resp.status_code == 403
    assert "tertaut" in resp.json()["detail"]


def test_user_tertaut_boleh_menambah(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    monkeypatch.setattr(config, "ADMIN_SUBS", set())
    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: _member("aku"))

    def _fake_add(user_id, member):
        member.id = "member-1"
        return member

    monkeypatch.setattr(main, "add_member", _fake_add)

    resp = client.post("/api/members?user_id=0", json={"name": "Anak Baru"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == "member-1"
    assert resp.json()["name"] == "Anak Baru"


def test_admin_bypass_boleh_menambah_sebelum_tertaut(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    monkeypatch.setattr(config, "ADMIN_SUBS", {TEST_SUB})
    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: None)

    def _fake_add(user_id, member):
        member.id = "member-2"
        return member

    monkeypatch.setattr(main, "add_member", _fake_add)

    resp = client.post("/api/members?user_id=0", json={"name": "Anggota Awal"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == "member-2"
