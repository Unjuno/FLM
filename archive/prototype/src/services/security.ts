// SPDX-License-Identifier: MIT
// security - Security-related services (IP blocklist, audit logs, intrusion, anomaly)

import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { logger } from '../utils/logger';

// IP Blocklist

export interface BlockedIp {
  ip: string;
  failureCount: number;
  firstFailureAt: string;
  blockedUntil: string | null;
  permanentBlock: boolean;
  lastAttempt: string;
}

interface CliIpBlocklistResponse {
  version: string;
  data: {
    blocked_ips: Array<{
      ip: string;
      failure_count: number;
      first_failure_at: string;
      blocked_until: string | null;
      permanent_block: boolean;
      last_attempt: string;
    }>;
  };
}

function normalizeBlockedIp(record: {
  ip: string;
  failure_count: number;
  first_failure_at: string;
  blocked_until: string | null;
  permanent_block: boolean;
  last_attempt: string;
}): BlockedIp {
  return {
    ip: record.ip,
    failureCount: record.failure_count,
    firstFailureAt: record.first_failure_at,
    blockedUntil: record.blocked_until,
    permanentBlock: record.permanent_block,
    lastAttempt: record.last_attempt,
  };
}

export async function fetchBlockedIps(): Promise<BlockedIp[]> {
  const response = await safeInvoke<CliIpBlocklistResponse>(
    'ipc_security_ip_blocklist_list'
  );

  if (!response?.data?.blocked_ips) {
    logger.warn('Security: unexpected response', 'Security', response);
    return [];
  }

  return response.data.blocked_ips.map(normalizeBlockedIp);
}

export async function unblockIp(ip: string): Promise<void> {
  await safeInvoke('ipc_security_ip_blocklist_unblock', { ip });
  clearInvokeCache('ipc_security_ip_blocklist_list');
}

export async function clearTemporaryBlocks(): Promise<void> {
  await safeInvoke('ipc_security_ip_blocklist_clear');
  clearInvokeCache('ipc_security_ip_blocklist_list');
}

// Audit Logs

export interface AuditLog {
  id: number;
  requestId: string;
  apiKeyId: string | null;
  endpoint: string;
  status: number;
  latencyMs: number | null;
  eventType: string | null;
  severity: string | null;
  ip: string | null;
  details: string | null;
  createdAt: string;
}

export interface AuditLogsFilter {
  eventType?: string;
  severity?: string;
  ip?: string;
  limit?: number;
  offset?: number;
}

interface CliAuditLogsResponse {
  version: string;
  data: {
    logs: Array<{
      id: number;
      request_id: string;
      api_key_id: string | null;
      endpoint: string;
      status: number;
      latency_ms: number | null;
      event_type: string | null;
      severity: string | null;
      ip: string | null;
      details: string | null;
      created_at: string;
    }>;
    limit: number;
    offset: number;
  };
}

function normalizeAuditLog(record: {
  id: number;
  request_id: string;
  api_key_id: string | null;
  endpoint: string;
  status: number;
  latency_ms: number | null;
  event_type: string | null;
  severity: string | null;
  ip: string | null;
  details: string | null;
  created_at: string;
}): AuditLog {
  return {
    id: record.id,
    requestId: record.request_id,
    apiKeyId: record.api_key_id,
    endpoint: record.endpoint,
    status: record.status,
    latencyMs: record.latency_ms,
    eventType: record.event_type,
    severity: record.severity,
    ip: record.ip,
    details: record.details,
    createdAt: record.created_at,
  };
}

export async function fetchAuditLogs(
  filter: AuditLogsFilter = {}
): Promise<AuditLog[]> {
  const payload: {
    event_type?: string;
    severity?: string;
    ip?: string;
    limit?: number;
    offset?: number;
  } = {};

  if (filter.eventType) {
    payload.event_type = filter.eventType;
  }
  if (filter.severity) {
    payload.severity = filter.severity;
  }
  if (filter.ip) {
    payload.ip = filter.ip;
  }
  if (filter.limit !== undefined) {
    payload.limit = filter.limit;
  }
  if (filter.offset !== undefined) {
    payload.offset = filter.offset;
  }

  const response = await safeInvoke<CliAuditLogsResponse>(
    'ipc_security_audit_logs',
    Object.keys(payload).length > 0 ? payload : undefined
  );

  if (!response?.data?.logs) {
    logger.warn('Security: unexpected audit logs response', 'Security', response);
    return [];
  }

  return response.data.logs.map(normalizeAuditLog);
}

