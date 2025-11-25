// SPDX-License-Identifier: MIT
// apiPrompts - CLI-backed API prompt helpers

import { safeInvoke, clearInvokeCache } from '../utils/tauri';

export interface ApiPrompt {
  apiId: string;
  templateText: string;
  version: number;
  updatedAt: string;
}

interface CliApiPromptsResponse {
  version: string;
  data: {
    prompts: Array<{
      api_id: string;
      template_text: string;
      version: number;
      updated_at: string;
    }>;
  };
}

interface CliApiPromptResponse {
  version: string;
  data: {
    prompt: {
      api_id: string;
      template_text: string;
      version: number;
      updated_at: string;
    };
  };
}

function normalizePrompt(record: {
  api_id: string;
  template_text: string;
  version: number;
  updated_at: string;
}): ApiPrompt {
  return {
    apiId: record.api_id,
    templateText: record.template_text,
    version: record.version,
    updatedAt: record.updated_at,
  };
}

export async function fetchApiPrompts(): Promise<ApiPrompt[]> {
  const response = await safeInvoke<CliApiPromptsResponse>(
    'ipc_api_prompts_list'
  );

  if (!response?.data?.prompts) {
    return [];
  }

  return response.data.prompts.map(normalizePrompt);
}

export async function getApiPrompt(apiId: string): Promise<ApiPrompt | null> {
  const response = await safeInvoke<CliApiPromptResponse>(
    'ipc_api_prompts_show',
    { api_id: apiId }
  );
  if (!response?.data?.prompt) {
    return null;
  }
  return normalizePrompt(response.data.prompt);
}

export async function setApiPrompt(
  apiId: string,
  templateText: string
): Promise<ApiPrompt> {
  const response = await safeInvoke<CliApiPromptResponse>(
    'ipc_api_prompts_set',
    { api_id: apiId, template_text: templateText }
  );
  clearInvokeCache('ipc_api_prompts_list');
  if (!response?.data?.prompt) {
    throw new Error('APIプロンプトの保存に失敗しました (レスポンスが不正です)');
  }
  return normalizePrompt(response.data.prompt);
}

