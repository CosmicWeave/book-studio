# ─── Stage 1: install + generate Prisma client ──────────────────────────────
FROM node:22.14-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate

# ─── Stage 2: build TypeScript ───────────────────────────────────────────────
FROM node:22.14-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
RUN npm run build

# ─── Stage 3: production image ───────────────────────────────────────────────
FROM node:22.14-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY package.json ./

# Create the files directory
RUN mkdir -p /data/files

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
