"""Setup env vars yang dibutuhkan sebelum modul app diimpor (dijalankan pytest lebih dulu)."""
import os

os.environ.setdefault("FIRESTORE_PROJECT_ID", "family-tree-test")
os.environ.setdefault("AUTH0_DOMAIN", "test.auth0.com")
os.environ.setdefault("ADMIN_SUBS", "")

import pytest  # noqa: E402
import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client():
    """TestClient aplikasi; override dependensi auth dibersihkan setelah test."""
    yield TestClient(main.app)
    main.app.dependency_overrides.pop(main.get_user_sub, None)


@pytest.fixture
def set_sub():
    """Set sub (Auth0 User ID) untuk request berikutnya; dibersihkan setelah test."""
    def _set(sub: str):
        main.app.dependency_overrides[main.get_user_sub] = lambda: sub
        return sub

    yield _set
    main.app.dependency_overrides.pop(main.get_user_sub, None)

