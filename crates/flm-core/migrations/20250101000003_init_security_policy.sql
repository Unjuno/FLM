-- Migration: Initialize default security policy
-- See docs/DB_SCHEMA.md section 4
-- Phase 1/2: Insert empty policy with id='default'

INSERT OR IGNORE INTO security_policies (id, policy_json, updated_at)
VALUES (
    'default',
    '{"ip_whitelist":[],"cors":{"allowed_origins":[]},"rate_limit":{}}',
    datetime('now')
);

