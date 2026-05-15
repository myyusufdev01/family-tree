import logging
import os
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    filters,
)

import config  # validates env vars on import
from bot.handlers.start import start, help_command
from bot.handlers.tree import view_tree
from bot.handlers.member import (
    add_member_start, add_name, add_gender, add_birth, add_death, add_phone, add_notes,
    edit_member_start, edit_select, edit_field, edit_value,
    list_members_cmd, cancel,
)
from bot.handlers.search import search_start, search_query, search_select, SEARCH_QUERY, SEARCH_SELECT
from bot.handlers.link import link_start, link_type, link_member_a, link_member_b, cancel as link_cancel
from bot.states import (
    ADD_NAME, ADD_GENDER, ADD_BIRTH, ADD_DEATH, ADD_PHONE, ADD_NOTES,
    EDIT_SELECT, EDIT_FIELD, EDIT_VALUE,
    LINK_TYPE, LINK_MEMBER_A, LINK_MEMBER_B,
)

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)

PORT = int(os.getenv("PORT", 8080))
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")


def build_app() -> Application:
    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()

    add_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^➕ Tambah Anggota$"), add_member_start)],
        states={
            ADD_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_name)],
            ADD_GENDER: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_gender)],
            ADD_BIRTH: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_birth)],
            ADD_DEATH: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_death)],
            ADD_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_phone)],
            ADD_NOTES: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_notes)],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), cancel)],
    )

    edit_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^✏️ Edit Anggota$"), edit_member_start)],
        states={
            EDIT_SELECT: [CallbackQueryHandler(edit_select, pattern="^edit:")],
            EDIT_FIELD: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_field)],
            EDIT_VALUE: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_value)],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), cancel)],
    )

    search_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^🔍 Cari Anggota$"), search_start)],
        states={
            SEARCH_QUERY: [MessageHandler(filters.TEXT & ~filters.COMMAND, search_query)],
            SEARCH_SELECT: [CallbackQueryHandler(search_select, pattern="^detail:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), lambda u, c: ConversationHandler.END)],
    )

    link_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^🔗 Hubungkan Anggota$"), link_start)],
        states={
            LINK_TYPE: [MessageHandler(filters.TEXT & ~filters.COMMAND, link_type)],
            LINK_MEMBER_A: [CallbackQueryHandler(link_member_a, pattern="^linkA:")],
            LINK_MEMBER_B: [CallbackQueryHandler(link_member_b, pattern="^linkB:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), link_cancel)],
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.Regex("^🌳 Lihat Pohon$"), view_tree))
    app.add_handler(MessageHandler(filters.Regex("^📋 Daftar Anggota$"), list_members_cmd))
    app.add_handler(add_conv)
    app.add_handler(edit_conv)
    app.add_handler(search_conv)
    app.add_handler(link_conv)

    return app


def main():
    app = build_app()

    if WEBHOOK_URL:
        logging.info(f"Bot berjalan dengan webhook: {WEBHOOK_URL}")
        app.run_webhook(
            listen="0.0.0.0",
            port=PORT,
            webhook_url=WEBHOOK_URL,
            secret_token=config.TELEGRAM_BOT_TOKEN.replace(":", "_"),
        )
    else:
        logging.info("Bot berjalan dengan polling...")
        app.run_polling()


if __name__ == "__main__":
    main()
