// SPDX-License-Identifier: MIT
// dashboard - Dashboard services for engine status, proxy status, and security alerts

import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';

// Engine Status

export interface EngineStatus {
  engineId: string;
  status: string;
  latency?: number;
  capabilities?: string[];
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

export async function fetchEngineStatus(fresh: boolean = false): Promise<EngineStatus[]> {
  const response = await safeInvoke<CliEnginesDetectResponse>(
    'ipc_detect_engines',
    fresh
  );

  if (!response?.data?.engines) {
    logger.warn('Dashboard: unexpected engines response', 'Dashboard', response);
    return [];
  }

  return response.data.engines.map((engine) => ({
    engineId: engine.engine_id,
    status: engine.status,
    latency: engine.latency_ms,
    capabilities: engine.capabilities,
  }));
}

// Proxy Status

export interface ProxyStatus {
  running: boolean;
  mode?: string;
  port?: number;
  listenAddr?: string;
  acmeDomain?: string;
  endpoints?: {
    localhost?: string;
    localNetwork?: string;
    external?: string;
  };
}

interface CliProxyStatusResponse {
  version: string;
  data: {
    handles: Array<{
      handle_id: string;
      running: boolean;
      mode: string;
      port: number;
      listen_addr: string;
      acme_domain?: string;
      endpoints?: {
        localhost?: string;
        local_network?: string;
        external?: string;
      };
    }>;
  };
}

export async function fetchProxyStatus(): Promise<ProxyStatus | null> {
  const response = await safeInvoke<CliProxyStatusResponse>('ipc_proxy_status');

  if (!response?.data?.handles || response.data.handles.length === 0) {
    return {
      running: false,
    };
  }

  const handle = response.data.handles[0];
  return {
    running: handle.running,
    mode: handle.mode,
    port: handle.port,
    listenAddr: handle.listen_addr,
    acmeDomain: handle.acme_domain,
    endpoints: handle.endpoints
      ? {
          localhost: handle.endpoints.localhost,
          localNetwork: handle.endpoints.local_network,
          external: handle.endpoints.external,
        }
      : undefined,
  };
}

// Security Alerts

export interface SecurityAlert {
  apiKeyCount: number;
  hasIpWhitelist: boolean;
  hasRateLimit: boolean;
  hasCors: boolean;
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

export async function fetchSecurityAlerts(): Promise<SecurityAlert> {
  const [policyResponse, apiKeysResponse] = await Promise.all([
    safeInvoke<CliSecurityPolicyResponse>('ipc_security_policy_show'),
    safeInvoke<CliApiKeysResponse>('ipc_api_keys_list'),
  ]);

  let hasIpWhitelist = false;
  let hasRateLimit = false;
  let hasCors = false;

  if (policyResponse?.data?.policy?.policy_json) {
    try {
      const policy = JSON.parse(policyResponse.data.policy.policy_json);
      hasIpWhitelist = Array.isArray(policy.ip_whitelist) && policy.ip_whitelist.length > 0;
      hasRateLimit = policy.rate_limit !== undefined;
      hasCors = policy.cors !== undefined;
    } catch (e) {
      logger.warn('Dashboard: failed to parse policy JSON', 'Dashboard', e);
    }
  }

  const apiKeyCount =
    apiKeysResponse?.data?.keys?.filter((key) => !key.revoked_at).length ?? 0;

  return {
    apiKeyCount,
    hasIpWhitelist,
    hasRateLimit,
    hasCors,
  };
}

