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
# Place a Linux DolphinTool binary in repo root; it will be copied automatically.
# The converter gracefully skips RVZ if DolphinTool is absent.
COPY DolphinToo[l] /usr/local/bin/DolphinTool
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
