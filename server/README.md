# Book Studio — Server

Hono/Node.js backend for Book Studio. Provides REST API, AI routing (Ollama / Gemini / AnythingLLM), Kokoro TTS, and local file storage, backed by MariaDB via Prisma.

---

## Quick Start (Development)

### Prerequisites
- Node.js 22+
- MariaDB 11 running locally (or via Docker: `docker run -d -p 3306:3306 -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=bookstudio -e MARIADB_USER=bookstudio -e MARIADB_PASSWORD=bookstudio mariadb:11`)
- (Optional) Ollama: https://ollama.ai
- (Optional) Kokoro TTS: https://github.com/remsky/Kokoro-FastAPI

### Setup

```bash
# 1. Install dependencies
cd server
npm install

# 2. Copy and edit environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, AI provider settings, etc.

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Start the dev server (watches for changes)
npm run dev
```

The API will be available at `http://localhost:3001`.

The frontend Vite dev server (port 3000) proxies `/api/*` to port 3001 automatically.

---

## Production (Docker Compose)

```bash
# 1. Copy root .env.example to .env
cp .env.example .env
# Fill in DB passwords, AI provider config, etc.

# 2. Build and start everything
docker compose up --build -d

# App will be at http://localhost (port 80 by default)
```

Services:
- `db` — MariaDB 11
- `backend` — Hono/Node.js API (internal port 3001)
- `nginx` — Serves the React frontend + proxies `/api/` to backend

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | MariaDB connection string |
| `PORT` | `3001` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `FILES_DIR` | `./data/files` | Local filesystem path for uploaded files |
| `AI_PROVIDER` | `ollama` | `ollama` \| `gemini` \| `anythingllm` |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `OLLAMA_DEFAULT_MODEL` | `llama3.2` | Default Ollama model |
| `ANYTHINGLLM_URL` | — | AnythingLLM base URL |
| `ANYTHINGLLM_API_KEY` | — | AnythingLLM API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `KOKORO_URL` | — | Kokoro TTS HTTP API URL |
| `KOKORO_CLI_PATH` | — | Path to Kokoro CLI binary (alternative to URL) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

---

## Migrating from Browser IndexedDB

1. Open the app in the browser that has the existing IndexedDB data.
2. Go to **Settings → System → Import from Browser Storage**.
3. Click the button — it reads IndexedDB and POSTs to `/api/migrate`.
4. Reload the page.

This is safe to run multiple times (upsert semantics).

---

## API Routes

| Prefix | Description |
|---|---|
| `GET /api/health` | Health check |
| `/api/books` | Books CRUD |
| `/api/documents` | General documents CRUD |
| `/api/instructions` | Instruction templates CRUD |
| `/api/styles` | Style presets CRUD |
| `/api/snapshots` | Book snapshots CRUD |
| `/api/macros` | Macros CRUD |
| `/api/series` | Book series CRUD |
| `/api/reading-progress` | Reading progress CRUD |
| `/api/settings` | App settings CRUD |
| `/api/history` | Undo/redo history CRUD |
| `/api/files` | File upload + serve |
| `/api/ai/*` | AI generate/stream/TTS/config |
| `POST /api/migrate` | IndexedDB → MariaDB migration |
