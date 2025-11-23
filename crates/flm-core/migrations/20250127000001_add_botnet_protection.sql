-- Migration: Add botnet protection tables
-- See docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md
-- Date: 2025-01-27

-- IP blocklist table
CREATE TABLE IF NOT EXISTS ip_blocklist (
    ip TEXT PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    first_failure_at TEXT NOT NULL,
    blocked_until TEXT,
    permanent_block INTEGER NOT NULL DEFAULT 0,
    last_attempt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ip_blocklist_blocked_until 
ON ip_blocklist(blocked_until) WHERE blocked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ip_blocklist_permanent_block 
ON ip_blocklist(permanent_block) WHERE permanent_block = 1;

-- Intrusion detection attempts
CREATE TABLE IF NOT EXISTS intrusion_attempts (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    pattern TEXT NOT NULL,
    score INTEGER NOT NULL,
    request_path TEXT,
    user_agent TEXT,
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intrusion_attempts_ip 
ON intrusion_attempts(ip, created_at);

CREATE INDEX IF NOT EXISTS idx_intrusion_attempts_score 
ON intrusion_attempts(score, created_at);

-- Anomaly detections
CREATE TABLE IF NOT EXISTS anomaly_detections (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detections_ip 
ON anomaly_detections(ip, created_at);

CREATE INDEX IF NOT EXISTS idx_anomaly_detections_type 
ON anomaly_detections(anomaly_type, created_at);

-- Resource alerts
CREATE TABLE IF NOT EXISTS resource_alerts (
    id TEXT PRIMARY KEY,
    alert_type TEXT NOT NULL,  -- 'cpu', 'memory', 'connections'
    value REAL NOT NULL,
    threshold REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resource_alerts_created_at 
ON resource_alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_resource_alerts_type 
ON resource_alerts(alert_type, created_at);

-- Extend audit_logs table (if not exists, create it)
-- Note: audit_logs already exists in 20250101000002_create_security_db.sql
-- We only add new columns if needed, or use the existing structure

-- Add event_type and severity columns to audit_logs if they don't exist
-- This is a safe operation that won't fail if columns already exist
-- SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we use a different approach
-- We'll check in the application code or use a separate migration

-- For now, we'll use the existing audit_logs structure and extend it via application logic
-- The new fields (event_type, severity, ip) can be stored in a JSON details field
-- or we can create a new migration to add columns

