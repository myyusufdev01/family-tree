from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from db.firestore import search_members, get_member
from utils.tree_renderer import render_family_of
from bot.keyboards import MAIN_MENU, SEARCH_PROMPT_KEYBOARD, member_list_keyboard
from bot.states import TREE_SEARCH, TREE_SELECT


async def tree_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🌳 *Lihat Pohon Keluarga*\n\nKetik nama anggota yang ingin dilihat silsilahnya:",
        parse_mode="Markdown",
        reply_markup=SEARCH_PROMPT_KEYBOARD,
    )
    return TREE_SEARCH


async def tree_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text == "❌ Batal":
        await update.message.reply_text("Dibatalkan.", reply_markup=MAIN_MENU)
        return ConversationHandler.END

    query = update.message.text.strip()
    if len(query) < 2:
        await update.message.reply_text("Ketik minimal 2 huruf:")
        return TREE_SEARCH

    user_id = update.effective_user.id
    results = search_members(user_id, query)

    if not results:
        await update.message.reply_text(f"Tidak ditemukan '{query}'. Coba nama lain:")
        return TREE_SEARCH

    if len(results) == 1:
        await _send_family_view(update.message, user_id, results[0].id)
        return ConversationHandler.END

    await update.message.reply_text(
        f"Ditemukan {len(results)} anggota. Pilih:",
        reply_markup=member_list_keyboard(results, "tree"),
    )
    return TREE_SELECT


async def tree_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    member_id = query.data.split(":")[1]
    user_id = update.effective_user.id
    await _send_family_view(query.message, user_id, member_id)
    return ConversationHandler.END


async def _send_family_view(message, user_id: int, member_id: str):
    member = get_member(user_id, member_id)
    if not member:
        await message.reply_text("Anggota tidak ditemukan.", reply_markup=MAIN_MENU)
        return

    # Load only direct relatives — efficient even with 1000+ members
    rel_ids = set(member.parent_ids + member.spouse_ids + member.child_ids)
    # Also load grandparents (parents of parents)
    for pid in member.parent_ids:
        p = get_member(user_id, pid)
        if p:
            rel_ids.update(p.parent_ids)
            rel_ids.update(p.child_ids)  # siblings

    by_id = {member.id: member}
    for rid in rel_ids:
        m = get_member(user_id, rid)
        if m:
            by_id[rid] = m

    text = render_family_of(member, by_id)
    await message.reply_text(text, parse_mode="Markdown", reply_markup=MAIN_MENU)
