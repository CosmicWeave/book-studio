# ─── Stage 1: build the React app ───────────────────────────────────────────
FROM node:22.14-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Build for production – base is '/' because Nginx serves from root
RUN npm run sync-manifest && npx vite build --base / && touch dist/.nojekyll

# ─── Stage 2: Nginx image ────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
