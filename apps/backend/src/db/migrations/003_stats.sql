-- Daily statistics aggregation

CREATE TABLE IF NOT EXISTS daily_stats (
    date          TEXT PRIMARY KEY,  -- YYYY-MM-DD
    words_reviewed INTEGER NOT NULL DEFAULT 0,
    words_learned  INTEGER NOT NULL DEFAULT 0,
    new_cards_seen INTEGER NOT NULL DEFAULT 0,
    minutes_studied REAL NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
