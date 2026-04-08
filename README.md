# en-learner

A production-quality desktop app for learning English vocabulary.

Combines a Cambridge Dictionary-style word lookup experience with Quizlet-style spaced repetition flashcards — entirely offline-friendly, no subscriptions required.

---

## Architecture

```
en-learner/
├── apps/
│   ├── frontend/        React + Vite + TailwindCSS + TanStack Query + Zustand
│   ├── backend/         Rust + Axum + Postgres (sqlx)
│   └── desktop/         C++ + webview.h + CMake (native desktop shell)
├── packages/
│   └── shared/          TypeScript types shared between frontend and backend API contract
├── turbo.json           Turborepo orchestration
└── package.json         Root workspace
```

**Independent parts:**
```
Backend (Rust)  → standalone API service, deployable publicly on Postgres
Frontend (React) → standalone SPA with configurable API base URL
Desktop (C++)   → native shell that can reuse or start a backend and load either:
                  - Vite dev server in development
                  - built frontend files in production
                  - native SQLite-backed desktop config/auth/runtime state from disk
```

**Offline / online split:**
- C++ owns on-device runtime state and local SQLite storage on the user device.
- Rust is the remote server boundary: internet-backed dictionary/translation calls, shared public test links, and remote account auth.
- Frontend can talk to both: native bridge for local desktop capabilities, Rust API for online features.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Rust + Cargo | stable (1.75+) |
| CMake | ≥ 3.20 |
| C++17 compiler | GCC 10+ / Clang 12+ / MSVC 2019+ |

**Linux:** WebKitGTK required:
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential cmake pkg-config

# Fedora
sudo dnf install webkit2gtk4.1-devel cmake gcc-c++

# Arch
sudo pacman -S webkit2gtk-4.1 cmake base-devel
```

**macOS:** WebKit is bundled with macOS (Xcode Command Line Tools needed).

**Windows:** WebView2 Runtime (ships with Windows 11 / Edge; installer available from Microsoft).

---

## Quick start (development)

### 1. Install dependencies

```bash
git clone <repo>
cd en-learner
npm install
```

### 2. Download webview.h

```bash
cd apps/desktop && bash scripts/download_deps.sh && cd ../..
```

### 3. Run frontend + backend (hot reload)

**Terminal 1 — Backend dependencies:**
```bash
docker compose up -d postgres
```

**Terminal 2 — Backend:**
```bash
npm run backend:dev
# or: cd apps/backend && cargo run
```

**Terminal 2 — Frontend:**
```bash
npm run dev:frontend
# or: cd apps/frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001
Postgres: `postgres://en_learner:en_learner@127.0.0.1:5432/en_learner`

### Docker Compose

```bash
docker compose up -d postgres backend
```

This starts:
- Postgres on `localhost:5432`
- Rust backend on `localhost:3001`

### 4. Run the desktop shell (optional)

```bash
# Build backend first in release or use dev binary
cd apps/desktop
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
./build/en-learner
```

In development the shell opens the Vite frontend and injects the backend API URL at runtime.

---

## Building for production

```bash
npm run build:frontend
npm run build:backend
npm run build:desktop
```

Each artifact can be shipped separately:

- Backend: `apps/backend/target/release/en-learner-backend`
- Frontend: `apps/frontend/dist/`
- Desktop: `apps/desktop/build/en-learner`

Production desktop defaults to the local frontend build and a local backend API:

```bash
./apps/desktop/build/en-learner
```

You can override that wiring explicitly:

```bash
EN_LEARNER_FRONTEND_URL=https://frontend.example.com \
EN_LEARNER_BACKEND_URL=https://api.example.com \
EN_LEARNER_SPAWN_BACKEND=false \
EN_LEARNER_PUBLIC_APP_URL=https://frontend.example.com \
./apps/desktop/build/en-learner
```

If you want the backend to serve the frontend as a convenience deployment mode, enable it explicitly:

```bash
SERVE_FRONTEND=true FRONTEND_DIST_DIR=./apps/frontend/dist cargo run --manifest-path apps/backend/Cargo.toml
```

---

## Turborepo commands

| Command | What it does |
|---------|-------------|
| `turbo dev` | Runs all dev tasks in parallel |
| `turbo build` | Builds all packages |
| `turbo lint` | Lints all packages |
| `turbo type-check` | TypeScript checks |
| `npm run backend:test` | Run Rust tests |
| `npm run backend:dev` | Cargo run (watch mode) |

