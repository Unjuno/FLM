// Tauri IPC commands integration tests
// Tests the IPC bridge commands that communicate with the flm CLI

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { safeInvoke, extractCliError } from '../utils/tauri';

// Mock is already set up in src/test/setup.ts
// We just need to clear mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

describe('IPC Commands Integration', () => {
  describe('ipc_detect_engines', () => {
    it('should detect engines with fresh flag', async () => {
      const mockResponse = {
        version: '1.0',
        data: [
          {
            id: 'ollama',
            status: 'running',
            base_url: 'http://localhost:11434',
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_detect_engines', { fresh: true });

      expect(invoke).toHaveBeenCalledWith('ipc_detect_engines', { fresh: true });
      expect(result).toEqual(mockResponse);
    });

    it('should detect engines without fresh flag', async () => {
      const mockResponse = {
        version: '1.0',
        data: [],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_detect_engines', { fresh: false });

      expect(invoke).toHaveBeenCalledWith('ipc_detect_engines', { fresh: false });
      expect(result).toEqual(mockResponse);
    });

    it('should handle CLI errors', async () => {
      const cliError = {
        code: 'CLI_ERROR',
        message: 'Failed to detect engines',
        stderr: 'Error: Engine detection failed',
      };

      vi.mocked(invoke).mockRejectedValueOnce(cliError);

      await expect(safeInvoke('ipc_detect_engines', { fresh: false })).rejects.toThrow();

      try {
        await safeInvoke('ipc_detect_engines', { fresh: false });
      } catch (error) {
        const extracted = extractCliError(error);
        expect(extracted).toEqual({
          code: 'CLI_ERROR',
          message: 'Failed to detect engines',
          stderr: 'Error: Engine detection failed',
          originalError: cliError,
        });
      }
    });
  });

  describe('ipc_list_models', () => {
    it('should list all models', async () => {
      const mockResponse = {
        version: '1.0',
        data: [
          {
            id: 'llama3',
            engine: 'ollama',
            name: 'Llama 3',
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_list_models', { engine: null });

      expect(invoke).toHaveBeenCalledWith('ipc_list_models', { engine: null });
      expect(result).toEqual(mockResponse);
    });

    it('should list models for specific engine', async () => {
      const mockResponse = {
        version: '1.0',
        data: [
          {
            id: 'llama3',
            engine: 'ollama',
            name: 'Llama 3',
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_list_models', { engine: 'ollama' });

      expect(invoke).toHaveBeenCalledWith('ipc_list_models', { engine: 'ollama' });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('ipc_proxy_start', () => {
    it('should start proxy with minimal config', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'started',
          port: 8080,
          mode: 'dev-selfsigned',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const config = {
        mode: 'dev-selfsigned',
        port: 8080,
        bind: null,
        engine_base_url: null,
        acme_email: null,
        acme_domain: null,
        no_daemon: false,
      };

      const result = await safeInvoke('ipc_proxy_start', { config });

      expect(invoke).toHaveBeenCalledWith('ipc_proxy_start', { config });
      expect(result).toEqual(mockResponse);
    });

    it('should start proxy with full config', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'started',
          port: 8443,
          mode: 'https-acme',
          handle_id: 'proxy-123',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const config = {
        mode: 'https-acme',
        port: 8443,
        bind: '0.0.0.0',
        engine_base_url: 'http://localhost:11434',
        acme_email: 'test@example.com',
        acme_domain: 'example.com',
        no_daemon: true,
      };

      const result = await safeInvoke('ipc_proxy_start', { config });

      expect(invoke).toHaveBeenCalledWith('ipc_proxy_start', { config });
      expect(result).toEqual(mockResponse);
    });

    it('should handle proxy start errors', async () => {
      const cliError = {
        code: 'PROXY_START_FAILED',
        message: 'Failed to start proxy',
        stderr: 'Error: Port already in use',
      };

      vi.mocked(invoke).mockRejectedValueOnce(cliError);

      const config = {
        mode: 'dev-selfsigned',
        port: 8080,
        bind: null,
        engine_base_url: null,
        acme_email: null,
        acme_domain: null,
        no_daemon: false,
      };

      await expect(safeInvoke('ipc_proxy_start', { config })).rejects.toThrow();
    });
  });

  describe('ipc_proxy_status', () => {
    it('should get proxy status when running', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'running',
          port: 8080,
          mode: 'dev-selfsigned',
          handle_id: 'proxy-123',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_proxy_status');

      expect(invoke).toHaveBeenCalledWith('ipc_proxy_status');
      expect(result).toEqual(mockResponse);
    });

    it('should get proxy status when stopped', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'stopped',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_proxy_status');

      expect(invoke).toHaveBeenCalledWith('ipc_proxy_status');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('ipc_proxy_stop', () => {
    it('should stop proxy by port', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'stopped',
          port: 8080,
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        port: 8080,
        handle_id: null,
      };

      const result = await safeInvoke('ipc_proxy_stop', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_proxy_stop', { payload });
      expect(result).toEqual(mockResponse);
    });

    it('should stop proxy by handle_id', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'stopped',
          handle_id: 'proxy-123',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        port: null,
        handle_id: 'proxy-123',
      };

      const result = await safeInvoke('ipc_proxy_stop', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_proxy_stop', { payload });
      expect(result).toEqual(mockResponse);
    });

    it('should handle invalid stop request', async () => {
      const cliError = {
        code: 'INVALID_INPUT',
        message: 'Either port or handle_id must be specified',
        stderr: null,
      };

      vi.mocked(invoke).mockRejectedValueOnce(cliError);

      const payload = {
        port: null,
        handle_id: null,
      };

      await expect(safeInvoke('ipc_proxy_stop', { payload })).rejects.toThrow();
    });
  });

  describe('ipc_api_keys', () => {
    it('should list API keys', async () => {
      const mockResponse = {
        version: '1.0',
        data: [
          {
            id: 'key-123',
            label: 'Test Key',
            created_at: '2025-01-28T00:00:00Z',
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_api_keys_list');

      expect(invoke).toHaveBeenCalledWith('ipc_api_keys_list');
      expect(result).toEqual(mockResponse);
    });

    it('should create API key', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          id: 'key-123',
          label: 'Test Key',
          key: 'flm_xxxxxxxxxxxx',
          created_at: '2025-01-28T00:00:00Z',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        label: 'Test Key',
      };

      const result = await safeInvoke('ipc_api_keys_create', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_api_keys_create', { payload });
      expect(result).toEqual(mockResponse);
    });

    it('should revoke API key', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'revoked',
          id: 'key-123',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        id: 'key-123',
      };

      const result = await safeInvoke('ipc_api_keys_revoke', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_api_keys_revoke', { payload });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('ipc_config', () => {
    it('should list config', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          preferred_language: 'ja',
          theme: 'light',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_config_list');

      expect(invoke).toHaveBeenCalledWith('ipc_config_list');
      expect(result).toEqual(mockResponse);
    });

    it('should get config value', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          key: 'preferred_language',
          value: 'ja',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        key: 'preferred_language',
      };

      const result = await safeInvoke('ipc_config_get', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_config_get', { payload });
      expect(result).toEqual(mockResponse);
    });

    it('should set config value', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'updated',
          key: 'preferred_language',
          value: 'en',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        key: 'preferred_language',
        value: 'en',
      };

      const result = await safeInvoke('ipc_config_set', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_config_set', { payload });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('ipc_security', () => {
    it('should get security policy', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          rate_limit: {
            enabled: true,
            requests_per_minute: 60,
          },
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('ipc_security_policy_show');

      expect(invoke).toHaveBeenCalledWith('ipc_security_policy_show');
      expect(result).toEqual(mockResponse);
    });

    it('should set security policy', async () => {
      const mockResponse = {
        version: '1.0',
        data: {
          status: 'updated',
        },
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        policy: {
          rate_limit: {
            enabled: true,
            requests_per_minute: 60,
          },
        },
      };

      const result = await safeInvoke('ipc_security_policy_set', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_security_policy_set', { payload });
      expect(result).toEqual(mockResponse);
    });

    it('should get audit logs', async () => {
      const mockResponse = {
        version: '1.0',
        data: [
          {
            id: 'log-1',
            timestamp: '2025-01-28T00:00:00Z',
            event_type: 'api_request',
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const payload = {
        limit: 10,
        offset: 0,
      };

      const result = await safeInvoke('ipc_security_audit_logs', { payload });

      expect(invoke).toHaveBeenCalledWith('ipc_security_audit_logs', { payload });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('get_platform', () => {
    it('should get platform information', async () => {
      const mockResponse = {
        platform: 'windows',
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResponse);

      const result = await safeInvoke('get_platform');

      expect(invoke).toHaveBeenCalledWith('get_platform');
      expect(result).toEqual(mockResponse);
    });
  });
});
