// Engine Health service

import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';

export interface EngineHealthLog {
  id: number;
  engine_id: string;
  model_id: string | null;
  status: string;
  latency_ms: number | null;
  error_rate: number;
  created_at: string;
}

export interface EngineHealthHistoryRequest {
  engine?: string;
  model?: string;
  hours?: number;
  limit?: number;
}

interface CliResponse<T> {
  version: string;
  data: T;
}

interface EngineHealthHistoryResponse {
  logs: EngineHealthLog[];
}

/**
 * Fetch engine health history from CLI
 */
export async function fetchEngineHealthHistory(
  filters?: EngineHealthHistoryRequest
): Promise<EngineHealthLog[]> {
  try {
    const payload = filters
      ? {
          engine: filters.engine,
          model: filters.model,
          hours: filters.hours || 24,
          limit: filters.limit || 100,
        }
      : {
          hours: 24,
          limit: 100,
        };

    const response = await safeInvoke<CliResponse<EngineHealthHistoryResponse>>(
      'ipc_engines_health_history',
      { payload }
    );

    if (response.data?.logs) {
      return response.data.logs;
    }
    return [];
  } catch (error) {
    logger.error('Failed to fetch engine health history:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch engine health history'
    );
  }
}