---

## Backend API reference

Base URL: `http://127.0.0.1:3001/api`

Health check: `GET /health`

### Words
| Method | Path | Description |
|--------|------|-------------|
| GET | `/words/search?q={word}` | Search + translate a word |
| GET | `/words/:id` | Get word by ID |
| GET | `/words/saved` | List all saved words |
| POST | `/words/:id/save` | Save a word |
| DELETE | `/words/:id/save` | Unsave a word |
| POST | `/words/:id/favorite` | Mark as favorite |
| DELETE | `/words/:id/favorite` | Unmark favorite |
| GET | `/favorites` | List favorites |

### Study sets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sets` | List sets |
| POST | `/sets` | Create set |
| GET | `/sets/:id` | Get set |
| PUT | `/sets/:id` | Update set |
| DELETE | `/sets/:id` | Delete set |
| GET | `/sets/:id/words` | List words in set |
| POST | `/sets/:id/words` | Add word to set |
| DELETE | `/sets/:id/words/:word_id` | Remove word from set |

### Review
| Method | Path | Description |
|--------|------|-------------|
| GET | `/review/session?set_id=&limit=` | Start review session |
| POST | `/review/submit` | Submit review rating |
| GET | `/review/session/:id/summary` | Session summary |
| POST | `/sets/:id/share-test` | Create or reuse a public test link for a set |
| GET | `/public/tests/:token` | Fetch the public flashcard deck behind a shared link |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/stats` | Dashboard statistics |
| GET | `/history` | Search history |
| POST | `/history` | Record a search |
| GET | `/settings` | App settings |
| PUT | `/settings` | Update settings |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/providers` | List configured remote auth providers |
| POST | `/auth/register` | Create a remote account with email/password |
| POST | `/auth/login` | Sign in with email/password |
| POST | `/auth/logout` | Revoke the current remote session |
| GET | `/auth/me` | Inspect the current remote session |
| POST | `/auth/oauth/:provider/start` | Start Google/GitHub/Microsoft/Discord auth |
| GET | `/auth/oauth/:provider/callback` | Provider callback endpoint |
| GET | `/auth/oauth/status/:state` | Poll OAuth completion state from frontend/desktop |

---

## Database

Rust backend now uses Postgres through `sqlx`.

Default local server URL:
`postgres://en_learner:en_learner@127.0.0.1:5432/en_learner`

Migrations run automatically on startup through `sqlx` migrations.

Desktop shell settings use a separate native SQLite file:
- Linux/macOS default: `~/.local/share/en-learner/desktop.db`
- Override with `EN_LEARNER_NATIVE_DB_PATH=/path/to/desktop.db`

Desktop SQLite persists:
- desktop backend URL override
- connectivity mode (`auto` / `offline` / `online`)
- guest profile name
- cached remote auth session

That split is intentional:
- C++ / device runtime: SQLite
- Rust / shared server runtime: Postgres

**Schema summary:**
- `words`, `phonetics`, `meanings`, `definitions` — dictionary data
- `translations` — cached translations per language
- `saved_words`, `favorites` — user library
- `study_sets`, `study_set_words` — sets
- `review_cards`, `review_logs`, `review_sessions` — SRS state
- `search_history`, `daily_stats`, `app_settings` — metadata

---

## Spaced repetition algorithm

Inspired by Anki's SM-2 variant. Cards have four states: **New → Learning → Review**, and **Relearning** on lapse.

Rating mapping:
| Rating | Effect |
|--------|--------|
| Again | Reset to short interval (1–10 min), decrease ease |
| Hard | Small interval growth, decrease ease |
| Good | Standard growth by ease factor |
| Easy | Large growth + ease bonus |

Implementation: `apps/backend/src/services/review_engine.rs`

---

## External APIs

| Service | URL | Usage |
|---------|-----|-------|
| Free Dictionary API | `api.dictionaryapi.dev` | Word definitions, phonetics |
| Lingva Translate | `lingva.ml` | EN→UK translation |

Both are wrapped behind Rust services. The frontend never calls them directly. Responses are cached locally after first fetch.

The translator uses a `TranslatorProvider` trait — swap `LingvaTranslator` for any alternative (LibreTranslate, MyMemory, etc.) without changing the API layer.

