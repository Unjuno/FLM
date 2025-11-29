-- Migration: Add dns_credentials table for ACME DNS profiles
-- Tracks metadata only; secrets are stored in OS keyring.

CREATE TABLE IF NOT EXISTS dns_credentials (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    label TEXT NOT NULL,
    zone_id TEXT NOT NULL,
    zone_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dns_credentials_provider
    ON dns_credentials(provider);

CREATE INDEX IF NOT EXISTS idx_dns_credentials_created_at
    ON dns_credentials(created_at);

