CREATE TABLE IF NOT EXISTS daily_stats (
    date            TEXT PRIMARY KEY,
    words_reviewed  BIGINT NOT NULL DEFAULT 0,
    words_learned   BIGINT NOT NULL DEFAULT 0,
    new_cards_seen  BIGINT NOT NULL DEFAULT 0,
    minutes_studied DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);
