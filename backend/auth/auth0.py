"""Verifikasi token Auth0 untuk melindungi API backend.

Aplikasi SPA tidak memakai audience/API Auth0, sehingga access token yang
diterbitkan Auth0 berbentuk *opaque* (bukan JWT) dan tidak bisa diverifikasi
lokal. Karena itu token diverifikasi dengan memanggil endpoint ``/userinfo``
Auth0 (pola standar Auth0 untuk SPA tanpa audience):

  1. Baca header `Authorization: Bearer <token>`.
  2. Panggil GET https://<domain>/userinfo dengan token tersebut.
  3. Respons 200 = token valid → profil user (klaim `sub`, `email`, dst.).
     Respons 401 = token tidak valid / kedaluwarsa.

Hasil verifikasi di-cache per token (5 menit) agar tidak memanggil Auth0
berulang-ulang.
"""
import time

import requests
from fastapi import Depends, Header, HTTPException

from config import AUTH0_DOMAIN

USERINFO_URL = f"https://{AUTH0_DOMAIN}/userinfo"
USERINFO_CACHE_TTL_SECONDS = 300  # 5 menit
USERINFO_CACHE_MAX_ENTRIES = 200

_cache: dict[str, tuple[float, dict]] = {}


def _verify(token: str) -> dict:
    """Panggil /userinfo Auth0 dan kembalikan profil user."""
    try:
        response = requests.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail="Gagal menghubungi Auth0 untuk verifikasi token",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")
    return response.json()


def verify_access_token(token: str) -> dict:
    """Verifikasi token via /userinfo Auth0; hasil di-cache per token."""
    now = time.time()
    cached = _cache.get(token)
    if cached and now - cached[0] < USERINFO_CACHE_TTL_SECONDS:
        return cached[1]

    profile = _verify(token)
    if len(_cache) >= USERINFO_CACHE_MAX_ENTRIES:
        _cache.clear()
    _cache[token] = (now, profile)
    return profile


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency — profil user Auth0 yang sudah login.

    Dipasang di semua endpoint yang dilindungi lewat ``Depends(get_current_user)``.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Autentikasi diperlukan (Authorization: Bearer <token>)",
        )
    token = authorization.split(" ", 1)[1].strip()
    return verify_access_token(token)


def get_user_sub(user: dict = Depends(get_current_user)) -> str:
    """FastAPI dependency — Auth0 user ID (``sub``) milik pemanggil."""
    return user["sub"]

