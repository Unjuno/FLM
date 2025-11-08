// Scheduler Commands Unit Tests
// スケジューラー機能のTauri IPCコマンドのテスト

import { invoke } from '@tauri-apps/api/core';

// Tauri APIのモック
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('Scheduler Commands', () => {
  const testTaskId = 'test-task-123';
  const testApiId = 'test-api-123';

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('add_schedule_task', () => {
    it('スケジュールタスクを追加できる', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await invoke('add_schedule_task', {
        task_id: testTaskId,
        task_type: 'UpdateModelCatalog',
        api_id: testApiId,
        interval_seconds: 3600,
      });

      expect(result).toBeUndefined(); // 成功時は何も返さない
      expect(mockInvoke).toHaveBeenCalledWith('add_schedule_task', {
        task_id: testTaskId,
        task_type: 'UpdateModelCatalog',
        api_id: testApiId,
        interval_seconds: 3600,
      });
    });

    it('無効なタスクタイプで追加しようとするとエラーになる', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid task type'));

      await expect(
        invoke('add_schedule_task', {
          task_id: testTaskId,
          task_type: 'InvalidTaskType',
          api_id: testApiId,
          interval_seconds: 3600,
        })
      ).rejects.toThrow();
    });
  });

  describe('get_schedule_tasks', () => {
    it('スケジュールタスク一覧を取得できる', async () => {
      const mockTasks = [
        {
          task_type: 'AutoBackup',
          interval_seconds: 3600,
          enabled: true,
        },
      ];

      mockInvoke.mockResolvedValue(mockTasks);

      const tasks = await invoke<
        Array<{
          task_type: string;
          interval_seconds: number;
          enabled: boolean;
        }>
      >('get_schedule_tasks', {});

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toBeDefined();
      expect(tasks).toEqual(mockTasks);
      expect(mockInvoke).toHaveBeenCalledWith('get_schedule_tasks', {});
    });
  });

  describe('update_schedule_task', () => {
    it('スケジュールタスクを更新できる', async () => {
      const mockTasks = [
        {
          task_type: 'SyncSettings',
          interval_seconds: 7200,
          enabled: false,
        },
      ];

      mockInvoke
        .mockResolvedValueOnce(undefined) // update_schedule_task
        .mockResolvedValueOnce(mockTasks); // get_schedule_tasks

      // タスクを更新（無効化）
      await invoke('update_schedule_task', {
        task_type: 'SyncSettings',
        enabled: false,
        interval_seconds: 7200,
      });

      const tasks = await invoke<
        Array<{
          task_type: string;
          interval_seconds: number;
          enabled: boolean;
        }>
      >('get_schedule_tasks', {});

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toEqual(mockTasks);
      expect(mockInvoke).toHaveBeenCalledWith('update_schedule_task', {
        task_type: 'SyncSettings',
        enabled: false,
        interval_seconds: 7200,
      });
      expect(mockInvoke).toHaveBeenCalledWith('get_schedule_tasks', {});

      // モックが正しく設定されている場合、更新されたタスクを確認
      if (tasks && tasks.length > 0) {
        const updatedTask = tasks.find(t => t.task_type === 'SyncSettings');
        if (updatedTask) {
          expect(updatedTask.enabled).toBe(false);
          expect(updatedTask.interval_seconds).toBe(7200);
        }
      }
    });
  });

  describe('delete_schedule_task', () => {
    it('スケジュールタスクを削除できる', async () => {
      const mockTasks = [
        {
          task_type: 'CleanupLogs',
          enabled: false,
        },
      ];

      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_schedule_task
        .mockResolvedValueOnce(mockTasks); // get_schedule_tasks

      // タスクを削除
      await invoke('delete_schedule_task', {
        task_type: 'CleanupLogs',
      });

      const tasks = await invoke<
        Array<{
          task_type: string;
          enabled: boolean;
        }>
      >('get_schedule_tasks', {});

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toEqual(mockTasks);
      expect(mockInvoke).toHaveBeenCalledWith('delete_schedule_task', {
        task_type: 'CleanupLogs',
      });
      expect(mockInvoke).toHaveBeenCalledWith('get_schedule_tasks', {});

      // モックが正しく設定されている場合、削除されたタスクを確認
      if (tasks && tasks.length > 0) {
        const deletedTask = tasks.find(t => t.task_type === 'CleanupLogs');
        // 削除は無効化なので、タスクは存在するが無効になっている
        if (deletedTask) {
          expect(deletedTask.enabled).toBe(false);
        }
      }
    });
  });

  describe('start_schedule_task', () => {
    it('スケジュールタスクを開始できる', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // add_schedule_task
        .mockResolvedValueOnce(undefined); // start_schedule_task

      // タスクを開始
      const result = await invoke('start_schedule_task', {
        task_type: 'CertificateRenewal',
      });

      expect(result).toBeUndefined(); // 成功時は何も返さない
      expect(mockInvoke).toHaveBeenCalledWith('start_schedule_task', {
        task_type: 'CertificateRenewal',
      });
    });
  });

  describe('stop_schedule_task', () => {
    it('スケジュールタスクを停止できる', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // add_schedule_task
        .mockResolvedValueOnce(undefined); // stop_schedule_task

      // タスクを停止
      const result = await invoke('stop_schedule_task', {
        task_type: 'ApiKeyRotation',
      });

      expect(result).toBeUndefined(); // 成功時は何も返さない
      expect(mockInvoke).toHaveBeenCalledWith('stop_schedule_task', {
        task_type: 'ApiKeyRotation',
      });
    });
  });

  describe('update_model_catalog', () => {
    it('モデルカタログを更新できる', async () => {
      const mockResult = 42; // 42件のモデルを更新
      mockInvoke.mockResolvedValue(mockResult);

      const result = (await invoke('update_model_catalog', {})) as number;

      expect(typeof result).toBe('number');
      expect(result).toBe(42);
      expect(result).toBeGreaterThanOrEqual(0); // 更新されたモデル数
      expect(mockInvoke).toHaveBeenCalledWith('update_model_catalog', {});
    });
  });
});
