from functools import wraps
from telegram import Update
from telegram.ext import ContextTypes
from config import ADMIN_IDS
from db.firestore import get_db
from bot.keyboards import MAIN_MENU


def admin_only(func):
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        if update.effective_user.id not in ADMIN_IDS:
            await update.message.reply_text("⛔ Akses ditolak. Fitur ini khusus admin.")
            return
        return await func(update, context, *args, **kwargs)
    return wrapper


@admin_only
async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔐 *Admin Panel*\n\n"
        "Perintah yang tersedia:\n"
        "/admin\\_users — Lihat semua pengguna bot\n"
        "/admin\\_stats — Statistik penggunaan\n"
        "/admin\\_broadcast — Kirim pesan ke semua pengguna",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


@admin_only
async def admin_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    trees = db.collection("family_trees").stream()

    lines = ["👥 *Daftar Pengguna Bot*\n"]
    count = 0
    for doc in trees:
        members = list(doc.reference.collection("members").stream())
        lines.append(f"• User ID: `{doc.id}` — {len(members)} anggota")
        count += 1

    if count == 0:
        lines.append("Belum ada pengguna.")
    else:
        lines.append(f"\nTotal: {count} pengguna")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown", reply_markup=MAIN_MENU)


@admin_only
async def admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    trees = list(db.collection("family_trees").stream())

    total_users = len(trees)
    total_members = sum(
        len(list(doc.reference.collection("members").stream()))
        for doc in trees
    )

    await update.message.reply_text(
        f"📊 *Statistik Bot*\n\n"
        f"👤 Total pengguna: {total_users}\n"
        f"🌳 Total anggota keluarga: {total_members}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


@admin_only
async def admin_broadcast_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📢 Ketik pesan yang ingin dikirim ke semua pengguna:",
        reply_markup=MAIN_MENU,
    )
    context.user_data["awaiting_broadcast"] = True


async def handle_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.get("awaiting_broadcast"):
        return False
    if update.effective_user.id not in ADMIN_IDS:
        return False

    context.user_data.pop("awaiting_broadcast")
    message = update.message.text
    db = get_db()
    trees = db.collection("family_trees").stream()

    success = 0
    failed = 0
    for doc in trees:
        try:
            await context.bot.send_message(
                chat_id=int(doc.id),
                text=f"📢 *Pesan dari Admin*\n\n{message}",
                parse_mode="Markdown",
            )
            success += 1
        except Exception:
            failed += 1

    await update.message.reply_text(
        f"✅ Broadcast selesai.\nTerkirim: {success} | Gagal: {failed}",
        reply_markup=MAIN_MENU,
    )
    return True