// Intrusion Detection

export interface IntrusionAttempt {
  id: string;
  ip: string;
  pattern: string;
  score: number;
  requestPath: string | null;
  userAgent: string | null;
  method: string | null;
  createdAt: string;
}

export interface IntrusionFilter {
  ip?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}

interface CliIntrusionResponse {
  version: string;
  data: {
    attempts: Array<{
      id: string;
      ip: string;
      pattern: string;
      score: number;
      request_path: string | null;
      user_agent: string | null;
      method: string | null;
      created_at: string;
    }>;
    limit: number;
    offset: number;
  };
}

function normalizeIntrusionAttempt(record: {
  id: string;
  ip: string;
  pattern: string;
  score: number;
  request_path: string | null;
  user_agent: string | null;
  method: string | null;
  created_at: string;
}): IntrusionAttempt {
  return {
    id: record.id,
    ip: record.ip,
    pattern: record.pattern,
    score: record.score,
    requestPath: record.request_path,
    userAgent: record.user_agent,
    method: record.method,
    createdAt: record.created_at,
  };
}

export async function fetchIntrusionAttempts(
  filter: IntrusionFilter = {}
): Promise<IntrusionAttempt[]> {
  const payload: {
    ip?: string;
    min_score?: number;
    limit?: number;
    offset?: number;
  } = {};

  if (filter.ip) {
    payload.ip = filter.ip;
  }
  if (filter.minScore !== undefined) {
    payload.min_score = filter.minScore;
  }
  if (filter.limit !== undefined) {
    payload.limit = filter.limit;
  }
  if (filter.offset !== undefined) {
    payload.offset = filter.offset;
  }

  const response = await safeInvoke<CliIntrusionResponse>(
    'ipc_security_intrusion',
    Object.keys(payload).length > 0 ? payload : undefined
  );

  if (!response?.data?.attempts) {
    logger.warn('Security: unexpected intrusion response', 'Security', response);
    return [];
  }

  return response.data.attempts.map(normalizeIntrusionAttempt);
}

// Anomaly Detection

export interface AnomalyDetection {
  id: string;
  ip: string;
  anomalyType: string;
  score: number;
  details: string | null;
  createdAt: string;
}

export interface AnomalyFilter {
  ip?: string;
  anomalyType?: string;
  limit?: number;
  offset?: number;
}

interface CliAnomalyResponse {
  version: string;
  data: {
    detections: Array<{
      id: string;
      ip: string;
      anomaly_type: string;
      score: number;
      details: string | null;
      created_at: string;
    }>;
    limit: number;
    offset: number;
  };
}

function normalizeAnomalyDetection(record: {
  id: string;
  ip: string;
  anomaly_type: string;
  score: number;
  details: string | null;
  created_at: string;
}): AnomalyDetection {
  return {
    id: record.id,
    ip: record.ip,
    anomalyType: record.anomaly_type,
    score: record.score,
    details: record.details,
    createdAt: record.created_at,
  };
}

export async function fetchAnomalyDetections(
  filter: AnomalyFilter = {}
): Promise<AnomalyDetection[]> {
  const payload: {
    ip?: string;
    anomaly_type?: string;
    limit?: number;
    offset?: number;
  } = {};

  if (filter.ip) {
    payload.ip = filter.ip;
  }
  if (filter.anomalyType) {
    payload.anomaly_type = filter.anomalyType;
  }
  if (filter.limit !== undefined) {
    payload.limit = filter.limit;
  }
  if (filter.offset !== undefined) {
    payload.offset = filter.offset;
  }

  const response = await safeInvoke<CliAnomalyResponse>(
    'ipc_security_anomaly',
    Object.keys(payload).length > 0 ? payload : undefined
  );

  if (!response?.data?.detections) {
    logger.warn('Security: unexpected anomaly response', 'Security', response);
    return [];
  }

  return response.data.detections.map(normalizeAnomalyDetection);
}

