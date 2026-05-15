from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from db.firestore import search_members, list_members
from utils.tree_renderer import render_member_relations
from bot.keyboards import MAIN_MENU, CANCEL_KEYBOARD, member_list_keyboard

SEARCH_QUERY = 20
SEARCH_SELECT = 21


async def search_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔍 Ketik nama yang ingin dicari:",
        reply_markup=CANCEL_KEYBOARD,
    )
    return SEARCH_QUERY


async def search_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if text == "❌ Batal":
        await update.message.reply_text("Dibatalkan.", reply_markup=MAIN_MENU)
        return ConversationHandler.END

    user_id = update.effective_user.id
    results = search_members(user_id, text.strip())

    if not results:
        await update.message.reply_text(
            f"Tidak ditemukan anggota dengan nama '{text}'.",
            reply_markup=MAIN_MENU,
        )
        return ConversationHandler.END

    if len(results) == 1:
        all_members = list_members(user_id)
        detail = render_member_relations(results[0], all_members)
        await update.message.reply_text(detail, parse_mode="Markdown", reply_markup=MAIN_MENU)
        return ConversationHandler.END

    context.user_data["search_results"] = {m.id: m for m in results}
    await update.message.reply_text(
        f"Ditemukan {len(results)} anggota. Pilih untuk melihat detail:",
        reply_markup=member_list_keyboard(results, "detail"),
    )
    return SEARCH_SELECT


async def search_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    member_id = query.data.split(":")[1]

    user_id = update.effective_user.id
    all_members = list_members(user_id)
    by_id = {m.id: m for m in all_members}

    member = by_id.get(member_id)
    if not member:
        await query.message.reply_text("Anggota tidak ditemukan.", reply_markup=MAIN_MENU)
        return ConversationHandler.END

    detail = render_member_relations(member, all_members)
    await query.message.reply_text(detail, parse_mode="Markdown", reply_markup=MAIN_MENU)
    return ConversationHandler.END
