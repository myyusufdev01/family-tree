import asyncio
import logging
import os
from aiohttp import web
from telegram import Update
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ConversationHandler, TypeHandler, filters,
)

import config
from bot.middleware import check_approved
from bot.handlers.start import start, help_command
from bot.handlers.tree import tree_start, tree_search, tree_select
from bot.handlers.member import (
    add_member_start, add_name, add_gender, add_birth, add_death, add_phone, add_notes,
    add_rel_type, add_rel_search, add_rel_select,
    edit_member_start, edit_search, edit_search_sel, edit_field, edit_value,
    edit_rel_action, edit_rel_add_type, edit_rel_add_search, edit_rel_add_sel,
    edit_rel_remove, list_members_cmd, list_page_callback, cancel,
)
from bot.handlers.search import search_start, search_query, search_select
from bot.handlers.link import (
    link_start, link_type, link_a_search, link_a_select,
    link_b_search, link_b_select, cancel as link_cancel,
)
from bot.handlers.admin import (
    admin_panel, admin_stats, admin_broadcast_start, handle_broadcast,
    cmd_daftarkan, cmd_cabut, cmd_daftar_user,
)
from bot.states import (
    ADD_NAME, ADD_GENDER, ADD_BIRTH, ADD_DEATH, ADD_PHONE, ADD_NOTES,
    ADD_REL_TYPE, ADD_REL_SEARCH, ADD_REL_SELECT,
    EDIT_SEARCH, EDIT_SEARCH_SEL, EDIT_FIELD, EDIT_VALUE,
    EDIT_REL_ACTION, EDIT_REL_ADD_TYPE, EDIT_REL_ADD_SEARCH, EDIT_REL_ADD_SEL,
    EDIT_REL_REMOVE, LIST_PAGE,
    TREE_SEARCH, TREE_SELECT,
    LINK_TYPE, LINK_A_SEARCH, LINK_A_SELECT, LINK_B_SEARCH, LINK_B_SELECT,
    SEARCH_QUERY, SEARCH_SELECT,
)

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

PORT = int(os.getenv("PORT", 8080))
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")
IS_CLOUD_RUN = bool(os.getenv("K_SERVICE"))
SECRET_TOKEN = config.TELEGRAM_BOT_TOKEN.replace(":", "_")


