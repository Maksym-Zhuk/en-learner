ALTER TABLE review_logs ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_review_logs_session_id ON review_logs(session_id);
