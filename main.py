import asyncio
import logging
import os
from aiohttp import web
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    TypeHandler,
    filters,
)

import config
from bot.middleware import check_approved
from bot.handlers.start import start, help_command
from bot.handlers.tree import view_tree
from bot.handlers.member import (
    add_member_start, add_name, add_gender, add_birth, add_death, add_phone, add_notes,
    add_rel_type, add_rel_target,
    edit_member_start, edit_select, edit_field, edit_value,
    list_members_cmd, cancel,
)
from bot.handlers.search import search_start, search_query, search_select, SEARCH_QUERY, SEARCH_SELECT
from bot.handlers.link import link_start, link_type, link_member_a, link_member_b, cancel as link_cancel
from bot.handlers.admin import (
    admin_panel, admin_stats, admin_broadcast_start, handle_broadcast,
    cmd_daftarkan, cmd_cabut, cmd_daftar_user,
)
from bot.states import (
    ADD_NAME, ADD_GENDER, ADD_BIRTH, ADD_DEATH, ADD_PHONE, ADD_NOTES,
    ADD_REL_TYPE, ADD_REL_TARGET,
    EDIT_SELECT, EDIT_FIELD, EDIT_VALUE,
    LINK_TYPE, LINK_MEMBER_A, LINK_MEMBER_B,
)

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

PORT = int(os.getenv("PORT", 8080))
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")
IS_CLOUD_RUN = bool(os.getenv("K_SERVICE"))
SECRET_TOKEN = config.TELEGRAM_BOT_TOKEN.replace(":", "_")


def build_app() -> Application:
    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()

    # Group -1: cek approval sebelum semua handler lain
    app.add_handler(TypeHandler(Update, check_approved), group=-1)

    add_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^➕ Tambah Anggota$"), add_member_start)],
        states={
            ADD_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_name)],
            ADD_GENDER: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_gender)],
            ADD_BIRTH: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_birth)],
            ADD_DEATH: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_death)],
            ADD_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_phone)],
            ADD_NOTES: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_notes)],
            ADD_REL_TYPE: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_rel_type)],
            ADD_REL_TARGET: [CallbackQueryHandler(add_rel_target, pattern="^addrel:")],
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

    app.add_handler(CommandHandler("admin", admin_panel))
    app.add_handler(CommandHandler("daftarkan", cmd_daftarkan))
    app.add_handler(CommandHandler("cabut", cmd_cabut))
    app.add_handler(CommandHandler("daftar_user", cmd_daftar_user))
    app.add_handler(CommandHandler("admin_stats", admin_stats))
    app.add_handler(CommandHandler("admin_broadcast", admin_broadcast_start))
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
        logger.info(f"Webhook terdaftar: {WEBHOOK_URL}")
    else:
        logger.info("WEBHOOK_URL belum diset — server berjalan tanpa registrasi webhook")

    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info(f"Server berjalan di port {PORT}")

    await asyncio.Event().wait()


def main():
    ptb_app = build_app()

    if IS_CLOUD_RUN or WEBHOOK_URL:
        asyncio.run(run_webhook_server(ptb_app))
    else:
        logger.info("Bot berjalan dengan polling...")
        ptb_app.run_polling()


if __name__ == "__main__":
    main()
