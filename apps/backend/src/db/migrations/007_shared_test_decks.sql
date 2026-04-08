CREATE TABLE IF NOT EXISTS shared_test_decks (
    token           TEXT PRIMARY KEY,
    set_id          TEXT NOT NULL UNIQUE,
    set_name        TEXT NOT NULL,
    set_description TEXT,
    cards_json      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    updated_at      TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_shared_test_decks_set_id
    ON shared_test_decks(set_id);
