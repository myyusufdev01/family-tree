from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from models.member import Member
from db.firestore import (
    add_member, list_members, update_member, get_member,
    link_parent_child, link_spouses,
)
from bot.keyboards import (
    MAIN_MENU, GENDER_KEYBOARD, SKIP_KEYBOARD, CANCEL_KEYBOARD,
    EDIT_FIELDS_KEYBOARD, ADD_REL_TYPE_KEYBOARD, member_list_keyboard,
)
from bot.states import (
    ADD_NAME, ADD_GENDER, ADD_BIRTH, ADD_DEATH, ADD_PHONE, ADD_NOTES,
    ADD_REL_TYPE, ADD_REL_TARGET,
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
    await update.message.reply_text(
        "Tanggal lahir (contoh: 1990-05-20), atau lewati:",
        reply_markup=SKIP_KEYBOARD,
    )
    return ADD_BIRTH


async def add_birth(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text != "⏭ Lewati":
        context.user_data["birth_date"] = text.strip()
    await update.message.reply_text(
        "Tanggal wafat (jika sudah meninggal), atau lewati:",
        reply_markup=SKIP_KEYBOARD,
    )
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
    context.user_data["new_member_id"] = member.id
    context.user_data["new_member_name"] = member.name

    # Cek apakah ada anggota lain untuk dihubungkan
    all_members = [m for m in list_members(user_id) if m.id != member.id]
    if not all_members:
        context.user_data.clear()
        await update.message.reply_text(
            f"✅ *{member.name}* berhasil ditambahkan!",
            parse_mode="Markdown",
            reply_markup=MAIN_MENU,
        )
        return ConversationHandler.END

    context.user_data["linkable_members"] = all_members
    await update.message.reply_text(
        f"✅ *{member.name}* berhasil ditambahkan!\n\n"
        "Apakah anggota ini memiliki hubungan dengan anggota lain?\n"
        "Pilih jenis hubungan:",
        parse_mode="Markdown",
        reply_markup=ADD_REL_TYPE_KEYBOARD,
    )
    return ADD_REL_TYPE


async def add_rel_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text

    if text == "⏭ Lewati":
        context.user_data.clear()
        await update.message.reply_text("Selesai. Anggota disimpan tanpa hubungan.", reply_markup=MAIN_MENU)
        return ConversationHandler.END

    rel_map = {
        "👨‍👧 Anak dari...": "child_of",
        "👨‍👩‍👧 Orang tua dari...": "parent_of",
        "💑 Pasangan dari...": "spouse_of",
    }
    rel = rel_map.get(text)
    if not rel:
        await update.message.reply_text("Pilih salah satu:", reply_markup=ADD_REL_TYPE_KEYBOARD)
        return ADD_REL_TYPE

    context.user_data["rel_type"] = rel
    members = context.user_data["linkable_members"]

    label_map = {
        "child_of": "Pilih *orang tua* dari anggota ini:",
        "parent_of": "Pilih *anak* dari anggota ini:",
        "spouse_of": "Pilih *pasangan* dari anggota ini:",
    }
    await update.message.reply_text(
        label_map[rel],
        parse_mode="Markdown",
        reply_markup=member_list_keyboard(members, "addrel"),
    )
    return ADD_REL_TARGET


async def add_rel_target(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    target_id = query.data.split(":")[1]
    user_id = update.effective_user.id
    new_id = context.user_data["new_member_id"]
    new_name = context.user_data["new_member_name"]
    rel_type = context.user_data["rel_type"]

    target = get_member(user_id, target_id)
    target_name = target.name if target else "?"

    if rel_type == "child_of":
        link_parent_child(user_id, parent_id=target_id, child_id=new_id)
        msg = f"✅ *{new_name}* ditetapkan sebagai anak dari *{target_name}*."
    elif rel_type == "parent_of":
        link_parent_child(user_id, parent_id=new_id, child_id=target_id)
        msg = f"✅ *{new_name}* ditetapkan sebagai orang tua dari *{target_name}*."
    else:
        link_spouses(user_id, new_id, target_id)
        msg = f"✅ *{new_name}* dan *{target_name}* ditetapkan sebagai pasangan."

    context.user_data.clear()
    await query.message.reply_text(msg, parse_mode="Markdown", reply_markup=MAIN_MENU)
    return ConversationHandler.END


# ---- LIST MEMBERS ----

async def list_members_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    members = list_members(user_id)
    if not members:
        await update.message.reply_text(
            "Belum ada anggota. Gunakan ➕ Tambah Anggota.",
            reply_markup=MAIN_MENU,
        )
        return

    lines = ["📋 *Daftar Anggota Keluarga*\n"]
    for i, m in enumerate(members, 1):
        icon = "👨" if m.gender == "male" else "👩"
        line = f"{i}. {icon} {m.name}"
        if m.birth_date:
            line += f" ({m.birth_date})"
        lines.append(line)

    await update.message.reply_text(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


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
        await update.message.reply_text(
            f"Masukkan nilai baru untuk *{text}*:",
            parse_mode="Markdown",
            reply_markup=CANCEL_KEYBOARD,
        )
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