Remote auth providers are enabled only when their server-side credentials are configured. Current built-in providers:
- Email/password
- Google OAuth
- GitHub OAuth
- Microsoft OAuth
- Discord OAuth
- Apple is listed as a server-side placeholder but not enabled in this build yet

---

## Environment variables

Copy `.env.example` to `.env`:

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=3001
VITE_API_BASE_URL=http://127.0.0.1:3001
VITE_PUBLIC_APP_URL=https://app.example.com
SERVE_FRONTEND=false
RUST_LOG=info
```

### Backend

- `BACKEND_HOST` or `HOST`: bind host
- `BACKEND_PORT` or `PORT`: bind port
- `DATABASE_URL`: required Postgres connection URL
- `SERVE_FRONTEND`: opt-in static frontend hosting
- `FRONTEND_DIST_DIR`: dist path used when `SERVE_FRONTEND=true`
- `GET /health`: simple health endpoint for Render or other public platforms

### Frontend

- `VITE_API_BASE_URL`: build-time fallback for API requests
- `VITE_PUBLIC_APP_URL`: public frontend base used when generating shareable public test links
- `window.__EN_LEARNER_RUNTIME_CONFIG.apiBaseUrl`: runtime override for desktop or external hosting

The frontend uses hash-based routing, so the built SPA can be opened from static hosting or directly from local files without server-side route rewrites.

### Desktop

- `EN_LEARNER_FRONTEND_URL`: explicit frontend URL
- `EN_LEARNER_FRONTEND_DIST_DIR`: override local built frontend path
- `EN_LEARNER_BACKEND_URL`: explicit API base URL injected into the frontend
- `EN_LEARNER_PUBLIC_APP_URL`: override the copied public test-link base in desktop builds
- If `EN_LEARNER_BACKEND_URL` is unset, the desktop shell derives the local API URL from `BACKEND_HOST`/`HOST` and `BACKEND_PORT`/`PORT`
- `EN_LEARNER_SPAWN_BACKEND`: `true` or `false`
- `EN_LEARNER_BACKEND_EXE`: explicit backend binary path
- `EN_LEARNER_NATIVE_DB_PATH`: explicit path for the desktop shell SQLite config file

### Public backend deploy

```bash
BACKEND_HOST=0.0.0.0 PORT=3001 cargo run --manifest-path apps/backend/Cargo.toml
```

### Public test links

- Generate them from a set with the `Copy test link` action
- Web route format: `/#/public/tests/:token`
- API route format: `/api/public/tests/:token`

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search bar |
| `Enter` | Submit search / confirm |
| `Space` | Reveal flashcard answer |
| `1` | Rate: Again |
| `2` | Rate: Hard |
| `3` | Rate: Good |
| `4` | Rate: Easy |
| `Escape` | Close modal |

---

## Future improvements

- [ ] **Audio cache** — download and cache pronunciation MP3s locally
- [ ] **Offline fallback UI** — show cached data when backend is unreachable
- [ ] **Import/export** — Anki `.apkg` / CSV import/export
- [ ] **Word lists** — curated vocabulary packs (B2, C1, IELTS, etc.)
- [ ] **Sentence mode** — search by example sentence, not just word
- [ ] **Progress charts** — retention curves, review heatmap calendar
- [ ] **Multiple languages** — not just EN→UK; configurable source/target
- [ ] **Tray icon** — quick review from system tray without opening full window
- [ ] **Backend static file serving** — serve built frontend from Rust (`tower_http::services::ServeDir`) for single-binary distribution
- [ ] **Auto-updater** — check GitHub releases and prompt to update
- [ ] **Sync** — optional cloud sync via user-owned S3/R2 bucket

---

## Tradeoffs

| Decision | Rationale |
|----------|-----------|
| `sqlx` + Postgres in Rust backend | Fits public server mode, async Axum handlers, pooled connections, and clean separation from device-local state |
| webview.h over Electron/Tauri | No Node.js runtime, no Rust/IPC complexity — direct C++ thin shell, ~200KB binary |
| lingva.ml for translation | Free, open API; wrapped behind a trait so it can be swapped without API changes |
| Native SQLite in C++ shell | Keeps device-local runtime/auth/cache state offline on the user laptop without coupling it to the server DB |
| Turborepo for Rust/C++ | Not native to Turbo, but custom scripts integrate cleanly via `turbo.json` tasks |
