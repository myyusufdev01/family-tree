from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from models.member import Member
from db.firestore import add_member, list_members, update_member, delete_member, get_member
from bot.keyboards import (
    MAIN_MENU, GENDER_KEYBOARD, SKIP_KEYBOARD, CANCEL_KEYBOARD,
    EDIT_FIELDS_KEYBOARD, member_list_keyboard
)
from bot.states import (
    ADD_NAME, ADD_GENDER, ADD_BIRTH, ADD_DEATH, ADD_PHONE, ADD_NOTES,
    EDIT_SELECT, EDIT_FIELD, EDIT_VALUE,
)
from utils.tree_renderer import render_member_relations


# ---- ADD MEMBER FLOW ----

async def add_member_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text(
        "➕ *Tambah Anggota Baru*\n\nKetik nama lengkap anggota:",
        parse_mode="Markdown",
        reply_markup=CANCEL_KEYBOARD,
    )
    return ADD_NAME


async def add_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ Batal":
        return await cancel(update, context)
    context.user_data["name"] = update.message.text.strip()
    await update.message.reply_text("Jenis kelamin:", reply_markup=GENDER_KEYBOARD)
    return ADD_GENDER


async def add_gender(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if "Laki" in text:
        context.user_data["gender"] = "male"
    elif "Perempuan" in text:
        context.user_data["gender"] = "female"
    else:
        await update.message.reply_text("Pilih salah satu:", reply_markup=GENDER_KEYBOARD)
        return ADD_GENDER
    await update.message.reply_text("Tanggal lahir (cth: 1990-05-20), atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_BIRTH


async def add_birth(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text != "⏭ Lewati":
        context.user_data["birth_date"] = text.strip()
    await update.message.reply_text("Tanggal wafat (jika sudah meninggal), atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_DEATH


async def add_death(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text != "⏭ Lewati":
        context.user_data["death_date"] = text.strip()
    await update.message.reply_text("Nomor telepon, atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_PHONE


async def add_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text != "⏭ Lewati":
        context.user_data["phone"] = text.strip()
    await update.message.reply_text("Catatan tambahan, atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_NOTES


async def add_notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text != "⏭ Lewati":
        context.user_data["notes"] = text.strip()

    user_id = update.effective_user.id
    data = context.user_data
    member = Member(
        id="",
        name=data["name"],
        gender=data.get("gender", "male"),
        birth_date=data.get("birth_date"),
        death_date=data.get("death_date"),
        phone=data.get("phone"),
        notes=data.get("notes"),
    )
    member = add_member(user_id, member)
    context.user_data.clear()

    await update.message.reply_text(
        f"✅ *{member.name}* berhasil ditambahkan!\n\n{member.summary()}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )
    return ConversationHandler.END


# ---- LIST MEMBERS ----

async def list_members_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    members = list_members(user_id)
    if not members:
        await update.message.reply_text("Belum ada anggota. Gunakan ➕ Tambah Anggota.", reply_markup=MAIN_MENU)
        return

    lines = ["📋 *Daftar Anggota Keluarga*\n"]
    for i, m in enumerate(members, 1):
        icon = "👨" if m.gender == "male" else "👩"
        line = f"{i}. {icon} {m.name}"
        if m.birth_date:
            line += f" ({m.birth_date})"
        lines.append(line)

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown", reply_markup=MAIN_MENU)


# ---- EDIT MEMBER FLOW ----

async def edit_member_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    members = list_members(user_id)
    if not members:
        await update.message.reply_text("Belum ada anggota.", reply_markup=MAIN_MENU)
        return ConversationHandler.END

    await update.message.reply_text(
        "✏️ Pilih anggota yang ingin diedit:",
        reply_markup=member_list_keyboard(members, "edit"),
    )
    return EDIT_SELECT


async def edit_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    member_id = query.data.split(":")[1]
    context.user_data["edit_id"] = member_id

    user_id = update.effective_user.id
    member = get_member(user_id, member_id)
    await query.message.reply_text(
        f"Edit *{member.name}*\nPilih field yang ingin diubah:",
        parse_mode="Markdown",
        reply_markup=EDIT_FIELDS_KEYBOARD,
    )
    return EDIT_FIELD


async def edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        return await cancel(update, context)

    field_map = {
        "Nama": "name",
        "Jenis Kelamin": "gender",
        "Tanggal Lahir": "birth_date",
        "Tanggal Wafat": "death_date",
        "Telepon": "phone",
        "Catatan": "notes",
    }
    field = field_map.get(text)
    if not field:
        await update.message.reply_text("Pilih field yang tersedia:", reply_markup=EDIT_FIELDS_KEYBOARD)
        return EDIT_FIELD

    context.user_data["edit_field"] = field
    if field == "gender":
        await update.message.reply_text("Pilih jenis kelamin baru:", reply_markup=GENDER_KEYBOARD)
    else:
        await update.message.reply_text(f"Masukkan nilai baru untuk *{text}*:", parse_mode="Markdown", reply_markup=CANCEL_KEYBOARD)
    return EDIT_VALUE


async def edit_value(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        return await cancel(update, context)

    user_id = update.effective_user.id
    member_id = context.user_data["edit_id"]
    field = context.user_data["edit_field"]

    value = text
    if field == "gender":
        value = "male" if "Laki" in text else "female"

    update_member(user_id, member_id, {field: value})
    context.user_data.clear()

    await update.message.reply_text("✅ Data berhasil diperbarui.", reply_markup=MAIN_MENU)
    return ConversationHandler.END


# ---- CANCEL ----

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("❌ Dibatalkan.", reply_markup=MAIN_MENU)
    return ConversationHandler.END
