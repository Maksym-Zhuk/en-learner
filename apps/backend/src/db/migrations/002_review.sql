-- Spaced repetition review system

-- Card types: en_to_uk | uk_to_en | definition_to_word | example_to_word
CREATE TABLE IF NOT EXISTS review_cards (
    id               TEXT PRIMARY KEY,
    word_id          TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    face             TEXT NOT NULL CHECK(face IN ('en_to_uk','uk_to_en','definition_to_word','example_to_word')),

    -- SM-2 inspired state machine
    state            TEXT NOT NULL DEFAULT 'new' CHECK(state IN ('new','learning','review','relearning')),
    due_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    interval_days    REAL NOT NULL DEFAULT 0,
    ease_factor      REAL NOT NULL DEFAULT 2.5,
    reps             INTEGER NOT NULL DEFAULT 0,
    lapses           INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at TEXT,

    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    UNIQUE (word_id, face)
);

CREATE INDEX IF NOT EXISTS idx_review_cards_due_at ON review_cards(due_at);
CREATE INDEX IF NOT EXISTS idx_review_cards_word_id ON review_cards(word_id);

-- Log of every review action

CREATE TABLE IF NOT EXISTS review_logs (
    id           TEXT PRIMARY KEY,
    card_id      TEXT NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE,
    rating       TEXT NOT NULL CHECK(rating IN ('again','hard','good','easy')),
    time_spent_ms INTEGER NOT NULL DEFAULT 0,
    state_before TEXT NOT NULL,
    state_after  TEXT NOT NULL,
    interval_before REAL NOT NULL DEFAULT 0,
    interval_after  REAL NOT NULL DEFAULT 0,
    reviewed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_review_logs_reviewed_at ON review_logs(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_logs_card_id ON review_logs(card_id);

-- Review sessions (grouped review runs)

CREATE TABLE IF NOT EXISTS review_sessions (
    id           TEXT PRIMARY KEY,
    set_id       TEXT REFERENCES study_sets(id) ON DELETE SET NULL,
    started_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    finished_at  TEXT,
    total_cards  INTEGER NOT NULL DEFAULT 0,
    reviewed     INTEGER NOT NULL DEFAULT 0
);
