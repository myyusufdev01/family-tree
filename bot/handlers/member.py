from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler
from models.member import Member
from db.firestore import (
    add_member, list_members_paginated, update_member, get_member,
    link_parent_child, link_spouses, unlink_parent_child, unlink_spouses,
    search_members, count_members,
)
from bot.keyboards import (
    MAIN_MENU, GENDER_KEYBOARD, SKIP_KEYBOARD, CANCEL_KEYBOARD,
    EDIT_FIELDS_KEYBOARD, EDIT_REL_ACTION_KEYBOARD,
    ADD_REL_TYPE_KEYBOARD, ADD_REL_TYPE_KEYBOARD_EDIT,
    SEARCH_PROMPT_KEYBOARD, member_list_keyboard, pagination_keyboard,
)
from bot.states import (
    ADD_NAME, ADD_GENDER, ADD_BIRTH, ADD_DEATH, ADD_PHONE, ADD_NOTES,
    ADD_REL_TYPE, ADD_REL_SEARCH, ADD_REL_SELECT,
    EDIT_SEARCH, EDIT_SEARCH_SEL, EDIT_FIELD, EDIT_VALUE,
    EDIT_REL_ACTION, EDIT_REL_ADD_TYPE, EDIT_REL_ADD_SEARCH, EDIT_REL_ADD_SEL,
    EDIT_REL_REMOVE, LIST_PAGE,
)


