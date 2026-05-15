from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from db.firestore import search_members, get_member
from utils.tree_renderer import render_family_of
from bot.keyboards import MAIN_MENU, SEARCH_PROMPT_KEYBOARD, member_list_keyboard
from bot.states import SEARCH_QUERY, SEARCH_SELECT


async def search_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔍 Ketik nama yang ingin dicari (min. 2 huruf):",
        reply_markup=SEARCH_PROMPT_KEYBOARD,
    )
    return SEARCH_QUERY


async def search_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        await update.message.reply_text("Dibatalkan.", reply_markup=MAIN_MENU)
        return ConversationHandler.END

    if len(text.strip()) < 2:
        await update.message.reply_text("Ketik minimal 2 huruf:")
        return SEARCH_QUERY

    user_id = update.effective_user.id
    results = search_members(user_id, text.strip())

    if not results:
        await update.message.reply_text(
            f"Tidak ditemukan anggota dengan nama '{text}'.\nCoba kata kunci lain:",
            reply_markup=SEARCH_PROMPT_KEYBOARD,
        )
        return SEARCH_QUERY

    if len(results) == 1:
        await _send_detail(update.message, user_id, results[0].id)
        return ConversationHandler.END

    await update.message.reply_text(
        f"Ditemukan {len(results)} anggota. Pilih untuk lihat detail:",
        reply_markup=member_list_keyboard(results, "detail"),
    )
    return SEARCH_SELECT


async def search_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    member_id = query.data.split(":")[1]
    user_id = update.effective_user.id
    await _send_detail(query.message, user_id, member_id)
    return ConversationHandler.END


async def _send_detail(message, user_id: int, member_id: str):
    member = get_member(user_id, member_id)
    if not member:
        await message.reply_text("Anggota tidak ditemukan.", reply_markup=MAIN_MENU)
        return

    rel_ids = set(member.parent_ids + member.spouse_ids + member.child_ids)
    for pid in member.parent_ids:
        p = get_member(user_id, pid)
        if p:
            rel_ids.update(p.parent_ids + p.child_ids)

    by_id = {member.id: member}
    for rid in rel_ids:
        m = get_member(user_id, rid)
        if m:
            by_id[rid] = m

    text = render_family_of(member, by_id)
    await message.reply_text(text, parse_mode="Markdown", reply_markup=MAIN_MENU)
