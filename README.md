# en-learner

Flashcard app for Ukrainian learners of English. Similar to Quizlet + Cambridge Dictionary.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · PostgreSQL · JWT auth

---

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+

---

## Setup

### 1. Clone & configure

```bash
git clone <repo-url>
cd en-learner
make setup
# Edit .env.local — set DATABASE_URL and JWT_SECRET
```

Or manually:

```bash
cp .env.example .env.local
npm install
```

### 2. Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE en_learner;"

# Run migrations
psql "$DATABASE_URL" -f migrations/001_init.sql
```

### 3. Run in development

```bash
make dev
# or: npm run dev
# Opens http://localhost:3000
```

### 4. Build for production

```bash
make build
# or: npm run build && npm start
```

---

## Project structure

```
en-learner/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── migrations/
│   └── 001_init.sql
└── src/
    ├── middleware.ts          # JWT auth guard
    ├── lib/
    │   ├── db.ts              # postgres client
    │   ├── auth.ts            # JWT sign/verify
    │   └── types.ts           # TypeScript interfaces
    ├── components/
    │   ├── Navbar.tsx
    │   ├── FlipCard.tsx       # 3D CSS flip
    │   ├── CardItem.tsx
    │   ├── Toast.tsx
    │   └── ToastProvider.tsx  # React context
    └── app/
        ├── layout.tsx
        ├── page.tsx           # root redirect
        ├── globals.css        # design system
        ├── login/page.tsx
        ├── register/page.tsx
        ├── home/page.tsx      # lookup + deck grid
        ├── deck/[id]/
        │   ├── page.tsx       # card list
        │   ├── study/page.tsx # flip card study
        │   └── quiz/[mode]/
        │       └── page.tsx   # multiple/write/match
        └── api/
            ├── auth/login/route.ts
            ├── auth/register/route.ts
            ├── auth/logout/route.ts
            ├── auth/me/route.ts
            ├── decks/route.ts
            ├── decks/[id]/route.ts
            ├── decks/[id]/cards/route.ts
            ├── cards/[id]/route.ts
            └── lookup/route.ts
```

---

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | — | Register |
| POST | /api/auth/login | — | Login |
| POST | /api/auth/logout | — | Logout |
| GET | /api/auth/me | ✓ | Current user info |
| GET | /api/decks | ✓ | List decks |
| POST | /api/decks | ✓ | Create deck |
| GET | /api/decks/:id | ✓ | Get deck |
| DELETE | /api/decks/:id | ✓ | Delete deck |
| GET | /api/decks/:id/cards | ✓ | List cards in deck |
| POST | /api/decks/:id/cards | ✓ | Add card to deck |
| PUT | /api/cards/:id | ✓ | Update card |
| DELETE | /api/cards/:id | ✓ | Delete card |
| GET | /api/lookup?word=X | ✓ | Lookup word |

---

## Features

- **Auth** — email/password, bcrypt, JWT in httpOnly cookie
- **Word Lookup** — fetches English definition + example from dictionaryapi.dev; Ukrainian translation + translated example via lingva.ml
- **Decks** — create, list, delete named decks
- **Cards** — add via lookup, view, delete
- **Study mode** — 3D flip cards, "Знав" / "Не знав" tracking, session summary with accuracy ring
- **Quiz: Multiple choice** — 4 options, wrong answers recycled to queue end
- **Quiz: Write** — type the translation (Levenshtein tolerance ≤2), wrong answers recycled
- **Quiz: Match** — click-to-match word ↔ translation pairs, up to 6 pairs per round
- **UI** — dark-only, Inter font, deep navy palette, glassmorphism navbar, micro-animations, toast notifications, Ukrainian UI

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
