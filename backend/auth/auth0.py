"""Verifikasi JWT Access Token Auth0 untuk melindungi API backend.

Alur (pola Auth0 "Validate Access Tokens"):
  1. Baca header `Authorization: Bearer <token>`.
  2. Ambil kunci publik RSA dari JWKS endpoint tenant Auth0 (dengan cache).
  3. Verifikasi signature RS256, issuer, dan audience token.
"""
import time

import jwt
import requests
from fastapi import Depends, Header, HTTPException

from config import AUTH0_AUDIENCE, AUTH0_DOMAIN, AUTH0_ISSUER

JWKS_URL = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
JWKS_CACHE_TTL_SECONDS = 3600

_jwks: dict | None = None
_jwks_fetched_at: float = 0.0


def _get_jwks() -> dict:
    global _jwks, _jwks_fetched_at
    if _jwks is None or time.time() - _jwks_fetched_at > JWKS_CACHE_TTL_SECONDS:
        try:
            response = requests.get(JWKS_URL, timeout=10)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise HTTPException(
                status_code=503,
                detail="Gagal mengambil kunci verifikasi Auth0",
            ) from exc
        _jwks = response.json()
        _jwks_fetched_at = time.time()
    return _jwks


def verify_access_token(token: str) -> dict:
    """Verifikasi JWT (RS256) dan kembalikan payload-nya (klaim ``sub``, dll)."""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

    rsa_key = next(
        (
            key
            for key in _get_jwks().get("keys", [])
            if key.get("kid") == unverified_header.get("kid")
        ),
        None,
    )
    if rsa_key is None:
        raise HTTPException(
            status_code=401,
            detail="Signing key tidak ditemukan untuk token ini",
        )

    try:
        return jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=AUTH0_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency — payload JWT dari user yang sudah login.

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
