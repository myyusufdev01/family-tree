"""Unit test kolektor ID keturunan — murni, tanpa koneksi Firestore."""
from models.member import Member
from db.firestore import collect_descendant_ids


def _m(mid: str, children: list[str] | None = None) -> Member:
    return Member(id=mid, name=mid, gender="male", child_ids=children or [])


def test_anak_dan_cucu_langsung():
    by_id = {
        "kakek": _m("kakek", children=["ayah"]),
        "ayah": _m("ayah", children=["aku"]),
        "aku": _m("aku"),
    }
    assert collect_descendant_ids(by_id, "kakek") == {"ayah", "aku"}


def test_cucu_dan_cicit():
    by_id = {
        "a": _m("a", children=["b", "c"]),
        "b": _m("b", children=["d"]),
        "c": _m("c"),
        "d": _m("d", children=["e"]),
        "e": _m("e"),
    }
    assert collect_descendant_ids(by_id, "a") == {"b", "c", "d", "e"}
    assert collect_descendant_ids(by_id, "b") == {"d", "e"}


def test_bukan_keturunan_tidak_ikut():
    by_id = {
        "a": _m("a", children=["b"]),
        "b": _m("b"),
        "x": _m("x", children=["y"]),
        "y": _m("y"),
    }
    ids = collect_descendant_ids(by_id, "a")
    assert "x" not in ids
    assert "y" not in ids


def test_root_tidak_ada_di_map():
    assert collect_descendant_ids({"a": _m("a")}, "nonexistent") == set()


def test_root_sendiri_tidak_termasuk():
    by_id = {"a": _m("a", children=["b"]), "b": _m("b")}
    assert "a" not in collect_descendant_ids(by_id, "a")


def test_anti_loop_relasi_melingkar():
    # Relasi melingkar tidak boleh menyebabkan infinite loop.
    by_id = {
        "a": _m("a", children=["b"]),
        "b": _m("b", children=["a"]),
    }
    assert collect_descendant_ids(by_id, "a") == {"b"}
