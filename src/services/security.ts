// Security-related services

import { safeInvoke } from '../utils/tauri';

/**
 * Type guard for CLI audit logs response
 * why: 実行時型チェックで安全性を向上させるため
 * alt: 型アサーションのみ使用（実行時エラーのリスク）
 * evidence: TypeScriptのベストプラクティス
 */
function isCliAuditLogsResponse(
  response: unknown
): response is CliAuditLogsResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const obj = response as Record<string, unknown>;
  return (
    typeof obj.version === 'string' &&
    obj.data !== null &&
    typeof obj.data === 'object' &&
    'logs' in obj.data &&
    Array.isArray((obj.data as { logs: unknown }).logs)
  );
}

/**
 * Type guard for CLI intrusion response
 * why: 実行時型チェックで安全性を向上させるため
 * alt: 型アサーションのみ使用（実行時エラーのリスク）
 * evidence: TypeScriptのベストプラクティス
 */
function isCliIntrusionResponse(
  response: unknown
): response is CliIntrusionResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const obj = response as Record<string, unknown>;
  return (
    typeof obj.version === 'string' &&
    obj.data !== null &&
    typeof obj.data === 'object' &&
    'attempts' in obj.data &&
    Array.isArray((obj.data as { attempts: unknown }).attempts)
  );
}

/**
 * Type guard for CLI anomaly response
 * why: 実行時型チェックで安全性を向上させるため
 * alt: 型アサーションのみ使用（実行時エラーのリスク）
 * evidence: TypeScriptのベストプラクティス
 */
function isCliAnomalyResponse(
  response: unknown
): response is CliAnomalyResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const obj = response as Record<string, unknown>;
  return (
    typeof obj.version === 'string' &&
    obj.data !== null &&
    typeof obj.data === 'object' &&
    'detections' in obj.data &&
    Array.isArray((obj.data as { detections: unknown }).detections)
  );
}

/**
 * Type guard for CLI IP blocklist response
 * why: 実行時型チェックで安全性を向上させるため
 * alt: 型アサーションのみ使用（実行時エラーのリスク）
 * evidence: TypeScriptのベストプラクティス
 */
function isCliIpBlocklistResponse(
  response: unknown
): response is CliIpBlocklistResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const obj = response as Record<string, unknown>;
  return (
    typeof obj.version === 'string' &&
    obj.data !== null &&
    typeof obj.data === 'object' &&
    'blocked_ips' in obj.data &&
    Array.isArray((obj.data as { blocked_ips: unknown }).blocked_ips)
  );
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

/**
 * Normalize audit log record from CLI response
 * why: スネークケースからキャメルケースへの変換を統一するため
 * alt: 各フィールドを個別に変換（コードが冗長になる）
 * evidence: 既存のパターンに合わせる
 */
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

/**
 * Build filter payload from filter object
 * why: フィルターロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
function buildAuditLogsPayload(filter: AuditLogsFilter): {
  event_type?: string;
  severity?: string;
  ip?: string;
  limit?: number;
  offset?: number;
} {
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

  return payload;
}

export async function fetchAuditLogs(
  filter: AuditLogsFilter = {}
): Promise<AuditLog[]> {
  const payload = buildAuditLogsPayload(filter);

  const response = await safeInvoke<CliAuditLogsResponse>(
    'ipc_security_audit_logs',
    Object.keys(payload).length > 0 ? payload : undefined
  );

  if (!isCliAuditLogsResponse(response) || !response.data?.logs) {
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

/**
 * Normalize intrusion attempt record from CLI response
 * why: スネークケースからキャメルケースへの変換を統一するため
 * alt: 各フィールドを個別に変換（コードが冗長になる）
 * evidence: 既存のパターンに合わせる
 */
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

