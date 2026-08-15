"""Endpoint tests: POST /api/members/{id}/link-user — validasi "hanya keturunan".

Firestore di-mock via monkeypatch fungsi pada namespace ``main``; dependensi auth
diganti dengan sub tetap lewat ``dependency_overrides``.
"""
import config
import main
from fastapi.testclient import TestClient
from models.member import Member

TEST_SUB = "google-oauth2|ancestor"

main.app.dependency_overrides[main.get_user_sub] = lambda: TEST_SUB
client = TestClient(main.app)


def _member(mid: str, children: list[str] | None = None, auth0_sub: str | None = None) -> Member:
    return Member(
        id=mid,
        name=mid,
        gender="male",
        child_ids=children or [],
        auth0_sub=auth0_sub,
    )


def test_leluhur_boleh_menautkan_keturunan(monkeypatch):
    me = _member("ancestor", children=["anak"])
    target = _member("anak")

    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: me)
    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: target if mid == "anak" else None,
    )
    monkeypatch.setattr(main, "get_descendant_ids", lambda user_id, mid: {"anak"})
    monkeypatch.setattr(main, "link_user_to_member", lambda user_id, mid, sub: setattr(target, "auth0_sub", sub))

    resp = client.post("/api/members/anak/link-user?user_id=0", json={"sub": "google-oauth2|anak"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["auth0_sub"] == "google-oauth2|anak"


def test_bukan_keturunan_ditolak_403(monkeypatch):
    me = _member("ancestor", children=["anak"])
    target = _member("sepupu")

    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: me)
    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: target if mid == "sepupu" else None,
    )
    monkeypatch.setattr(main, "get_descendant_ids", lambda user_id, mid: {"anak"})
    monkeypatch.setattr(main, "link_user_to_member", lambda user_id, mid, sub: None)

    resp = client.post("/api/members/sepupu/link-user?user_id=0", json={"sub": "google-oauth2|sepupu"})
    assert resp.status_code == 403
    assert "keturunan" in resp.json()["detail"]


def test_user_tanpa_tautan_anggota_ditolak_403(monkeypatch):
    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: None)
    monkeypatch.setattr(main, "get_member", lambda user_id, mid: _member("anak"))
    monkeypatch.setattr(main, "get_descendant_ids", lambda user_id, mid: {"anak"})

    resp = client.post("/api/members/anak/link-user?user_id=0", json={"sub": "google-oauth2|anak"})
    assert resp.status_code == 403


def test_anggota_sudah_tertaut_ditolak_409(monkeypatch):
    me = _member("ancestor", children=["anak"])
    target = _member("anak", auth0_sub="google-oauth2|orang_lain")

    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: me)
    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: target if mid == "anak" else None,
    )
    monkeypatch.setattr(main, "get_descendant_ids", lambda user_id, mid: {"anak"})
    monkeypatch.setattr(main, "link_user_to_member", lambda user_id, mid, sub: None)

    resp = client.post("/api/members/anak/link-user?user_id=0", json={"sub": "google-oauth2|anak"})
    assert resp.status_code == 409


def test_admin_boleh_menautkan_siapa_saja(monkeypatch):
    monkeypatch.setattr(config, "ADMIN_SUBS", {TEST_SUB})
    target = _member("sepupu")

    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: None)
    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: target if mid == "sepupu" else None,
    )
    monkeypatch.setattr(main, "get_descendant_ids", lambda user_id, mid: set())
    monkeypatch.setattr(
        main, "link_user_to_member",
        lambda user_id, mid, sub: setattr(target, "auth0_sub", sub),
    )

    resp = client.post("/api/members/sepupu/link-user?user_id=0", json={"sub": "google-oauth2|sepupu"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["auth0_sub"] == "google-oauth2|sepupu"


def test_member_tidak_ditemukan_404(monkeypatch):
    monkeypatch.setattr(main, "get_member_by_sub", lambda user_id, sub: _member("ancestor"))
    monkeypatch.setattr(main, "get_member", lambda user_id, mid: None)

    resp = client.post("/api/members/nonexistent/link-user?user_id=0", json={"sub": "google-oauth2|x"})
    assert resp.status_code == 404


def test_sub_kosong_ditolak_400(monkeypatch):
    resp = client.post("/api/members/anak/link-user?user_id=0", json={"sub": "   "})
    assert resp.status_code == 400
