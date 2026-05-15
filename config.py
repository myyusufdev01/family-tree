import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID")

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN tidak ditemukan di .env")
if not FIRESTORE_PROJECT_ID:
    raise ValueError("FIRESTORE_PROJECT_ID tidak ditemukan di .env")
