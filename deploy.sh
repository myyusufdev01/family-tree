#!/bin/bash
set -e

# ── Konfigurasi ─────────────────────────────────────────────
PROJECT_ID="family-tree-496412"
REGION="asia-southeast1"
SERVICE_NAME="family-tree-bot"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# ── Baca nilai env dari frontend/.env.local bila belum di-set ──
load_env() {
  [ -f "frontend/.env.local" ] || return 0
  while IFS='=' read -r key value; do
    case "$key" in
      \#*|"") continue ;;
    esac
    export "$key=$value"
  done < "frontend/.env.local"
}
load_env

NEXT_PUBLIC_AUTH0_DOMAIN="${NEXT_PUBLIC_AUTH0_DOMAIN:-}"
NEXT_PUBLIC_AUTH0_CLIENT_ID="${NEXT_PUBLIC_AUTH0_CLIENT_ID:-}"
AUTH0_DOMAIN="${AUTH0_DOMAIN:-$NEXT_PUBLIC_AUTH0_DOMAIN}"
ADMIN_SUBS="${ADMIN_SUBS:-}"

if [ -z "$NEXT_PUBLIC_AUTH0_DOMAIN" ] || [ -z "$NEXT_PUBLIC_AUTH0_CLIENT_ID" ]; then
  echo "ERROR: NEXT_PUBLIC_AUTH0_DOMAIN & NEXT_PUBLIC_AUTH0_CLIENT_ID harus diisi"
  echo "       (biasanya sudah ada di frontend/.env.local)."
  exit 1
fi

echo "==> [1/4] Mengaktifkan GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  --project="$PROJECT_ID"

echo "==> [2/4] Build & push Docker image..."
gcloud builds submit \
  --tag "$IMAGE" \
  --project="$PROJECT_ID" \
  --build-arg NEXT_PUBLIC_AUTH0_DOMAIN="$NEXT_PUBLIC_AUTH0_DOMAIN" \
  --build-arg NEXT_PUBLIC_AUTH0_CLIENT_ID="$NEXT_PUBLIC_AUTH0_CLIENT_ID"

echo "==> [3/4] Deploy ke Cloud Run..."
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
  --set-env-vars "FIRESTORE_PROJECT_ID=$PROJECT_ID,AUTH0_DOMAIN=$AUTH0_DOMAIN,ADMIN_SUBS=$ADMIN_SUBS" \
  --service-account "firebase-adminsdk@$PROJECT_ID.iam.gserviceaccount.com" \
  --project="$PROJECT_ID"

echo "==> [4/4] Verifikasi..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project="$PROJECT_ID" \
  --format "value(status.url)")

echo ""
echo "✅ Deploy selesai!"
echo "   Aplikasi : $SERVICE_URL"
echo "   Health   : $SERVICE_URL/api/health"

