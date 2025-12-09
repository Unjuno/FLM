// Model Profiles service

import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';

export interface ModelProfile {
  id: string;
  engineId: string;
  modelId: string;
  label: string;
  parameters: Record<string, unknown>;
  updatedAt: string;
}

export interface ModelProfilesListRequest {
  engine?: string;
  model?: string;
}

export interface ModelProfileSaveRequest {
  engineId: string;
  modelId: string;
  label: string;
  parameters: Record<string, unknown>;
}

interface CliResponse<T> {
  version: string;
  data: T;
}

interface ModelProfilesListResponse {
  profiles: ModelProfile[];
}

interface ModelProfileResponse {
  profile: ModelProfile;
}

interface ModelProfileDeleteResponse {
  deleted: boolean;
  id: string;
}

/**
 * Fetch model profiles from CLI
 */
export async function fetchModelProfiles(
  filters?: ModelProfilesListRequest
): Promise<ModelProfile[]> {
  try {
    const payload = filters
      ? {
          engine: filters.engine,
          model: filters.model,
        }
      : undefined;

    const response = await safeInvoke<CliResponse<ModelProfilesListResponse>>(
      'ipc_model_profiles_list',
      payload ? { payload } : undefined
    );

    if (response.data?.profiles) {
      return response.data.profiles;
    }
    return [];
  } catch (error) {
    logger.error('Failed to fetch model profiles:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch model profiles'
    );
  }
}

/**
 * Save a model profile
 */
export async function saveModelProfile(
  profile: ModelProfileSaveRequest
): Promise<ModelProfile> {
  try {
    const paramsJson = JSON.stringify(profile.parameters);

    const response = await safeInvoke<CliResponse<ModelProfileResponse>>(
      'ipc_model_profiles_save',
      {
        payload: {
          engine: profile.engineId,
          model: profile.modelId,
          label: profile.label,
          params_json: paramsJson,
        },
      }
    );

    if (response.data?.profile) {
      return response.data.profile;
    }
    throw new Error('Invalid response from save model profile');
  } catch (error) {
    logger.error('Failed to save model profile:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to save model profile'
    );
  }
}

/**
 * Delete a model profile
 */
export async function deleteModelProfile(id: string): Promise<void> {
  try {
    await safeInvoke<CliResponse<ModelProfileDeleteResponse>>(
      'ipc_model_profiles_delete',
      {
        payload: { id },
      }
    );
  } catch (error) {
    logger.error('Failed to delete model profile:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to delete model profile'
    );
  }
}

