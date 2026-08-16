# =============================================================================
# Family Tree — image Cloud Run untuk aplikasi Next.js terpadu (UI + API +
# akses Firestore via Route Handlers). Build context = root repo.
#
# Env publik (NEXT_PUBLIC_AUTH0_DOMAIN / NEXT_PUBLIC_AUTH0_CLIENT_ID) di-inline
# saat build, jadi dikirim lewat build-arg. Env server (FIRESTORE_PROJECT_ID,
# AUTH0_DOMAIN, ADMIN_SUBS) disuntik saat deploy — dibaca runtime, bukan build.
# =============================================================================

# ── Stage 1: install dependensi & build ──────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Cache layer dependensi terpisah dari source
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Source aplikasi
COPY frontend/ ./

# Env publik untuk proses build (di-inline ke bundle browser)
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN \
    NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID

RUN npm run build

# ── Stage 2: runtime minimal (standalone output) ─────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Jalankan sebagai user non-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]