def build_app() -> Application:
    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()

    # Group -1: approval check sebelum semua handler
    app.add_handler(TypeHandler(Update, check_approved), group=-1)

    add_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^➕ Tambah Anggota$"), add_member_start)],
        states={
            ADD_NAME:       [MessageHandler(filters.TEXT & ~filters.COMMAND, add_name)],
            ADD_GENDER:     [MessageHandler(filters.TEXT & ~filters.COMMAND, add_gender)],
            ADD_BIRTH:      [MessageHandler(filters.TEXT & ~filters.COMMAND, add_birth)],
            ADD_DEATH:      [MessageHandler(filters.TEXT & ~filters.COMMAND, add_death)],
            ADD_PHONE:      [MessageHandler(filters.TEXT & ~filters.COMMAND, add_phone)],
            ADD_NOTES:      [MessageHandler(filters.TEXT & ~filters.COMMAND, add_notes)],
            ADD_REL_TYPE:   [MessageHandler(filters.TEXT & ~filters.COMMAND, add_rel_type)],
            ADD_REL_SEARCH: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_rel_search)],
            ADD_REL_SELECT: [CallbackQueryHandler(add_rel_select, pattern="^addrel:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), cancel)],
    )

    edit_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^✏️ Edit Anggota$"), edit_member_start)],
        states={
            EDIT_SEARCH:        [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_search)],
            EDIT_SEARCH_SEL:    [CallbackQueryHandler(edit_search_sel, pattern="^edit:")],
            EDIT_FIELD:         [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_field)],
            EDIT_VALUE:         [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_value)],
            EDIT_REL_ACTION:    [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_rel_action)],
            EDIT_REL_ADD_TYPE:  [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_rel_add_type)],
            EDIT_REL_ADD_SEARCH:[MessageHandler(filters.TEXT & ~filters.COMMAND, edit_rel_add_search)],
            EDIT_REL_ADD_SEL:   [CallbackQueryHandler(edit_rel_add_sel, pattern="^erel:")],
            EDIT_REL_REMOVE:    [CallbackQueryHandler(edit_rel_remove, pattern="^rmrel:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), cancel)],
    )

    tree_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^🌳 Lihat Pohon$"), tree_start)],
        states={
            TREE_SEARCH: [MessageHandler(filters.TEXT & ~filters.COMMAND, tree_search)],
            TREE_SELECT: [CallbackQueryHandler(tree_select, pattern="^tree:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), cancel)],
    )

    list_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📋 Daftar Anggota$"), list_members_cmd)],
        states={
            LIST_PAGE: [CallbackQueryHandler(list_page_callback, pattern="^list:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), cancel)],
    )

    search_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^🔍 Cari Anggota$"), search_start)],
        states={
            SEARCH_QUERY:  [MessageHandler(filters.TEXT & ~filters.COMMAND, search_query)],
            SEARCH_SELECT: [CallbackQueryHandler(search_select, pattern="^detail:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), cancel)],
    )

    link_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^🔗 Hubungkan Anggota$"), link_start)],
        states={
            LINK_TYPE:     [MessageHandler(filters.TEXT & ~filters.COMMAND, link_type)],
            LINK_A_SEARCH: [MessageHandler(filters.TEXT & ~filters.COMMAND, link_a_search)],
            LINK_A_SELECT: [CallbackQueryHandler(link_a_select, pattern="^linkA:")],
            LINK_B_SEARCH: [MessageHandler(filters.TEXT & ~filters.COMMAND, link_b_search)],
            LINK_B_SELECT: [CallbackQueryHandler(link_b_select, pattern="^linkB:")],
        },
        fallbacks=[MessageHandler(filters.Regex("^❌ Batal$"), link_cancel)],
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("admin", admin_panel))
    app.add_handler(CommandHandler("daftarkan", cmd_daftarkan))
    app.add_handler(CommandHandler("cabut", cmd_cabut))
    app.add_handler(CommandHandler("daftar_user", cmd_daftar_user))
    app.add_handler(CommandHandler("admin_stats", admin_stats))
    app.add_handler(CommandHandler("admin_broadcast", admin_broadcast_start))
    app.add_handler(add_conv)
    app.add_handler(edit_conv)
    app.add_handler(tree_conv)
    app.add_handler(list_conv)
    app.add_handler(search_conv)
    app.add_handler(link_conv)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_broadcast))

    return app


async def run_webhook_server(ptb_app: Application):
    async def telegram_handler(request: web.Request) -> web.Response:
        token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if token != SECRET_TOKEN:
            return web.Response(status=403)
        data = await request.json()
        update = Update.de_json(data, ptb_app.bot)
        await ptb_app.process_update(update)
        return web.Response(status=200)

    async def health(request: web.Request) -> web.Response:
        return web.Response(text="ok")

    web_app = web.Application()
    web_app.router.add_post("/telegram", telegram_handler)
    web_app.router.add_get("/health", health)

    await ptb_app.initialize()
    await ptb_app.start()

    if WEBHOOK_URL:
        await ptb_app.bot.set_webhook(
            url=WEBHOOK_URL,
            secret_token=SECRET_TOKEN,
            allowed_updates=Update.ALL_TYPES,
        )
        logger.info(f"Webhook: {WEBHOOK_URL}")
    else:
        logger.info("Server berjalan tanpa webhook (WEBHOOK_URL belum diset)")

    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info(f"Listening on port {PORT}")
    await asyncio.Event().wait()


def main():
    ptb_app = build_app()
    if IS_CLOUD_RUN or WEBHOOK_URL:
        asyncio.run(run_webhook_server(ptb_app))
    else:
        logger.info("Polling mode...")
        ptb_app.run_polling()


if __name__ == "__main__":
    main()
