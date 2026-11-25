# Build stage
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install deps for native modules (sharp), prisma, and git (some npm deps require git)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates git && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies
RUN npm --prefix server install && npm --prefix client install

# Copy source
COPY server ./server
COPY client ./client

# Generate Prisma client
ENV DATABASE_URL="file:/data/statusvault.db"
RUN cd server && npx prisma generate --schema=prisma/schema.prisma

# Build client and server
RUN npm --prefix client run build
RUN npm --prefix server run build

# Copy prisma schema for runtime migrations
RUN mkdir -p /app/server/dist/prisma && cp -r /app/server/prisma /app/server/dist/

# Production stage
FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# Copy server node_modules and built artifacts
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/prisma ./server/prisma

# Copy client build
COPY --from=builder /app/client/dist ./client/dist

# Create data dir
RUN mkdir -p /data/auth /data/downloads /data/temp /data/media /data/thumbs

EXPOSE 3000

# Run prisma db push on startup for SQLite schema sync, then start server
CMD ["sh", "-c", "cd /app/server && npx prisma db push --schema=prisma/schema.prisma --skip-generate && node dist/index.js"]
