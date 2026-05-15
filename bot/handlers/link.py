from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from db.firestore import list_members, link_parent_child, link_spouses, get_member
from bot.keyboards import MAIN_MENU, LINK_TYPE_KEYBOARD, member_list_keyboard
from bot.states import LINK_TYPE, LINK_MEMBER_A, LINK_MEMBER_B


async def link_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    members = list_members(user_id)
    if len(members) < 2:
        await update.message.reply_text(
            "Perlu minimal 2 anggota untuk membuat relasi.",
            reply_markup=MAIN_MENU,
        )
        return ConversationHandler.END

    context.user_data["all_members"] = members
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
        prompt_a = "Pilih *orang tua*:"
    else:
        context.user_data["link_type"] = "spouse"
        prompt_a = "Pilih *pasangan pertama*:"

    members = context.user_data["all_members"]
    await update.message.reply_text(
        prompt_a,
        parse_mode="Markdown",
        reply_markup=member_list_keyboard(members, "linkA"),
    )
    return LINK_MEMBER_A


async def link_member_a(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    member_a_id = query.data.split(":")[1]
    context.user_data["member_a"] = member_a_id

    link_type = context.user_data["link_type"]
    # Kecualikan anggota pertama dari pilihan kedua
    remaining = [m for m in context.user_data["all_members"] if m.id != member_a_id]
    prompt_b = "Pilih *anak*:" if link_type == "parent_child" else "Pilih *pasangan kedua*:"

    await query.message.reply_text(
        prompt_b,
        parse_mode="Markdown",
        reply_markup=member_list_keyboard(remaining, "linkB"),
    )
    return LINK_MEMBER_B


async def link_member_b(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    member_b_id = query.data.split(":")[1]
    member_a_id = context.user_data["member_a"]
    link_type = context.user_data["link_type"]
    user_id = update.effective_user.id

    members_by_id = {m.id: m for m in context.user_data["all_members"]}
    name_a = members_by_id[member_a_id].name
    name_b = members_by_id[member_b_id].name

    if link_type == "parent_child":
        link_parent_child(user_id, parent_id=member_a_id, child_id=member_b_id)
        msg = f"✅ *{name_a}* ditetapkan sebagai orang tua dari *{name_b}*."
    else:
        link_spouses(user_id, member_a_id, member_b_id)
        msg = f"✅ *{name_a}* dan *{name_b}* ditetapkan sebagai pasangan."

    context.user_data.clear()
    await query.message.reply_text(msg, parse_mode="Markdown", reply_markup=MAIN_MENU)
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("❌ Dibatalkan.", reply_markup=MAIN_MENU)
    return ConversationHandler.END