/**
 * Build filter payload from filter object
 * why: フィルターロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
function buildIntrusionFilterPayload(filter: IntrusionFilter): {
  ip?: string;
  min_score?: number;
  limit?: number;
  offset?: number;
} {
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

  return payload;
}

export async function fetchIntrusionAttempts(
  filter: IntrusionFilter = {}
): Promise<IntrusionAttempt[]> {
  const payload = buildIntrusionFilterPayload(filter);

  const response = await safeInvoke<CliIntrusionResponse>(
    'ipc_security_intrusion',
    Object.keys(payload).length > 0 ? payload : undefined
  );

  if (!isCliIntrusionResponse(response) || !response.data?.attempts) {
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

/**
 * Normalize anomaly detection record from CLI response
 * why: スネークケースからキャメルケースへの変換を統一するため
 * alt: 各フィールドを個別に変換（コードが冗長になる）
 * evidence: 既存のパターンに合わせる
 */
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

/**
 * Build filter payload from filter object
 * why: フィルターロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
function buildAnomalyFilterPayload(filter: AnomalyFilter): {
  ip?: string;
  anomaly_type?: string;
  limit?: number;
  offset?: number;
} {
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

  return payload;
}

export async function fetchAnomalyDetections(
  filter: AnomalyFilter = {}
): Promise<AnomalyDetection[]> {
  const payload = buildAnomalyFilterPayload(filter);

  const response = await safeInvoke<CliAnomalyResponse>(
    'ipc_security_anomaly',
    Object.keys(payload).length > 0 ? payload : undefined
  );

  if (!isCliAnomalyResponse(response) || !response.data?.detections) {
    return [];
  }

  return response.data.detections.map(normalizeAnomalyDetection);
}

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

/**
 * Normalize blocked IP record from CLI response
 * why: スネークケースからキャメルケースへの変換を統一するため
 * alt: 各フィールドを個別に変換（コードが冗長になる）
 * evidence: 既存のパターンに合わせる
 */
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

  if (!isCliIpBlocklistResponse(response) || !response.data?.blocked_ips) {
    return [];
  }

  return response.data.blocked_ips.map(normalizeBlockedIp);
}

export async function unblockIp(ip: string): Promise<void> {
  await safeInvoke('ipc_security_ip_blocklist_unblock', { ip });
}

export async function clearTemporaryBlocks(): Promise<void> {
  await safeInvoke('ipc_security_ip_blocklist_clear');
}

// IP Whitelist

export interface WhitelistedIp {
  ip: string;
  addedAt: string;
}

interface CliIpWhitelistResponse {
  version: string;
  data: {
    whitelisted_ips: Array<{
      ip: string;
      added_at: string;
    }>;
  };
}

/**
 * Type guard for CLI IP whitelist response
 * why: 実行時型チェックで安全性を向上させるため
 * alt: 型アサーションのみ使用（実行時エラーのリスク）
 * evidence: TypeScriptのベストプラクティス
 */
function isCliIpWhitelistResponse(
  response: unknown
): response is CliIpWhitelistResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const obj = response as Record<string, unknown>;
  return (
    typeof obj.version === 'string' &&
    obj.data !== null &&
    typeof obj.data === 'object' &&
    'whitelisted_ips' in obj.data &&
    Array.isArray((obj.data as { whitelisted_ips: unknown }).whitelisted_ips)
  );
}

/**
 * Normalize whitelisted IP record from CLI response
 * why: スネークケースからキャメルケースへの変換を統一するため
 * alt: 各フィールドを個別に変換（コードが冗長になる）
 * evidence: 既存のパターンに合わせる
 */
function normalizeWhitelistedIp(record: {
  ip: string;
  added_at: string;
}): WhitelistedIp {
  return {
    ip: record.ip,
    addedAt: record.added_at,
  };
}

export async function fetchWhitelistedIps(): Promise<WhitelistedIp[]> {
  const response = await safeInvoke<CliIpWhitelistResponse>(
    'ipc_security_ip_whitelist_list'
  );

  if (!isCliIpWhitelistResponse(response) || !response.data?.whitelisted_ips) {
    return [];
  }

  return response.data.whitelisted_ips.map(normalizeWhitelistedIp);
}

export async function addWhitelistedIp(ip: string): Promise<void> {
  await safeInvoke('ipc_security_ip_whitelist_add', { ip });
}

export async function removeWhitelistedIp(ip: string): Promise<void> {
  await safeInvoke('ipc_security_ip_whitelist_remove', { ip });
}
