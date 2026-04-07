# en-learner

A production-quality desktop app for learning English vocabulary.

Combines a Cambridge Dictionary-style word lookup experience with Quizlet-style spaced repetition flashcards — entirely offline-friendly, no subscriptions required.

---

## Architecture

```
en-learner/
├── apps/
│   ├── frontend/        React + Vite + TailwindCSS + TanStack Query + Zustand
│   ├── backend/         Rust + Axum + SQLite (rusqlite + r2d2)
│   └── desktop/         C++ + webview.h + CMake (native desktop shell)
├── packages/
│   └── shared/          TypeScript types shared between frontend and backend API contract
├── turbo.json           Turborepo orchestration
└── package.json         Root workspace
```

**Data flow:**
```
Desktop (C++) → spawns → Backend (Rust) → proxies → dictionaryapi.dev + lingva.ml
                                        ← caches in SQLite
Frontend (React) → HTTP → Backend API
Desktop → loads → Frontend (Vite dev server OR built static files)
```

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

**Terminal 1 — Backend:**
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

### 4. Run the desktop shell (optional)

```bash
# Build backend first in release or use dev binary
cd apps/desktop
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
./build/en-learner
```

The shell will find and launch the backend, wait for it, then open the webview.

---

## Building for production

```bash
# 1. Build frontend
npm run build:frontend

# 2. Build backend
npm run build:backend

# 3. Build desktop shell
npm run build:desktop
```

To serve built frontend files from the backend, copy `apps/frontend/dist/` next to the backend binary and enable the static file middleware (see `apps/backend/src/main.rs` — add `tower_http::services::ServeDir`).

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

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/stats` | Dashboard statistics |
| GET | `/history` | Search history |
| POST | `/history` | Record a search |
| GET | `/settings` | App settings |
| PUT | `/settings` | Update settings |

---

## Database

SQLite at `~/.local/share/en-learner/data.db` (Linux/macOS).

Override with `DATABASE_URL=sqlite:/path/to/db`.

Migrations run automatically on startup via `rusqlite_migration`.

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

---

## Environment variables

Copy `.env.example` to `.env`:

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=3001
VITE_API_BASE_URL=http://127.0.0.1:3001
RUST_LOG=info
```

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
| `rusqlite` over `sqlx` | Simpler for desktop — no async DB driver, connection pool via r2d2, no compile-time query checking needed |
| webview.h over Electron/Tauri | No Node.js runtime, no Rust/IPC complexity — direct C++ thin shell, ~200KB binary |
| lingva.ml for translation | Free, open API; wrapped behind a trait so it can be swapped without API changes |
| SQLite local-only | Desktop app — no backend server, full offline support, simple distribution |
| Turborepo for Rust/C++ | Not native to Turbo, but custom scripts integrate cleanly via `turbo.json` tasks |
