// SPDX-License-Identifier: MIT
// modelProfiles - CLI-backed model profile helpers

import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { logger } from '../utils/logger';

export interface ModelProfile {
  id: string;
  engineId: string;
  modelId: string;
  label: string;
  parameters: unknown;
  version: number;
  updatedAt: string;
}

export interface ModelProfileFilter {
  engine?: string;
  model?: string;
}

interface CliModelProfilesResponse {
  version: string;
  data: {
    profiles: Array<{
      id: string;
      engine_id: string;
      model_id: string;
      label: string;
      parameters: unknown;
      version: number;
      updated_at: string;
    }>;
  };
}

interface CliModelProfileResponse {
  version: string;
  data: {
    profile: {
      id: string;
      engine_id: string;
      model_id: string;
      label: string;
      parameters: unknown;
      version: number;
      updated_at: string;
    };
  };
}

function normalizeProfile(record: {
  id: string;
  engine_id: string;
  model_id: string;
  label: string;
  parameters: unknown;
  version: number;
  updated_at: string;
}): ModelProfile {
  return {
    id: record.id,
    engineId: record.engine_id,
    modelId: record.model_id,
    label: record.label,
    parameters: record.parameters,
    version: record.version,
    updatedAt: record.updated_at,
  };
}

export async function fetchModelProfiles(
  filter: ModelProfileFilter = {}
): Promise<ModelProfile[]> {
  const payload: {
    engine?: string;
    model?: string;
  } = {};
  if (filter.engine) {
    payload.engine = filter.engine;
  }
  if (filter.model) {
    payload.model = filter.model;
  }
  const response = await safeInvoke<CliModelProfilesResponse>(
    'ipc_model_profiles_list',
    Object.keys(payload).length > 0 ? payload : {}
  );

  if (!response?.data?.profiles) {
    logger.warn('ModelProfiles: unexpected response', 'ModelProfiles', response);
    return [];
  }

  return response.data.profiles.map(normalizeProfile);
}

export interface SaveModelProfileInput {
  engineId: string;
  modelId: string;
  label: string;
  parameters: unknown;
}

export async function saveModelProfile(
  input: SaveModelProfileInput
): Promise<ModelProfile> {
  const paramsJson = JSON.stringify(input.parameters, null, 2);
  const response = await safeInvoke<CliModelProfileResponse>(
    'ipc_model_profiles_save',
    {
      engine: input.engineId,
      model: input.modelId,
      label: input.label,
      params_json: paramsJson,
    }
  );
  clearInvokeCache('ipc_model_profiles_list');

  if (!response?.data?.profile) {
    throw new Error('モデルプロファイルの保存に失敗しました (レスポンスが不正です)');
  }

  return normalizeProfile(response.data.profile);
}

export async function deleteModelProfile(id: string): Promise<void> {
  await safeInvoke('ipc_model_profiles_delete', { id });
  clearInvokeCache('ipc_model_profiles_list');
}

