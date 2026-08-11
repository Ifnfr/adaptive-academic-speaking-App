-- Migration: Create word_builder_rate_limits table
-- Run this in Supabase SQL Editor for the Fonetik project

CREATE TABLE IF NOT EXISTS word_builder_rate_limits (
  user_id TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup of old rows (optional)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON word_builder_rate_limits (window_start);