# ── ADD MEMBER ─────────────────────────────────────────────────────────────

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
    await update.message.reply_text("Tanggal lahir (contoh: 1990-05-20), atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_BIRTH


async def add_birth(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text != "⏭ Lewati":
        context.user_data["birth_date"] = update.message.text.strip()
    await update.message.reply_text("Tanggal wafat (jika sudah meninggal), atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_DEATH


async def add_death(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text != "⏭ Lewati":
        context.user_data["death_date"] = update.message.text.strip()
    await update.message.reply_text("Nomor telepon, atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_PHONE


async def add_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text != "⏭ Lewati":
        context.user_data["phone"] = update.message.text.strip()
    await update.message.reply_text("Catatan tambahan, atau lewati:", reply_markup=SKIP_KEYBOARD)
    return ADD_NOTES


async def add_notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text != "⏭ Lewati":
        context.user_data["notes"] = update.message.text.strip()

    user_id = update.effective_user.id
    d = context.user_data
    member = add_member(user_id, Member(
        id="", name=d["name"], gender=d.get("gender", "male"),
        birth_date=d.get("birth_date"), death_date=d.get("death_date"),
        phone=d.get("phone"), notes=d.get("notes"),
    ))
    context.user_data["new_member_id"] = member.id
    context.user_data["new_member_name"] = member.name

    total = count_members(user_id)
    if total < 2:
        context.user_data.clear()
        await update.message.reply_text(
            f"✅ *{member.name}* berhasil ditambahkan!",
            parse_mode="Markdown", reply_markup=MAIN_MENU,
        )
        return ConversationHandler.END

    await update.message.reply_text(
        f"✅ *{member.name}* berhasil ditambahkan!\n\n"
        "Apakah ingin menghubungkan ke anggota lain? Pilih jenis hubungan:",
        parse_mode="Markdown",
        reply_markup=ADD_REL_TYPE_KEYBOARD,
    )
    return ADD_REL_TYPE


async def add_rel_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "⏭ Lewati":
        context.user_data.clear()
        await update.message.reply_text("Selesai.", reply_markup=MAIN_MENU)
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
    await update.message.reply_text(
        "Ketik nama anggota yang dicari (min. 2 huruf):",
        reply_markup=SEARCH_PROMPT_KEYBOARD,
    )
    return ADD_REL_SEARCH


async def add_rel_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ Batal":
        return await cancel(update, context)
    query = update.message.text.strip()
    if len(query) < 2:
        await update.message.reply_text("Ketik minimal 2 huruf:")
        return ADD_REL_SEARCH

    user_id = update.effective_user.id
    new_id = context.user_data["new_member_id"]
    results = [m for m in search_members(user_id, query) if m.id != new_id]

    if not results:
        await update.message.reply_text(f"Tidak ditemukan '{query}'. Coba nama lain:")
        return ADD_REL_SEARCH

    await update.message.reply_text(
        f"Ditemukan {len(results)} anggota:",
        reply_markup=member_list_keyboard(results, "addrel"),
    )
    return ADD_REL_SELECT


async def add_rel_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    target_id = query.data.split(":")[1]
    user_id = update.effective_user.id
    new_id = context.user_data["new_member_id"]
    new_name = context.user_data["new_member_name"]
    rel_type = context.user_data["rel_type"]
    target = get_member(user_id, target_id)
    t_name = target.name if target else "?"

    if rel_type == "child_of":
        link_parent_child(user_id, parent_id=target_id, child_id=new_id)
        msg = f"✅ *{new_name}* → anak dari *{t_name}*."
    elif rel_type == "parent_of":
        link_parent_child(user_id, parent_id=new_id, child_id=target_id)
        msg = f"✅ *{new_name}* → orang tua dari *{t_name}*."
    else:
        link_spouses(user_id, new_id, target_id)
        msg = f"✅ *{new_name}* & *{t_name}* → pasangan."

    context.user_data.clear()
    await query.message.reply_text(msg, parse_mode="Markdown", reply_markup=MAIN_MENU)
    return ConversationHandler.END


# ── LIST MEMBERS (paginated) ────────────────────────────────────────────────

async def list_members_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    context.user_data["list_cursors"] = [None]  # stack of cursors for prev/next
    await _send_member_page(update, context, user_id, cursor=None, page=0)
    return LIST_PAGE


async def list_page_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = update.effective_user.id
    direction = query.data.split(":")[1]
    cursors: list = context.user_data.get("list_cursors", [None])

    if direction == "next":
        cursor = cursors[-1]
        members, next_cursor = list_members_paginated(user_id, start_after_name=cursor)
        if next_cursor:
            cursors.append(next_cursor)
        page = len(cursors) - 1
    else:  # prev
        if len(cursors) > 1:
            cursors.pop()
        cursor = cursors[-2] if len(cursors) >= 2 else None
        members, next_cursor = list_members_paginated(user_id, start_after_name=cursor)
        page = len(cursors) - 1

    context.user_data["list_cursors"] = cursors
    await _send_member_page(query, context, user_id, cursor, page, edit=True, next_cursor=next_cursor)
    return LIST_PAGE


async def _send_member_page(update_or_query, context, user_id, cursor, page, edit=False, next_cursor=None):
    members, nc = list_members_paginated(user_id, start_after_name=cursor)
    if next_cursor is None:
        next_cursor = nc

    if not members and page == 0:
        text = "Belum ada anggota. Gunakan ➕ Tambah Anggota."
        if edit:
            await update_or_query.message.edit_text(text)
        else:
            await update_or_query.message.reply_text(text, reply_markup=MAIN_MENU)
        return

    from db.firestore import count_members
    total = count_members(user_id)
    start = page * 20 + 1
    end = min(start + len(members) - 1, total)

    lines = [f"📋 *Daftar Anggota* ({start}–{end} dari {total})\n"]
    for i, m in enumerate(members, start):
        icon = "👨" if m.gender == "male" else "👩"
        line = f"{i}. {icon} {m.name}"
        if m.birth_date:
            line += f" ({m.birth_date})"
        lines.append(line)

    nav = pagination_keyboard(has_prev=(page > 0), has_next=(next_cursor is not None))
    text = "\n".join(lines)

    if edit:
        await update_or_query.message.edit_text(text, parse_mode="Markdown", reply_markup=nav)
    else:
        await update_or_query.message.reply_text(text, parse_mode="Markdown", reply_markup=nav)


# ── EDIT MEMBER ─────────────────────────────────────────────────────────────

async def edit_member_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text(
        "✏️ *Edit Anggota*\n\nKetik nama anggota yang ingin diedit:",
        parse_mode="Markdown",
        reply_markup=SEARCH_PROMPT_KEYBOARD,
    )
    return EDIT_SEARCH


async def edit_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ Batal":
        return await cancel(update, context)
    query = update.message.text.strip()
    if len(query) < 2:
        await update.message.reply_text("Ketik minimal 2 huruf:")
        return EDIT_SEARCH

    user_id = update.effective_user.id
    results = search_members(user_id, query)
    if not results:
        await update.message.reply_text(f"Tidak ditemukan '{query}'. Coba nama lain:")
        return EDIT_SEARCH

    if len(results) == 1:
        context.user_data["edit_id"] = results[0].id
        await update.message.reply_text(
            f"Edit *{results[0].name}*\nPilih field yang ingin diubah:",
            parse_mode="Markdown", reply_markup=EDIT_FIELDS_KEYBOARD,
        )
        return EDIT_FIELD

    await update.message.reply_text(
        "Pilih anggota:",
        reply_markup=member_list_keyboard(results, "edit"),
    )
    return EDIT_SEARCH_SEL


async def edit_search_sel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    member_id = query.data.split(":")[1]
    context.user_data["edit_id"] = member_id
    user_id = update.effective_user.id
    member = get_member(user_id, member_id)
    await query.message.reply_text(
        f"Edit *{member.name}*\nPilih field yang ingin diubah:",
        parse_mode="Markdown", reply_markup=EDIT_FIELDS_KEYBOARD,
    )
    return EDIT_FIELD


async def edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        return await cancel(update, context)

    if text == "🔗 Relasi":
        user_id = update.effective_user.id
        member_id = context.user_data["edit_id"]
        member = get_member(user_id, member_id)
        # Load only direct relatives (not all members)
        rel_ids = set(member.parent_ids + member.spouse_ids + member.child_ids)
        by_id = {}
        for rid in rel_ids:
            m = get_member(user_id, rid)
            if m:
                by_id[rid] = m

        lines = [f"Relasi *{member.name}* saat ini:\n"]
        parents = [by_id[pid].name for pid in member.parent_ids if pid in by_id]
        spouses = [by_id[sid].name for sid in member.spouse_ids if sid in by_id]
        children = [by_id[cid].name for cid in member.child_ids if cid in by_id]

        if parents:
            lines.append(f"👴👵 Orang tua: {', '.join(parents)}")
        if spouses:
            lines.append(f"💑 Pasangan: {', '.join(spouses)}")
        if children:
            lines.append(f"👶 Anak: {', '.join(children)}")
        if not any([parents, spouses, children]):
            lines.append("_(belum ada relasi)_")

        await update.message.reply_text(
            "\n".join(lines), parse_mode="Markdown",
            reply_markup=EDIT_REL_ACTION_KEYBOARD,
        )
        return EDIT_REL_ACTION

    field_map = {
        "Nama": "name", "Jenis Kelamin": "gender",
        "Tanggal Lahir": "birth_date", "Tanggal Wafat": "death_date",
        "Telepon": "phone", "Catatan": "notes",
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
            parse_mode="Markdown", reply_markup=CANCEL_KEYBOARD,
        )
    return EDIT_VALUE


async def edit_value(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        return await cancel(update, context)
    user_id = update.effective_user.id
    member_id = context.user_data["edit_id"]
    field = context.user_data["edit_field"]
    value = ("male" if "Laki" in text else "female") if field == "gender" else text
    update_member(user_id, member_id, {field: value})
    context.user_data.clear()
    await update.message.reply_text("✅ Data berhasil diperbarui.", reply_markup=MAIN_MENU)
    return ConversationHandler.END


async def edit_rel_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        return await cancel(update, context)

    user_id = update.effective_user.id
    member_id = context.user_data["edit_id"]

    if text == "➕ Tambah Relasi":
        await update.message.reply_text(
            "Pilih jenis relasi yang ingin ditambahkan:",
            reply_markup=ADD_REL_TYPE_KEYBOARD_EDIT,
        )
        return EDIT_REL_ADD_TYPE

    if text == "🗑 Hapus Relasi":
        member = get_member(user_id, member_id)
        rel_ids = set(member.parent_ids + member.spouse_ids + member.child_ids)
        by_id = {rid: get_member(user_id, rid) for rid in rel_ids}
        by_id = {k: v for k, v in by_id.items() if v}

        rels = []
        for pid in member.parent_ids:
            if pid in by_id:
                rels.append({"label": f"👴👵 Orang tua: {by_id[pid].name}", "type": "parent", "target": pid})
        for sid in member.spouse_ids:
            if sid in by_id:
                rels.append({"label": f"💑 Pasangan: {by_id[sid].name}", "type": "spouse", "target": sid})
        for cid in member.child_ids:
            if cid in by_id:
                rels.append({"label": f"👶 Anak: {by_id[cid].name}", "type": "child", "target": cid})

        if not rels:
            await update.message.reply_text("Tidak ada relasi untuk dihapus.", reply_markup=MAIN_MENU)
            return ConversationHandler.END

        context.user_data["edit_rels"] = rels
        buttons = [[InlineKeyboardButton(r["label"], callback_data=f"rmrel:{i}")] for i, r in enumerate(rels)]
        await update.message.reply_text(
            "Pilih relasi yang ingin dihapus:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return EDIT_REL_REMOVE

    await update.message.reply_text("Pilih salah satu:", reply_markup=EDIT_REL_ACTION_KEYBOARD)
    return EDIT_REL_ACTION


async def edit_rel_add_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        return await cancel(update, context)

    rel_map = {
        "👨‍👧 Anak dari...": "child_of",
        "👨‍👩‍👧 Orang tua dari...": "parent_of",
        "💑 Pasangan dari...": "spouse_of",
    }
    rel = rel_map.get(text)
    if not rel:
        await update.message.reply_text("Pilih salah satu:", reply_markup=ADD_REL_TYPE_KEYBOARD_EDIT)
        return EDIT_REL_ADD_TYPE

    context.user_data["edit_rel_add_type"] = rel
    await update.message.reply_text(
        "Ketik nama anggota yang dicari:", reply_markup=SEARCH_PROMPT_KEYBOARD,
    )
    return EDIT_REL_ADD_SEARCH


async def edit_rel_add_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ Batal":
        return await cancel(update, context)
    query = update.message.text.strip()
    if len(query) < 2:
        await update.message.reply_text("Ketik minimal 2 huruf:")
        return EDIT_REL_ADD_SEARCH

    user_id = update.effective_user.id
    member_id = context.user_data["edit_id"]
    results = [m for m in search_members(user_id, query) if m.id != member_id]
    if not results:
        await update.message.reply_text(f"Tidak ditemukan '{query}'. Coba nama lain:")
        return EDIT_REL_ADD_SEARCH

    await update.message.reply_text("Pilih anggota:", reply_markup=member_list_keyboard(results, "erel"))
    return EDIT_REL_ADD_SEL


async def edit_rel_add_sel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    target_id = query.data.split(":")[1]
    user_id = update.effective_user.id
    member_id = context.user_data["edit_id"]
    rel_type = context.user_data["edit_rel_add_type"]
    member = get_member(user_id, member_id)
    target = get_member(user_id, target_id)
    m_name = member.name if member else "?"
    t_name = target.name if target else "?"

    if rel_type == "child_of":
        link_parent_child(user_id, parent_id=target_id, child_id=member_id)
        msg = f"✅ *{m_name}* → anak dari *{t_name}*."
    elif rel_type == "parent_of":
        link_parent_child(user_id, parent_id=member_id, child_id=target_id)
        msg = f"✅ *{m_name}* → orang tua dari *{t_name}*."
    else:
        link_spouses(user_id, member_id, target_id)
        msg = f"✅ *{m_name}* & *{t_name}* → pasangan."

    context.user_data.clear()
    await query.message.reply_text(msg, parse_mode="Markdown", reply_markup=MAIN_MENU)
    return ConversationHandler.END


async def edit_rel_remove(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    idx = int(query.data.split(":")[1])
    rels = context.user_data["edit_rels"]
    rel = rels[idx]
    user_id = update.effective_user.id
    member_id = context.user_data["edit_id"]
    target_id = rel["target"]
    member = get_member(user_id, member_id)
    target = get_member(user_id, target_id)
    m_name = member.name if member else "?"
    t_name = target.name if target else "?"

    if rel["type"] == "parent":
        unlink_parent_child(user_id, parent_id=target_id, child_id=member_id)
        msg = f"✅ Relasi orang tua *{t_name}* → *{m_name}* dihapus."
    elif rel["type"] == "child":
        unlink_parent_child(user_id, parent_id=member_id, child_id=target_id)
        msg = f"✅ Relasi anak *{t_name}* dari *{m_name}* dihapus."
    else:
        unlink_spouses(user_id, member_id, target_id)
        msg = f"✅ Relasi pasangan *{m_name}* & *{t_name}* dihapus."

    context.user_data.clear()
    await query.message.reply_text(msg, parse_mode="Markdown", reply_markup=MAIN_MENU)
    return ConversationHandler.END


# ── CANCEL ──────────────────────────────────────────────────────────────────

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("❌ Dibatalkan.", reply_markup=MAIN_MENU)
    return ConversationHandler.END
