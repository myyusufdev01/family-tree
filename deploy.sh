#!/bin/bash
set -e

# ── Konfigurasi ─────────────────────────────────────────────
PROJECT_ID="family-tree-hdjon"
REGION="asia-southeast1"
SERVICE_NAME="family-tree-bot"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# ── Validasi env vars ────────────────────────────────────────
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "ERROR: Set environment variable TELEGRAM_BOT_TOKEN terlebih dahulu"
  exit 1
fi

echo "==> [1/5] Mengaktifkan GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  --project="$PROJECT_ID"

echo "==> [2/5] Build & push Docker image ke Container Registry..."
gcloud builds submit \
  --tag "$IMAGE" \
  --project="$PROJECT_ID"

echo "==> [3/5] Simpan BOT TOKEN ke Secret Manager..."
echo -n "$TELEGRAM_BOT_TOKEN" | gcloud secrets create telegram-bot-token \
  --data-file=- \
  --project="$PROJECT_ID" 2>/dev/null || \
echo -n "$TELEGRAM_BOT_TOKEN" | gcloud secrets versions add telegram-bot-token \
  --data-file=- \
  --project="$PROJECT_ID"

echo "==> [4/5] Deploy ke Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "FIRESTORE_PROJECT_ID=$PROJECT_ID" \
  --set-secrets "TELEGRAM_BOT_TOKEN=telegram-bot-token:latest" \
  --service-account "firebase-adminsdk@$PROJECT_ID.iam.gserviceaccount.com" \
  --project="$PROJECT_ID"

echo "==> [5/5] Set Telegram Webhook..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project="$PROJECT_ID" \
  --format "value(status.url)")

WEBHOOK_URL="$SERVICE_URL/telegram"
echo "Service URL: $SERVICE_URL"
echo "Webhook URL: $WEBHOOK_URL"

# Update Cloud Run env var WEBHOOK_URL
gcloud run services update "$SERVICE_NAME" \
  --region "$REGION" \
  --project="$PROJECT_ID" \
  --set-env-vars "FIRESTORE_PROJECT_ID=$PROJECT_ID,WEBHOOK_URL=$WEBHOOK_URL"

# Daftarkan webhook ke Telegram
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}" | python3 -m json.tool

echo ""
echo "✅ Deploy selesai!"
echo "   Bot URL : $SERVICE_URL"
echo "   Webhook  : $WEBHOOK_URL"
