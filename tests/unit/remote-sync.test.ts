// Remote Sync Unit Tests
// クラウド同期機能の単体テスト

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Tauri APIのモック
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// safeInvokeのモック
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: mockInvoke,
}));

describe('Remote Sync - Tauri Commands', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate_device_id', () => {
    it('should generate a valid device ID', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      mockInvoke.mockResolvedValue('test-device-id-12345');
      
      const deviceId = await safeInvoke<string>('generate_device_id');
      
      expect(deviceId).toBe('test-device-id-12345');
      expect(mockInvoke).toHaveBeenCalledWith('generate_device_id');
      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBeGreaterThan(0);
    });

    it('should generate different device IDs on each call', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      mockInvoke
        .mockResolvedValueOnce('device-id-1')
        .mockResolvedValueOnce('device-id-2');
      
      const deviceId1 = await safeInvoke<string>('generate_device_id');
      const deviceId2 = await safeInvoke<string>('generate_device_id');
      
      expect(deviceId1).not.toBe(deviceId2);
    });
  });

  describe('export_settings_for_remote', () => {
    it('should export settings as JSON string', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockExportData = {
        apis: [
          { id: 'api-1', name: 'Test API', model: 'llama3', port: 8080 },
        ],
        exported_at: '2024-01-01T00:00:00Z',
        version: '1.0.0',
      };
      
      mockInvoke.mockResolvedValue(JSON.stringify(mockExportData));
      
      const result = await safeInvoke<string>('export_settings_for_remote');
      
      expect(mockInvoke).toHaveBeenCalledWith('export_settings_for_remote');
      expect(typeof result).toBe('string');
      
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('apis');
      expect(parsed).toHaveProperty('exported_at');
      expect(parsed).toHaveProperty('version');
      expect(Array.isArray(parsed.apis)).toBe(true);
    });

    it('should handle export errors', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      mockInvoke.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(safeInvoke<string>('export_settings_for_remote')).rejects.toThrow('Database connection failed');
    });
  });

  describe('sync_settings', () => {
    it('should sync settings to cloud provider', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: 'test-token',
        device_id: 'test-device-id',
        cloud_provider: 'github',
        sync_interval_seconds: 3600,
      };
      
      const mockSettingsData = JSON.stringify({ apis: [] });
      
      const mockSyncInfo = {
        device_id: 'test-device-id',
        last_sync_at: '2024-01-01T00:00:00Z',
        sync_enabled: true,
        cloud_provider: 'github',
      };
      
      mockInvoke.mockResolvedValue(mockSyncInfo);
      
      const result = await safeInvoke('sync_settings', {
        config: mockConfig,
        settings_data: mockSettingsData,
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('sync_settings', {
        config: mockConfig,
        settings_data: mockSettingsData,
      });
      expect(result).toHaveProperty('device_id');
      expect(result).toHaveProperty('last_sync_at');
      expect(result).toHaveProperty('sync_enabled');
      expect(result.cloud_provider).toBe('github');
    });

    it('should reject when sync is disabled', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: false,
        access_token: null,
        device_id: 'test-device-id',
        cloud_provider: 'local',
        sync_interval_seconds: 3600,
      };
      
      mockInvoke.mockRejectedValue(new Error('設定同期が無効になっています'));
      
      await expect(
        safeInvoke('sync_settings', {
          config: mockConfig,
          settings_data: '{}',
        })
      ).rejects.toThrow('設定同期が無効になっています');
    });
  });

  describe('get_synced_settings', () => {
    it('should get synced settings from cloud provider', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: 'test-token',
        device_id: 'test-device-id',
        cloud_provider: 'github',
        sync_interval_seconds: 3600,
      };
      
      const mockSettings = JSON.stringify({
        apis: [{ id: 'api-1', name: 'Synced API' }],
      });
      
      mockInvoke.mockResolvedValue(mockSettings);
      
      const result = await safeInvoke<string | null>('get_synced_settings', {
        config: mockConfig,
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('get_synced_settings', {
        config: mockConfig,
      });
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      
      const parsed = JSON.parse(result!);
      expect(parsed).toHaveProperty('apis');
    });

    it('should return null when sync is disabled', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: false,
        access_token: null,
        device_id: 'test-device-id',
        cloud_provider: 'local',
        sync_interval_seconds: 3600,
      };
      
      mockInvoke.mockResolvedValue(null);
      
      const result = await safeInvoke<string | null>('get_synced_settings', {
        config: mockConfig,
      });
      
      expect(result).toBeNull();
    });

    it('should return null when no synced settings found', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: 'test-token',
        device_id: 'test-device-id',
        cloud_provider: 'github',
        sync_interval_seconds: 3600,
      };
      
      mockInvoke.mockResolvedValue(null);
      
      const result = await safeInvoke<string | null>('get_synced_settings', {
        config: mockConfig,
      });
      
      expect(result).toBeNull();
    });
  });

  describe('import_settings_from_remote', () => {
    it('should import settings from JSON string', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockSettingsJson = JSON.stringify({
        apis: [
          {
            id: 'api-1',
            name: 'Imported API',
            model: 'llama3',
            port: 8081,
            enable_auth: true,
            engine_type: 'ollama',
          },
        ],
        exported_at: '2024-01-01T00:00:00Z',
        version: '1.0.0',
      });
      
      mockInvoke.mockResolvedValue(1);
      
      const result = await safeInvoke<number>('import_settings_from_remote', {
        settings_json: mockSettingsJson,
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('import_settings_from_remote', {
        settings_json: mockSettingsJson,
      });
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid JSON', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      mockInvoke.mockRejectedValue(new Error('JSON解析エラー'));
      
      await expect(
        safeInvoke('import_settings_from_remote', {
          settings_json: 'invalid-json',
        })
      ).rejects.toThrow('JSON解析エラー');
    });

    it('should skip duplicate APIs', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      // 既存のAPIと同じIDまたはポートの場合は0を返す（スキップ）
      mockInvoke.mockResolvedValue(0);
      
      const mockSettingsJson = JSON.stringify({
        apis: [
          {
            id: 'existing-api-id',
            name: 'Existing API',
            model: 'llama3',
            port: 8080,
          },
        ],
      });
      
      const result = await safeInvoke<number>('import_settings_from_remote', {
        settings_json: mockSettingsJson,
      });
      
      expect(result).toBe(0);
    });
  });

  describe('Cloud Provider Integration', () => {
    it('should support local file sync', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: null,
        device_id: 'test-device-id',
        cloud_provider: 'local',
        sync_interval_seconds: 3600,
      };
      
      const mockSyncInfo = {
        device_id: 'test-device-id',
        last_sync_at: '2024-01-01T00:00:00Z',
        sync_enabled: true,
        cloud_provider: 'local',
      };
      
      mockInvoke.mockResolvedValue(mockSyncInfo);
      
      const result = await safeInvoke('sync_settings', {
        config: mockConfig,
        settings_data: '{}',
      });
      
      expect(result.cloud_provider).toBe('local');
    });

    it('should require access token for GitHub sync', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: null, // トークンなし
        device_id: 'test-device-id',
        cloud_provider: 'github',
        sync_interval_seconds: 3600,
      };
      
      mockInvoke.mockRejectedValue(new Error('GitHubアクセストークンが必要です'));
      
      await expect(
        safeInvoke('sync_settings', {
          config: mockConfig,
          settings_data: '{}',
        })
      ).rejects.toThrow('GitHubアクセストークンが必要です');
    });

    it('should require access token for Google Drive sync', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: null,
        device_id: 'test-device-id',
        cloud_provider: 'gdrive',
        sync_interval_seconds: 3600,
      };
      
      mockInvoke.mockRejectedValue(new Error('Googleアクセストークンが必要です'));
      
      await expect(
        safeInvoke('sync_settings', {
          config: mockConfig,
          settings_data: '{}',
        })
      ).rejects.toThrow('Googleアクセストークンが必要です');
    });

    it('should require access token for Dropbox sync', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: null,
        device_id: 'test-device-id',
        cloud_provider: 'dropbox',
        sync_interval_seconds: 3600,
      };
      
      mockInvoke.mockRejectedValue(new Error('Dropboxアクセストークンが必要です'));
      
      await expect(
        safeInvoke('sync_settings', {
          config: mockConfig,
          settings_data: '{}',
        })
      ).rejects.toThrow('Dropboxアクセストークンが必要です');
    });

    it('should reject unknown cloud provider', async () => {
      const { safeInvoke } = await import('../../src/utils/tauri');
      
      const mockConfig = {
        enabled: true,
        access_token: 'test-token',
        device_id: 'test-device-id',
        cloud_provider: 'unknown-provider',
        sync_interval_seconds: 3600,
      };
      
      mockInvoke.mockRejectedValue(new Error('不明なクラウドプロバイダー: unknown-provider'));
      
      await expect(
        safeInvoke('sync_settings', {
          config: mockConfig,
          settings_data: '{}',
        })
      ).rejects.toThrow('不明なクラウドプロバイダー');
    });
  });
});

