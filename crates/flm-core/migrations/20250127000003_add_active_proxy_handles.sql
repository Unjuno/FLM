-- Migration: Add active_proxy_handles table
-- This table stores active proxy handles for persistence across CLI invocations

CREATE TABLE IF NOT EXISTS active_proxy_handles (
    id TEXT PRIMARY KEY,
    handle_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_active_proxy_handles_created_at ON active_proxy_handles(created_at);

