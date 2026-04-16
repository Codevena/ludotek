FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV DATABASE_URL="file:/app/prisma/build.db"
RUN npx prisma migrate deploy || npx prisma db push --skip-generate
RUN pnpm build
RUN rm -f /app/prisma/build.db

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    mame-tools openssl \
    && rm -rf /var/lib/apt/lists/*
# DolphinTool for GameCube ISO->RVZ (optional)
# To enable: place a Linux DolphinTool binary in the repo root, then uncomment:
# COPY DolphinTool /usr/local/bin/DolphinTool
# RUN chmod +x /usr/local/bin/DolphinTool
# The converter gracefully skips RVZ conversion if DolphinTool is absent.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Copy full node_modules from builder (includes generated Prisma Client + CLI)
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node server.js"]
