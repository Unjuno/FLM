-- Migration: Create security.db schema
-- See docs/DB_SCHEMA.md section 2

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT
);

-- Security policies table
-- Phase 1/2: Only 'default' policy is allowed
CREATE TABLE IF NOT EXISTS security_policies (
    id TEXT PRIMARY KEY CHECK(id = 'default'),
    policy_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit logs table (tamper-resistant)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    api_key_id TEXT,
    endpoint TEXT NOT NULL,
    status INTEGER NOT NULL,
    latency_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

-- Rate limit states table
CREATE TABLE IF NOT EXISTS rate_limit_states (
    api_key_id TEXT PRIMARY KEY,
    requests_count INTEGER NOT NULL DEFAULT 0,
    reset_at TEXT NOT NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

-- Certificates table (ACME/self-signed/packaged-ca metadata)
CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    cert_path TEXT NOT NULL,
    key_path TEXT NOT NULL,
    mode TEXT NOT NULL, -- 'acme', 'self-signed', 'packaged-ca'
    domain TEXT,
    expires_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_id ON audit_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_endpoint ON audit_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_certificates_expires_at ON certificates(expires_at);

