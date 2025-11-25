// SPDX-License-Identifier: MIT
// chatTester - Chat Tester services for testing proxy endpoints

import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import { fetchProxyStatus, ProxyStatus } from './dashboard';

// Model from /v1/models endpoint
export interface ChatModel {
  id: string; // OpenAI-compatible ID
  flmUri: string; // flm://engine/model format
  displayName: string;
}

// Chat completion request
export interface ChatCompletionRequest {
  model: string; // OpenAI-compatible ID
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// Chat completion response
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  request_id?: string; // Custom header from proxy
}

// Fetch available models from proxy /v1/models endpoint
export async function fetchChatModels(
  proxyEndpoint: string
): Promise<ChatModel[]> {
  try {
    const response = await safeInvoke<{
      status: number;
      headers: Record<string, string>;
      body: string;
    }>('send_http_request', {
      url: `${proxyEndpoint}/v1/models`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: null,
      timeout_secs: 10,
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch models: HTTP ${response.status}`);
    }

    const data = JSON.parse(response.body);
    const models: ChatModel[] = [];

    if (data.data && Array.isArray(data.data)) {
      for (const model of data.data) {
        // Extract flm://engine/model from model.id or construct from model info
        const id = model.id || '';
        let flmUri = '';
        let displayName = id;

        // Try to parse OpenAI-compatible ID to flm:// format
        // Format might be: "flm-ollama-llama2" or similar
        if (id.startsWith('flm-')) {
          const parts = id.replace('flm-', '').split('-');
          if (parts.length >= 2) {
            flmUri = `flm://${parts[0]}/${parts.slice(1).join('-')}`;
            displayName = flmUri;
          }
        } else {
          // Use ID as-is and try to construct flm URI
          flmUri = id;
        }

        models.push({
          id,
          flmUri,
          displayName,
        });
      }
    }

    return models;
  } catch (err) {
    logger.error('ChatTester: failed to fetch models', err, 'ChatTester');
    throw err;
  }
}

// Send chat completion request
export async function sendChatCompletion(
  proxyEndpoint: string,
  apiKey: string | null,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await safeInvoke<{
      status: number;
      headers: Record<string, string>;
      body: string;
    }>('send_http_request', {
      url: `${proxyEndpoint}/v1/chat/completions`,
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      timeout_secs: 60,
    });

    if (response.status !== 200) {
      const errorBody = response.body;
      throw new Error(
        `Chat completion failed: HTTP ${response.status}\n${errorBody}`
      );
    }

    const data = JSON.parse(response.body) as ChatCompletionResponse;

    // Extract request_id from response headers if available
    const requestId = response.headers['x-request-id'] || response.headers['X-Request-Id'];
    if (requestId) {
      data.request_id = requestId;
    }

    return data;
  } catch (err) {
    logger.error('ChatTester: failed to send chat completion', err, 'ChatTester');
    throw err;
  }
}

// Get proxy endpoint URL
export async function getProxyEndpoint(): Promise<string | null> {
  const proxyStatus = await fetchProxyStatus();
  if (!proxyStatus || !proxyStatus.running) {
    return null;
  }

  // Prefer localhost endpoint for testing
  if (proxyStatus.endpoints?.localhost) {
    return proxyStatus.endpoints.localhost;
  }

  // Fallback to constructing URL from port
  if (proxyStatus.port) {
    const protocol = proxyStatus.mode?.includes('https') ? 'https' : 'http';
    return `${protocol}://localhost:${proxyStatus.port}`;
  }

  return null;
}

