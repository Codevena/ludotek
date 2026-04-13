FROM node:20-alpine AS base

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
RUN pnpm build

# Build DolphinTool from source (GameCube ISO -> RVZ conversion)
FROM debian:bookworm-slim AS dolphin-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    git cmake ninja-build g++ pkg-config \
    libfmt-dev liblzo2-dev libzstd-dev libminizip-dev liblzma-dev \
    libcurl4-openssl-dev libmbedtls-dev libspng-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN git clone --depth=1 https://github.com/dolphin-emu/dolphin.git && \
    cd dolphin && \
    git submodule update --init --depth=1 Externals/cpp-optparse Externals/minizip-ng
RUN cd dolphin && mkdir build && cd build && \
    cmake .. -GNinja \
      -DCMAKE_BUILD_TYPE=Release \
      -DENABLE_QT=OFF \
      -DENABLE_NOGUI=OFF \
      -DENABLE_CLI_TOOL=ON \
      -DENABLE_TESTS=OFF \
      -DUSE_SYSTEM_FMT=ON \
      -DUSE_SYSTEM_ZSTD=ON \
      -DUSE_SYSTEM_LZO=ON \
      -DUSE_SYSTEM_MINIZIP=ON \
      -DUSE_SYSTEM_SPNG=ON \
      -DUSE_SYSTEM_MBEDTLS=ON \
      -DUSE_SYSTEM_CURL=ON && \
    ninja dolphin-tool

# Runner uses Debian slim for glibc compatibility (mame-tools + DolphinTool)
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    mame-tools openssl \
    libfmt9 liblzo2-2 libzstd1 libminizip1 liblzma5 \
    libcurl4 libmbedtls14 libspng0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=dolphin-builder /build/dolphin/build/Binaries/dolphin-tool /usr/local/bin/DolphinTool
RUN chmod +x /usr/local/bin/DolphinTool
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
