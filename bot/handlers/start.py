from telegram import Update
from telegram.ext import ContextTypes
from bot.keyboards import MAIN_MENU


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    name = update.effective_user.first_name
    await update.message.reply_text(
        f"Halo, {name}! 👋\n\n"
        "Selamat datang di *Family Tree Bot* 🌳\n\n"
        "Dengan bot ini kamu bisa:\n"
        "• Tambah anggota keluarga\n"
        "• Lihat silsilah keluarga\n"
        "• Cari anggota keluarga\n"
        "• Hubungkan relasi antar anggota\n\n"
        "Pilih menu di bawah untuk memulai:",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "*Panduan Penggunaan* 📖\n\n"
        "➕ *Tambah Anggota* — Input data anggota keluarga baru\n"
        "🌳 *Lihat Pohon* — Tampilkan silsilah keluarga\n"
        "🔍 *Cari Anggota* — Cari berdasarkan nama\n"
        "🔗 *Hubungkan Anggota* — Atur relasi orang tua-anak atau pasangan\n"
        "📋 *Daftar Anggota* — Lihat semua anggota\n\n"
        "Ketik /start untuk kembali ke menu utama.",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )
