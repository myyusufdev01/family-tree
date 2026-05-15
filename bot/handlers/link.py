from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from db.firestore import search_members, get_member, link_parent_child, link_spouses
from bot.keyboards import MAIN_MENU, LINK_TYPE_KEYBOARD, SEARCH_PROMPT_KEYBOARD, member_list_keyboard
from bot.states import LINK_TYPE, LINK_A_SEARCH, LINK_A_SELECT, LINK_B_SEARCH, LINK_B_SELECT


async def link_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text(
        "🔗 *Hubungkan Anggota*\n\nPilih jenis relasi:",
        parse_mode="Markdown",
        reply_markup=LINK_TYPE_KEYBOARD,
    )
    return LINK_TYPE


async def link_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if "Orang tua" in text:
        context.user_data["link_type"] = "parent_child"
        prompt = "Ketik nama *orang tua*:"
    else:
        context.user_data["link_type"] = "spouse"
        prompt = "Ketik nama *pasangan pertama*:"

    await update.message.reply_text(prompt, parse_mode="Markdown", reply_markup=SEARCH_PROMPT_KEYBOARD)
    return LINK_A_SEARCH


async def link_a_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ Batal":
        return await cancel(update, context)
    query = update.message.text.strip()
    if len(query) < 2:
        await update.message.reply_text("Ketik minimal 2 huruf:")
        return LINK_A_SEARCH

    user_id = update.effective_user.id
    results = search_members(user_id, query)
    if not results:
        await update.message.reply_text(f"Tidak ditemukan '{query}'. Coba nama lain:")
        return LINK_A_SEARCH

    await update.message.reply_text("Pilih anggota:", reply_markup=member_list_keyboard(results, "linkA"))
    return LINK_A_SELECT


async def link_a_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data["member_a"] = query.data.split(":")[1]

    link_type = context.user_data["link_type"]
    prompt = "Ketik nama *anak*:" if link_type == "parent_child" else "Ketik nama *pasangan kedua*:"
    await query.message.reply_text(prompt, parse_mode="Markdown", reply_markup=SEARCH_PROMPT_KEYBOARD)
    return LINK_B_SEARCH


async def link_b_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ Batal":
        return await cancel(update, context)
    query = update.message.text.strip()
    if len(query) < 2:
        await update.message.reply_text("Ketik minimal 2 huruf:")
        return LINK_B_SEARCH

    user_id = update.effective_user.id
    member_a = context.user_data["member_a"]
    results = [m for m in search_members(user_id, query) if m.id != member_a]
    if not results:
        await update.message.reply_text(f"Tidak ditemukan '{query}'. Coba nama lain:")
        return LINK_B_SEARCH

    await update.message.reply_text("Pilih anggota:", reply_markup=member_list_keyboard(results, "linkB"))
    return LINK_B_SELECT


async def link_b_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    member_b_id = query.data.split(":")[1]
    member_a_id = context.user_data["member_a"]
    link_type = context.user_data["link_type"]
    user_id = update.effective_user.id

    name_a = (get_member(user_id, member_a_id) or type("", (), {"name": "?"})()).name
    name_b = (get_member(user_id, member_b_id) or type("", (), {"name": "?"})()).name

    if link_type == "parent_child":
        link_parent_child(user_id, parent_id=member_a_id, child_id=member_b_id)
        msg = f"✅ *{name_a}* → orang tua dari *{name_b}*."
    else:
        link_spouses(user_id, member_a_id, member_b_id)
        msg = f"✅ *{name_a}* & *{name_b}* → pasangan."

    context.user_data.clear()
    await query.message.reply_text(msg, parse_mode="Markdown", reply_markup=MAIN_MENU)
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("❌ Dibatalkan.", reply_markup=MAIN_MENU)
    return ConversationHandler.END
