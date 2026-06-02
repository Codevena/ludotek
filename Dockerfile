FROM node:20-slim AS base
# Pin pnpm to the last 9.x: pnpm 10.10+/11 require the `node:sqlite` builtin,
# which node:20 does not provide (added in Node 22.5+ / stable in 24), so
# `pnpm@latest` breaks `pnpm install` here. 9.15.9 reads the v9.0 lockfile fine.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

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
