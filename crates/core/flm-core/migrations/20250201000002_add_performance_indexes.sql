-- Migration: Add performance indexes for frequently queried columns
-- See docs/DB_SCHEMA.md section 2

-- Index for rate_limit_states.reset_at (used in WHERE reset_at < ? and WHERE reset_at > ? queries)
CREATE INDEX IF NOT EXISTS idx_rate_limit_states_reset_at ON rate_limit_states(reset_at);

-- Index for api_keys.label (used in search/filter operations)
CREATE INDEX IF NOT EXISTS idx_api_keys_label ON api_keys(label);

-- Composite index for rate_limit_states (api_key_id, reset_at) for efficient lookups
-- Note: api_key_id is already PRIMARY KEY, but composite index helps with ORDER BY reset_at queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_states_api_key_reset ON rate_limit_states(api_key_id, reset_at);

