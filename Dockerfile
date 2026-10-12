FROM node:24-slim AS base
# Generate and consume the hook-bound lock with the same installer everywhere.
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml .pnpmfile.cjs ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV DATABASE_URL="file:/app/prisma/build.db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma migrate deploy
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
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
# Copy full node_modules from builder (includes generated Prisma Client + CLI)
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/data /app/db /tmp/ludotek-uploads && \
    chown node:node /app/data /app/db /app/prisma /tmp/ludotek-uploads && \
    chmod 700 /app/data /tmp/ludotek-uploads && chmod 755 ./docker-entrypoint.sh
USER node

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/db/ludotek.db"

CMD ["./docker-entrypoint.sh"]
