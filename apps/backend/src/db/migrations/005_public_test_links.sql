CREATE TABLE IF NOT EXISTS public_test_links (
    token            TEXT PRIMARY KEY,
    set_id           TEXT NOT NULL UNIQUE REFERENCES study_sets(id) ON DELETE CASCADE,
    created_at       TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    last_accessed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_public_test_links_set_id
    ON public_test_links(set_id);
