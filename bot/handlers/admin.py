from functools import wraps
from telegram import Update
from telegram.ext import ContextTypes
from config import ADMIN_IDS
from db.firestore import get_db, approve_user, revoke_user, list_approved_users
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
        "👥 *Kelola Pengguna:*\n"
        "/daftarkan `<user_id>` `<nama>` — Daftarkan pengguna baru\n"
        "/cabut `<user_id>` — Cabut akses pengguna\n"
        "/daftar\\_user — Lihat semua pengguna terdaftar\n\n"
        "📊 *Statistik:*\n"
        "/admin\\_stats — Statistik penggunaan\n\n"
        "📢 *Broadcast:*\n"
        "/admin\\_broadcast — Kirim pesan ke semua pengguna",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


@admin_only
async def cmd_daftarkan(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text(
            "Penggunaan: `/daftarkan <user_id> <nama>`\nContoh: `/daftarkan 123456789 Budi Santoso`",
            parse_mode="Markdown",
        )
        return

    try:
        target_id = int(args[0])
    except ValueError:
        await update.message.reply_text("❌ User ID harus berupa angka.")
        return

    name = " ".join(args[1:]) if len(args) > 1 else ""
    admin_id = update.effective_user.id

    approve_user(target_id, name=name, added_by=admin_id)

    await update.message.reply_text(
        f"✅ Pengguna berhasil didaftarkan.\n\n"
        f"🆔 ID: `{target_id}`\n"
        f"👤 Nama: {name or '(tidak diisi)'}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )

    try:
        await context.bot.send_message(
            chat_id=target_id,
            text="✅ Akun Anda telah didaftarkan oleh admin.\nKetik /start untuk mulai menggunakan bot.",
        )
    except Exception:
        await update.message.reply_text("⚠️ Gagal mengirim notifikasi ke pengguna (mungkin belum pernah start bot).")


@admin_only
async def cmd_cabut(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text(
            "Penggunaan: `/cabut <user_id>`",
            parse_mode="Markdown",
        )
        return

    try:
        target_id = int(args[0])
    except ValueError:
        await update.message.reply_text("❌ User ID harus berupa angka.")
        return

    if target_id in ADMIN_IDS:
        await update.message.reply_text("❌ Tidak bisa mencabut akses admin.")
        return

    revoke_user(target_id)
    await update.message.reply_text(
        f"✅ Akses pengguna `{target_id}` telah dicabut.",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


@admin_only
async def cmd_daftar_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    users = list_approved_users()

    if not users:
        await update.message.reply_text("Belum ada pengguna terdaftar.", reply_markup=MAIN_MENU)
        return

    lines = [f"👥 *Pengguna Terdaftar* ({len(users)})\n"]
    for u in users:
        name = u.get("name") or "(tanpa nama)"
        uid = u.get("user_id", "?")
        lines.append(f"• `{uid}` — {name}")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown", reply_markup=MAIN_MENU)


@admin_only
async def admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    trees = list(db.collection("family_trees").stream())
    approved = list_approved_users()

    total_members = sum(
        len(list(doc.reference.collection("members").stream()))
        for doc in trees
    )

    await update.message.reply_text(
        f"📊 *Statistik Bot*\n\n"
        f"👤 Pengguna terdaftar: {len(approved)}\n"
        f"🌳 Total anggota keluarga: {total_members}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


@admin_only
async def admin_broadcast_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("📢 Ketik pesan yang ingin dikirim ke semua pengguna terdaftar:")
    context.user_data["awaiting_broadcast"] = True


async def handle_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.get("awaiting_broadcast"):
        return False
    if update.effective_user.id not in ADMIN_IDS:
        return False

    context.user_data.pop("awaiting_broadcast")
    message = update.message.text
    users = list_approved_users()

    success = 0
    failed = 0
    for u in users:
        try:
            await context.bot.send_message(
                chat_id=int(u["user_id"]),
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
