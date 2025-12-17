import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchChatModels,
  sendChatCompletion,
  getProxyEndpoint,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
} from '../chatTester';

// Mock fetch globally
globalThis.fetch = vi.fn();

// Mock Tauri utilities
vi.mock('../../utils/tauri', () => ({
  safeInvoke: vi.fn(),
}));

describe('chatTester', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchChatModels', () => {
    it('should fetch and parse models successfully', async () => {
      const mockModels = {
        data: [{ id: 'flm-ollama-llama2' }, { id: 'gpt-4' }],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      } as Response);

      const result = await fetchChatModels('http://localhost:8080');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'flm-ollama-llama2',
        flmUri: 'flm://ollama/llama2',
        displayName: 'flm://ollama/llama2',
      });
      expect(result[1]).toMatchObject({
        id: 'gpt-4',
        flmUri: 'gpt-4',
        displayName: 'gpt-4',
      });
    });

    it('should handle HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchChatModels('http://localhost:8080')).rejects.toThrow(
        'Failed to fetch models: HTTP 500'
      );
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchChatModels('http://localhost:8080')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('sendChatCompletion', () => {
    it('should send chat completion request successfully', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const mockHeaders = new Headers();
      mockHeaders.set('x-request-id', 'req-123');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        json: async () => mockResponse,
      } as Response);

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await sendChatCompletion(
        'http://localhost:8080',
        'api-key-123',
        request
      );

      expect(result).toEqual({
        ...mockResponse,
        request_id: 'req-123',
      });
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key-123',
          },
          body: JSON.stringify(request),
        }
      );
    });

    it('should send request without API key when not provided', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello!',
            },
            finish_reason: 'stop',
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => mockResponse,
      } as Response);

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await sendChatCompletion('http://localhost:8080', null, request);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );
    });

    it('should handle HTTP errors with error body', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid request',
      } as Response);

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(
        sendChatCompletion('http://localhost:8080', null, request)
      ).rejects.toThrow('Chat completion failed: HTTP 400');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error body details in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid request body',
      } as Response);

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(
        sendChatCompletion('http://localhost:8080', null, request)
      ).rejects.toThrow(/詳細: Invalid request body/);

      process.env.NODE_ENV = originalEnv;
    });

    it('should truncate long error messages in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const longError = 'a'.repeat(600);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => longError,
      } as Response);

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(
        sendChatCompletion('http://localhost:8080', null, request)
      ).rejects.toThrow(/\.\.\./);

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include error body details in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid request body',
      } as Response);

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(
        sendChatCompletion('http://localhost:8080', null, request)
      ).rejects.toThrow('Chat completion failed: HTTP 400');

      const error = await sendChatCompletion(
        'http://localhost:8080',
        null,
        request
      ).catch(e => e);
      expect(error.message).not.toContain('詳細:');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle invalid response format', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ invalid: 'response' }),
      } as Response);

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(
        sendChatCompletion('http://localhost:8080', null, request)
      ).rejects.toThrow('Invalid response format');
    });

    it('should validate URL protocol (http/https only)', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(
        sendChatCompletion('file:///path/to/file', null, request)
      ).rejects.toThrow('Invalid proxy endpoint URL');
    });
  });

  describe('getProxyEndpoint', () => {
    it('should return localhost endpoint when proxy is running', async () => {
      const tauriUtils = await import('../../utils/tauri');
      vi.mocked(tauriUtils.safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'dev-self-signed',
            endpoints: {
              localhost: 'https://localhost:8080',
            },
          },
        ],
      });

      const result = await getProxyEndpoint();

      expect(result).toBe('https://localhost:8080');
    });

    it('should return null when proxy is not running', async () => {
      const tauriUtils = await import('../../utils/tauri');
      vi.mocked(tauriUtils.safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: false,
          },
        ],
      });

      const result = await getProxyEndpoint();

      expect(result).toBeNull();
    });

    it('should construct URL from port when localhost endpoint is not available', async () => {
      const tauriUtils = await import('../../utils/tauri');
      vi.mocked(tauriUtils.safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'local-http',
          },
        ],
      });

      const result = await getProxyEndpoint();

      expect(result).toBe('http://localhost:8080');
    });

    it('should handle HTTPS mode correctly', async () => {
      const tauriUtils = await import('../../utils/tauri');
      vi.mocked(tauriUtils.safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8443,
            mode: 'https-acme',
          },
        ],
      });

      const result = await getProxyEndpoint();

      expect(result).toBe('https://localhost:8443');
    });

    it('should handle DevSelfSigned mode correctly', async () => {
      const tauriUtils = await import('../../utils/tauri');
      vi.mocked(tauriUtils.safeInvoke).mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8443,
            mode: 'dev-self-signed',
          },
        ],
      });

      const result = await getProxyEndpoint();

      expect(result).toBe('https://localhost:8443');
    });

    it('should return null on error', async () => {
      const tauriUtils = await import('../../utils/tauri');
      vi.mocked(tauriUtils.safeInvoke).mockRejectedValueOnce(
        new Error('CLI error')
      );

      const result = await getProxyEndpoint();

      expect(result).toBeNull();
    });
  });
});
