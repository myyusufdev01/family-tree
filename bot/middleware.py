from telegram import Update
from telegram.ext import ContextTypes, ApplicationHandlerStop
from db.firestore import is_approved


async def check_approved(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not user:
        return

    if not is_approved(user.id):
        if update.message:
            await update.message.reply_text(
                "🔒 Akses ditolak.\n\n"
                "Aplikasi ini hanya untuk pengguna terdaftar.\n"
                "Hubungi admin untuk mendaftarkan akun Anda.\n\n"
                f"ID Telegram Anda: `{user.id}`",
                parse_mode="Markdown",
            )
        elif update.callback_query:
            await update.callback_query.answer("Akses ditolak. Anda belum terdaftar.", show_alert=True)

        raise ApplicationHandlerStop
