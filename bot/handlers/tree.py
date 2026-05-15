from telegram import Update
from telegram.ext import ContextTypes
from db.firestore import list_members
from utils.tree_renderer import render_tree
from bot.keyboards import MAIN_MENU


async def view_tree(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    members = list_members(user_id)
    text = render_tree(members)
    await update.message.reply_text(f"```\n{text}\n```", parse_mode="Markdown", reply_markup=MAIN_MENU)
