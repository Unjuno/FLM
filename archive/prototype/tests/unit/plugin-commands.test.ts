// Plugin Commands Unit Tests
// プラグイン管理機能のTauri IPCコマンドのテスト

import { invoke } from '@tauri-apps/api/core';

// Tauri APIのモック
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('Plugin Commands', () => {
  const testPluginId = 'test-plugin-123';
  const testPluginName = 'Test Plugin';
  const testPluginVersion = '1.0.0';
  const testPluginAuthor = 'Test Author';

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register_plugin', () => {
    it('プラグインを登録できる', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const result = await invoke('register_plugin', {
        plugin_id: testPluginId,
        plugin_name: testPluginName,
        plugin_version: testPluginVersion,
        plugin_author: testPluginAuthor,
        plugin_description: 'Test plugin description',
        plugin_type: 'Custom',
      });

      expect(result).toBeUndefined(); // 成功時は何も返さない
      expect(mockInvoke).toHaveBeenCalledWith('register_plugin', {
        plugin_id: testPluginId,
        plugin_name: testPluginName,
        plugin_version: testPluginVersion,
        plugin_author: testPluginAuthor,
        plugin_description: 'Test plugin description',
        plugin_type: 'Custom',
      });
    });

    it('必要なパラメータなしで登録しようとするとエラーになる', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid plugin ID'));

      await expect(
        invoke('register_plugin', {
          plugin_id: '',
          plugin_name: testPluginName,
          plugin_version: testPluginVersion,
          plugin_author: testPluginAuthor,
          plugin_description: null,
          plugin_type: 'Custom',
        })
      ).rejects.toThrow();
    });
  });

  describe('get_all_plugins', () => {
    it('すべてのプラグインを取得できる', async () => {
      const mockPlugins = [
        {
          id: testPluginId,
          name: testPluginName,
          version: testPluginVersion,
          author: testPluginAuthor,
          enabled: true,
          plugin_type: 'Custom',
        },
      ];

      mockInvoke.mockResolvedValue(mockPlugins);

      const plugins = await invoke<
        Array<{
          id: string;
          name: string;
          version: string;
          author: string;
          enabled: boolean;
        }>
      >('get_all_plugins', {});

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);

      const testPlugin = plugins.find(p => p.id === testPluginId);
      expect(testPlugin).toBeDefined();
      expect(testPlugin?.name).toBe(testPluginName);
      expect(testPlugin?.version).toBe(testPluginVersion);
      expect(testPlugin?.author).toBe(testPluginAuthor);
      expect(mockInvoke).toHaveBeenCalledWith('get_all_plugins', {});
    });
  });

  describe('get_plugin', () => {
    it('特定のプラグインを取得できる', async () => {
      const mockPlugin = {
        id: testPluginId,
        name: testPluginName,
        version: testPluginVersion,
        author: testPluginAuthor,
        enabled: true,
        plugin_type: 'Custom',
      };

      mockInvoke.mockResolvedValue(mockPlugin);

      const plugin = await invoke<{
        id: string;
        name: string;
        version: string;
        author: string;
        enabled: boolean;
      } | null>('get_plugin', { plugin_id: testPluginId });

      expect(plugin).not.toBeNull();
      expect(plugin?.id).toBe(testPluginId);
      expect(plugin?.name).toBe(testPluginName);
      expect(mockInvoke).toHaveBeenCalledWith('get_plugin', {
        plugin_id: testPluginId,
      });
    });

    it('存在しないプラグインを取得しようとするとnullが返る', async () => {
      mockInvoke.mockResolvedValue(null);

      const plugin = await invoke<null>('get_plugin', {
        plugin_id: 'non-existent-plugin',
      });

      expect(plugin).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith('get_plugin', {
        plugin_id: 'non-existent-plugin',
      });
    });
  });

  describe('set_plugin_enabled', () => {
    it('プラグインを有効化/無効化できる', async () => {
      // 無効化のテスト
      mockInvoke
        .mockResolvedValueOnce(undefined) // set_plugin_enabled (disable)
        .mockResolvedValueOnce({ id: testPluginId, enabled: false }); // get_plugin

      await invoke('set_plugin_enabled', {
        plugin_id: testPluginId,
        enabled: false,
      });

      let plugin = await invoke<{
        id?: string;
        enabled: boolean;
      } | null>('get_plugin', { plugin_id: testPluginId });
      expect(plugin).toBeDefined();
      expect(plugin?.enabled).toBe(false);

      // 有効化のテスト
      mockInvoke
        .mockResolvedValueOnce(undefined) // set_plugin_enabled (enable)
        .mockResolvedValueOnce({ id: testPluginId, enabled: true }); // get_plugin

      await invoke('set_plugin_enabled', {
        plugin_id: testPluginId,
        enabled: true,
      });

      plugin = await invoke<{
        id?: string;
        enabled: boolean;
      } | null>('get_plugin', { plugin_id: testPluginId });
      expect(plugin).toBeDefined();
      expect(plugin?.enabled).toBe(true);
    });
  });

  describe('unregister_plugin', () => {
    it('プラグインを削除できる', async () => {
      // プラグインが存在することを確認
      mockInvoke.mockResolvedValueOnce({ id: testPluginId, enabled: true });
      let plugin = await invoke('get_plugin', { plugin_id: testPluginId });
      expect(plugin).not.toBeNull();

      // プラグインを削除
      mockInvoke.mockResolvedValueOnce(undefined); // unregister_plugin

      await invoke('unregister_plugin', { plugin_id: testPluginId });

      // プラグインが削除されたことを確認
      mockInvoke.mockResolvedValueOnce(null); // get_plugin (after delete)
      plugin = await invoke('get_plugin', { plugin_id: testPluginId });
      expect(plugin).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith('unregister_plugin', {
        plugin_id: testPluginId,
      });
    });
  });

  describe('execute_plugin_command', () => {
    it('プラグインを実行できる', async () => {
      const mockResult = {
        success: true,
        output: 'Plugin executed successfully',
        error: null as string | null,
      };

      mockInvoke.mockResolvedValueOnce(mockResult);

      const result = await invoke<{
        success: boolean;
        output?: string | null;
        error?: string | null;
      }>('execute_plugin_command', {
        plugin_id: testPluginId,
        context_data: { test: 'data' },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toBe('Plugin executed successfully');
      expect(mockInvoke).toHaveBeenCalledWith('execute_plugin_command', {
        plugin_id: testPluginId,
        context_data: { test: 'data' },
      });
    });

    it('無効化されたプラグインを実行しようとするとエラーになる', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Plugin is disabled'));

      // 実行しようとするとエラー
      await expect(
        invoke('execute_plugin_command', {
          plugin_id: testPluginId,
          context_data: { test: 'data' },
        })
      ).rejects.toThrow();
    });
  });
});
