# en-learner

Flashcard app for Ukrainian learners of English. Similar to Quizlet + Cambridge Dictionary.

**Stack:** Leptos (Rust/WASM) · Axum · PostgreSQL · JWT auth

---

## Prerequisites

- Rust (stable, `rustup update`)
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- [Trunk](https://trunkrs.dev): `cargo install trunk`
- PostgreSQL 14+
- `sqlx-cli` (optional for manual migrations): `cargo install sqlx-cli --no-default-features --features rustls,postgres`

---

## Setup

### 1. Clone & configure

```bash
git clone <repo-url>
cd en-learner
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, PORT
```

### 2. Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE en_learner;"

# Migrations run automatically on backend startup.
# Or manually:
sqlx migrate run --database-url "$DATABASE_URL" --source migrations/
```

### 3. Run the backend

```bash
cd backend
cargo run
# Listens on http://localhost:3000
```

### 4. Run the frontend

```bash
cd frontend
trunk serve
# Opens http://localhost:8080
# API calls proxy to localhost:3000 via Trunk.toml
```

---

## Project structure

```
en-learner/
├── Cargo.toml          # workspace
├── .env.example
├── migrations/
│   └── 001_init.sql
├── backend/
│   └── src/
│       ├── main.rs
│       ├── auth.rs     # JWT creation + middleware
│       ├── db.rs       # AppState / PgPool
│       ├── errors.rs
│       ├── models.rs
│       └── routes/
│           ├── auth.rs       # POST /api/auth/*
│           └── protected.rs  # decks, cards, lookup
└── frontend/
    ├── index.html
    ├── Trunk.toml
    └── src/
        ├── main.rs
        ├── api.rs        # typed API client
        ├── state.rs      # AuthState (JWT in localStorage)
        ├── components/   # Navbar, FlipCard, CardItem, Toast
        └── pages/        # Login, Register, Home, Deck, Study, Quiz
```

---

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | — | Register |
| POST | /api/auth/login | — | Login |
| POST | /api/auth/logout | — | Logout |
| GET | /api/decks | ✓ | List decks |
| POST | /api/decks | ✓ | Create deck |
| DELETE | /api/decks/:id | ✓ | Delete deck |
| GET | /api/decks/:id/cards | ✓ | List cards in deck |
| POST | /api/decks/:id/cards | ✓ | Add card to deck |
| PUT | /api/cards/:id | ✓ | Update card |
| DELETE | /api/cards/:id | ✓ | Delete card |
| GET | /api/lookup?word=:word | ✓ | Lookup word (proxies dictionaryapi.dev + lingva.ml) |

---

## Features

- **Auth** — email/password, bcrypt, JWT in httpOnly cookie + Authorization header
- **Word Lookup** — proxied from backend to avoid CORS; fetches English definition + example and Ukrainian translation + translated example
- **Decks** — create, list, delete named decks
- **Cards** — add via lookup, view, delete
- **Study mode** — 3D flip cards, "knew it" / "didn't know" tracking, session summary
- **Quiz: Multiple choice** — 4 options, wrong answers recycled to queue end
- **Quiz: Write** — type the translation (Levenshtein tolerance ≤2), wrong answers recycled
- **Quiz: Match** — click-to-match word ↔ translation pairs, up to 6 pairs per session
- **UI** — dark-only, Inter font, deep navy palette, glassmorphism surfaces, micro-animations, toast notifications, responsive

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `PORT` | Backend listen port | `3000` |
| `FRONTEND_URL` | CORS allowed origin | `http://localhost:8080` |

---

## Production build

```bash
# Frontend — build static files
cd frontend && trunk build --release

# Backend
cd backend && cargo build --release

# Serve frontend dist/ via a static file server or Nginx,
# and run the backend binary with production .env
```
