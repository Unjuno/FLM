// SPDX-License-Identifier: MIT
// apiSetup - API Setup services for model selection, API keys, security policy, and config

import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { logger } from '../utils/logger';

// Model Selection

export interface ModelOption {
  engineId: string;
  modelId: string;
  displayName: string; // flm://engine/model format
}

interface CliEnginesDetectResponse {
  version: string;
  data: {
    engines: Array<{
      engine_id: string;
      status: string;
      latency_ms?: number;
      capabilities?: string[];
    }>;
  };
}

interface CliModelsListResponse {
  version: string;
  data: {
    models: Array<{
      engine_id: string;
      model_id: string;
      display_name?: string;
    }>;
  };
}

export async function fetchModelOptions(): Promise<ModelOption[]> {
  const [enginesResponse, modelsResponse] = await Promise.all([
    safeInvoke<CliEnginesDetectResponse>('ipc_detect_engines', false),
    safeInvoke<CliModelsListResponse>('ipc_list_models', null),
  ]);

  const engines =
    enginesResponse?.data?.engines?.filter((e) => e.status === 'RunningHealthy') ?? [];
  const models = modelsResponse?.data?.models ?? [];

  const options: ModelOption[] = [];
  for (const model of models) {
    const engine = engines.find((e) => e.engine_id === model.engine_id);
    if (engine) {
      options.push({
        engineId: model.engine_id,
        modelId: model.model_id,
        displayName: `flm://${model.engine_id}/${model.model_id}`,
      });
    }
  }

  return options;
}

export async function refreshEngines(fresh: boolean = true): Promise<void> {
  await safeInvoke<CliEnginesDetectResponse>('ipc_detect_engines', fresh);
  clearInvokeCache('ipc_detect_engines');
  clearInvokeCache('ipc_list_models');
}

// API Keys

export interface ApiKey {
  id: string;
  label: string;
  createdAt: string;
  revokedAt?: string;
}

interface CliApiKeysResponse {
  version: string;
  data: {
    keys: Array<{
      id: string;
      label: string;
      created_at: string;
      revoked_at?: string;
    }>;
  };
}

interface CliApiKeyCreateResponse {
  version: string;
  data: {
    key: {
      id: string;
      label: string;
      api_key: string; // Plain text key (only shown once)
      created_at: string;
    };
  };
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const response = await safeInvoke<CliApiKeysResponse>('ipc_api_keys_list');

  if (!response?.data?.keys) {
    logger.warn('ApiSetup: unexpected api keys response', 'ApiSetup', response);
    return [];
  }

  return response.data.keys.map((key) => ({
    id: key.id,
    label: key.label,
    createdAt: key.created_at,
    revokedAt: key.revoked_at,
  }));
}

export interface CreateApiKeyResult {
  id: string;
  label: string;
  apiKey: string; // Plain text key (only shown once)
  createdAt: string;
}

export async function createApiKey(label: string): Promise<CreateApiKeyResult> {
  const response = await safeInvoke<CliApiKeyCreateResponse>(
    'ipc_api_keys_create',
    { label }
  );

  if (!response?.data?.key) {
    throw new Error('APIキーの作成に失敗しました (レスポンスが不正です)');
  }

  clearInvokeCache('ipc_api_keys_list');

  return {
    id: response.data.key.id,
    label: response.data.key.label,
    apiKey: response.data.key.api_key,
    createdAt: response.data.key.created_at,
  };
}

export async function revokeApiKey(id: string): Promise<void> {
  await safeInvoke('ipc_api_keys_revoke', { id: id });
  clearInvokeCache('ipc_api_keys_list');
}

// Security Policy

export interface SecurityPolicy {
  ipWhitelist: string[];
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
  } | null;
  rateLimit: {
    requestsPerMinute: number;
    burstSize: number;
  } | null;
  rawJson: string;
}

interface CliSecurityPolicyResponse {
  version: string;
  data: {
    policy: {
      id: string;
      policy_json: string;
      updated_at: string;
    };
  };
}

