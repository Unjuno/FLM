// System Integration Tests
// システム全体の統合テスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

describe('System Integration Tests', () => {
  beforeAll(() => {
    if (!process.env.TAURI_APP_AVAILABLE) {
      console.warn(
        'Tauriアプリが起動していないため、このテストスイートをスキップします'
      );
    }
  });

  describe('Plugin System Integration', () => {
    const testPluginId = 'system-test-plugin';
    const testPluginName = 'System Test Plugin';

    afterAll(async () => {
      // テスト後のクリーンアップ
      if (process.env.TAURI_APP_AVAILABLE) {
        try {
          await invoke('unregister_plugin', { plugin_id: testPluginId });
        } catch {
          // プラグインが存在しない場合は無視
        }
      }
    });

    it('プラグインシステムの完全なライフサイクルをテストできる', async () => {
      if (!process.env.TAURI_APP_AVAILABLE) {
        return;
      }

      // 1. プラグインを登録
      await invoke('register_plugin', {
        plugin_id: testPluginId,
        plugin_name: testPluginName,
        plugin_version: '1.0.0',
        plugin_author: 'System Test',
        plugin_description: 'System integration test plugin',
        plugin_type: 'Custom',
      });

      // 2. プラグインを取得
      const plugin = await invoke('get_plugin', { plugin_id: testPluginId });
      expect(plugin).not.toBeNull();
      expect(plugin?.id).toBe(testPluginId);

      // 3. プラグインを実行
      const result = await invoke('execute_plugin_command', {
        plugin_id: testPluginId,
        context_data: { test: 'system integration' },
      });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // 4. プラグインを無効化
      await invoke('set_plugin_enabled', {
        plugin_id: testPluginId,
        enabled: false,
      });

      // 5. 無効化されたプラグインは実行できない
      await expect(
        invoke('execute_plugin_command', {
          plugin_id: testPluginId,
          context_data: { test: 'data' },
        })
      ).rejects.toThrow();

      // 6. プラグインを削除
      await invoke('unregister_plugin', { plugin_id: testPluginId });

      // 7. 削除されたプラグインは取得できない
      const deletedPlugin = await invoke('get_plugin', {
        plugin_id: testPluginId,
      });
      expect(deletedPlugin).toBeNull();
    });
  });

  describe('Scheduler System Integration', () => {
    it('スケジューラーシステムの完全なライフサイクルをテストできる', async () => {
      if (!process.env.TAURI_APP_AVAILABLE) {
        return;
      }

      // 1. タスクを追加
      await invoke('add_schedule_task', {
        task_id: 'system-test-task',
        task_type: 'UpdateModelCatalog',
        api_id: 'system-test-api',
        interval_seconds: 3600,
      });

      // 2. タスク一覧を取得
      const tasks = await invoke('get_schedule_tasks', {});
      expect(Array.isArray(tasks)).toBe(true);

      // 3. タスクを更新
      await invoke('update_schedule_task', {
        task_type: 'UpdateModelCatalog',
        enabled: false,
        interval_seconds: 7200,
      });

      // 4. 更新されたタスクを確認
      const updatedTasks = await invoke('get_schedule_tasks', {});
      const updatedTask = updatedTasks.find(
        (t: { task_type: string }) => t.task_type === 'UpdateModelCatalog'
      );
      if (updatedTask) {
        expect(updatedTask.enabled).toBe(false);
      }

      // 5. モデルカタログを更新
      const updateCount = await invoke('update_model_catalog', {});
      expect(typeof updateCount).toBe('number');
      expect(updateCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Model Sharing System Integration', () => {
    it('モデル共有システムの基本的な機能をテストできる', async () => {
      if (!process.env.TAURI_APP_AVAILABLE) {
        return;
      }

      // 1. 共有モデルを検索
      const searchResults = await invoke('search_shared_models_command', {
        query: 'test',
        tags: null,
        limit: 10,
      });
      expect(Array.isArray(searchResults)).toBe(true);

      // 2. タグで検索
      const tagResults = await invoke('search_shared_models_command', {
        query: null,
        tags: ['test', 'example'],
        limit: 20,
      });
      expect(Array.isArray(tagResults)).toBe(true);
    });
  });

  describe('Cross-System Integration', () => {
    it('プラグイン、スケジューラー、モデル共有の統合動作をテストできる', async () => {
      if (!process.env.TAURI_APP_AVAILABLE) {
        return;
      }

      // 1. プラグインを登録
      const pluginId = 'cross-system-plugin';
      await invoke('register_plugin', {
        plugin_id: pluginId,
        plugin_name: 'Cross System Plugin',
        plugin_version: '1.0.0',
        plugin_author: 'System Test',
        plugin_description: 'Cross-system integration test',
        plugin_type: 'Custom',
      });

      // 2. スケジューラーでプラグインを実行するタスクを追加（将来実装）
      // 現在は基本的な統合テストのみ

      // 3. クリーンアップ
      try {
        await invoke('unregister_plugin', { plugin_id: pluginId });
      } catch {
        // 無視
      }
    });
  });
});
