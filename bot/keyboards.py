from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup


MAIN_MENU = ReplyKeyboardMarkup(
    [
        ["➕ Tambah Anggota", "🌳 Lihat Pohon"],
        ["🔍 Cari Anggota", "🔗 Hubungkan Anggota"],
        ["📋 Daftar Anggota"],
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

EDIT_FIELDS_KEYBOARD = ReplyKeyboardMarkup(
    [
        ["Nama", "Jenis Kelamin"],
        ["Tanggal Lahir", "Tanggal Wafat"],
        ["Telepon", "Catatan"],
        ["❌ Batal"],
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