export async function fetchSecurityPolicy(): Promise<SecurityPolicy> {
  const response = await safeInvoke<CliSecurityPolicyResponse>(
    'ipc_security_policy_show'
  );

  if (!response?.data?.policy?.policy_json) {
    return {
      ipWhitelist: [],
      cors: null,
      rateLimit: null,
      rawJson: '{}',
    };
  }

  try {
    const policy = JSON.parse(response.data.policy.policy_json);
    return {
      ipWhitelist: Array.isArray(policy.ip_whitelist) ? policy.ip_whitelist : [],
      cors: policy.cors
        ? {
            allowedOrigins: Array.isArray(policy.cors.allowed_origins)
              ? policy.cors.allowed_origins
              : [],
            allowedMethods: Array.isArray(policy.cors.allowed_methods)
              ? policy.cors.allowed_methods
              : [],
            allowedHeaders: Array.isArray(policy.cors.allowed_headers)
              ? policy.cors.allowed_headers
              : [],
          }
        : null,
      rateLimit: policy.rate_limit
        ? {
            requestsPerMinute: policy.rate_limit.requests_per_minute ?? 60,
            burstSize: policy.rate_limit.burst_size ?? 10,
          }
        : null,
      rawJson: response.data.policy.policy_json,
    };
  } catch (e) {
    logger.warn('ApiSetup: failed to parse policy JSON', 'ApiSetup', e);
    return {
      ipWhitelist: [],
      cors: null,
      rateLimit: null,
      rawJson: response.data.policy.policy_json,
    };
  }
}

export interface SecurityPolicyInput {
  ipWhitelist?: string[];
  cors?: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
  } | null;
  rateLimit?: {
    requestsPerMinute: number;
    burstSize: number;
  } | null;
  rawJson?: string; // For advanced mode
}

export async function saveSecurityPolicy(
  input: SecurityPolicyInput
): Promise<void> {
  let policyJson: string;

  if (input.rawJson) {
    // Advanced mode: use raw JSON directly
    try {
      JSON.parse(input.rawJson); // Validate JSON
      policyJson = input.rawJson;
    } catch (e) {
      throw new Error('無効なJSON形式です');
    }
  } else {
    // Form mode: build JSON from form fields
    const policy: any = {};
    if (input.ipWhitelist !== undefined) {
      policy.ip_whitelist = input.ipWhitelist;
    }
    if (input.cors !== undefined) {
      if (input.cors === null) {
        policy.cors = null;
      } else {
        policy.cors = {
          allowed_origins: input.cors.allowedOrigins,
          allowed_methods: input.cors.allowedMethods,
          allowed_headers: input.cors.allowedHeaders,
        };
      }
    }
    if (input.rateLimit !== undefined) {
      if (input.rateLimit === null) {
        policy.rate_limit = null;
      } else {
        policy.rate_limit = {
          requests_per_minute: input.rateLimit.requestsPerMinute,
          burst_size: input.rateLimit.burstSize,
        };
      }
    }
    policyJson = JSON.stringify(policy, null, 2);
  }

  await safeInvoke('ipc_security_policy_set', { policy: JSON.parse(policyJson) });
  clearInvokeCache('ipc_security_policy_show');
}

// Config

export interface ConfigEntry {
  key: string;
  value: string;
}

interface CliConfigListResponse {
  version: string;
  data: {
    config: Record<string, string>;
  };
}

interface CliConfigGetResponse {
  version: string;
  data: {
    key: string;
    value: string | null;
  };
}

export async function fetchConfigList(): Promise<ConfigEntry[]> {
  const response = await safeInvoke<CliConfigListResponse>('ipc_config_list');

  if (!response?.data?.config) {
    logger.warn('ApiSetup: unexpected config list response', 'ApiSetup', response);
    return [];
  }

  return Object.entries(response.data.config).map(([key, value]) => ({
    key,
    value,
  }));
}

export async function getConfigValue(key: string): Promise<string | null> {
  const response = await safeInvoke<CliConfigGetResponse>('ipc_config_get', {
    key,
  });

  return response?.data?.value ?? null;
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  await safeInvoke('ipc_config_set', { key, value });
  clearInvokeCache('ipc_config_list');
  clearInvokeCache('ipc_config_get');
}

