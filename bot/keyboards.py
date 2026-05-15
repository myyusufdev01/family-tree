from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup


MAIN_MENU = ReplyKeyboardMarkup(
    [
        ["➕ Tambah Anggota", "🌳 Lihat Pohon"],
        ["✏️ Edit Anggota", "🔗 Hubungkan Anggota"],
        ["🔍 Cari Anggota", "📋 Daftar Anggota"],
    ],
    resize_keyboard=True,
)

GENDER_KEYBOARD = ReplyKeyboardMarkup(
    [["👨 Laki-laki", "👩 Perempuan"]],
    resize_keyboard=True,
    one_time_keyboard=True,
)

SKIP_KEYBOARD = ReplyKeyboardMarkup(
    [["⏭ Lewati"]],
    resize_keyboard=True,
    one_time_keyboard=True,
)

CANCEL_KEYBOARD = ReplyKeyboardMarkup(
    [["❌ Batal"]],
    resize_keyboard=True,
    one_time_keyboard=True,
)

LINK_TYPE_KEYBOARD = ReplyKeyboardMarkup(
    [["👨‍👩‍👧 Orang tua - Anak", "💑 Pasangan"]],
    resize_keyboard=True,
    one_time_keyboard=True,
)

ADD_REL_TYPE_KEYBOARD = ReplyKeyboardMarkup(
    [
        ["👨‍👧 Anak dari...", "👨‍👩‍👧 Orang tua dari..."],
        ["💑 Pasangan dari...", "⏭ Lewati"],
    ],
    resize_keyboard=True,
    one_time_keyboard=True,
)

EDIT_FIELDS_KEYBOARD = ReplyKeyboardMarkup(
    [
        ["Nama", "Jenis Kelamin"],
        ["Tanggal Lahir", "Tanggal Wafat"],
        ["Telepon", "Catatan"],
        ["🔗 Relasi", "❌ Batal"],
    ],
    resize_keyboard=True,
    one_time_keyboard=True,
)

EDIT_REL_ACTION_KEYBOARD = ReplyKeyboardMarkup(
    [["➕ Tambah Relasi", "🗑 Hapus Relasi"], ["❌ Batal"]],
    resize_keyboard=True,
    one_time_keyboard=True,
)

ADD_REL_TYPE_KEYBOARD_EDIT = ReplyKeyboardMarkup(
    [
        ["👨‍👧 Anak dari...", "👨‍👩‍👧 Orang tua dari..."],
        ["💑 Pasangan dari...", "❌ Batal"],
    ],
    resize_keyboard=True,
    one_time_keyboard=True,
)


def member_list_keyboard(members: list, action: str) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(m.name, callback_data=f"{action}:{m.id}")]
        for m in members
    ]
    return InlineKeyboardMarkup(buttons)
