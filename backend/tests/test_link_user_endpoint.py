"""Endpoint tests: POST /api/members/{id}/link-user — khusus admin.

Firestore di-mock via monkeypatch fungsi pada namespace ``main``; sub user diatur
lewat fixture ``set_sub``.
"""
import config
import main
from models.member import Member

TEST_SUB = "google-oauth2|admin"


def _member(mid: str, auth0_sub: str | None = None) -> Member:
    return Member(id=mid, name=mid, gender="male", auth0_sub=auth0_sub)


def _as_admin(monkeypatch):
    monkeypatch.setattr(config, "ADMIN_SUBS", {TEST_SUB})


def test_non_admin_ditolak_403(client, set_sub):
    # ADMIN_SUBS default kosong → TEST_SUB bukan admin
    set_sub(TEST_SUB)
    resp = client.post("/api/members/anak/link-user?user_id=0", json={"sub": "google-oauth2|anak"})
    assert resp.status_code == 403
    assert "admin" in resp.json()["detail"].lower()


def test_admin_boleh_menautkan_anggota_manapun(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    _as_admin(monkeypatch)
    target = _member("sepupu")  # sengaja bukan keturunan — admin bebas

    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: target if mid == "sepupu" else None,
    )
    monkeypatch.setattr(
        main, "link_user_to_member",
        lambda user_id, mid, sub: setattr(target, "auth0_sub", sub),
    )

    resp = client.post("/api/members/sepupu/link-user?user_id=0", json={"sub": "google-oauth2|sepupu"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["auth0_sub"] == "google-oauth2|sepupu"


def test_admin_bisa_menautkan_dirinya_sendiri_setup_awal(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    _as_admin(monkeypatch)
    target = _member("kakek")

    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: target if mid == "kakek" else None,
    )
    monkeypatch.setattr(
        main, "link_user_to_member",
        lambda user_id, mid, sub: setattr(target, "auth0_sub", sub),
    )

    resp = client.post("/api/members/kakek/link-user?user_id=0", json={"sub": TEST_SUB})
    assert resp.status_code == 200, resp.text
    assert resp.json()["auth0_sub"] == TEST_SUB


def test_admin_boleh_mengganti_tautan_lama(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    _as_admin(monkeypatch)
    target = _member("anak", auth0_sub="google-oauth2|orang_lama")

    monkeypatch.setattr(
        main, "get_member",
        lambda user_id, mid: target if mid == "anak" else None,
    )
    monkeypatch.setattr(
        main, "link_user_to_member",
        lambda user_id, mid, sub: setattr(target, "auth0_sub", sub),
    )

    resp = client.post("/api/members/anak/link-user?user_id=0", json={"sub": "google-oauth2|orang_baru"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["auth0_sub"] == "google-oauth2|orang_baru"


def test_member_tidak_ditemukan_404(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    _as_admin(monkeypatch)
    monkeypatch.setattr(main, "get_member", lambda user_id, mid: None)

    resp = client.post("/api/members/nonexistent/link-user?user_id=0", json={"sub": "google-oauth2|x"})
    assert resp.status_code == 404


def test_sub_kosong_ditolak_400(client, set_sub, monkeypatch):
    set_sub(TEST_SUB)
    _as_admin(monkeypatch)
    resp = client.post("/api/members/anak/link-user?user_id=0", json={"sub": "   "})
    assert resp.status_code == 400
