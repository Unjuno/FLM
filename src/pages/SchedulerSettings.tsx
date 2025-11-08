// SchedulerSettings - スケジューラ設定ページ
// 定期タスクの設定（モデルカタログ更新、自動バックアップ、証明書更新等）

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './SchedulerSettings.css';

/**
 * スケジュールタスク情報
 */
interface ScheduleTask {
  id?: string;
  task_type: string;
  interval_seconds: number;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

/**
 * スケジューラ設定ページ
 */
export const SchedulerSettings: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  useEffect(() => {
    loadTasks();
  }, []);

  /**
   * タスク一覧を読み込む
   */
  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // スケジュールタスク一覧を取得
      try {
        const tasksData = await safeInvoke<ScheduleTask[]>(
          'get_schedule_tasks',
          {}
        );
        if (tasksData && tasksData.length > 0) {
          setTasks(tasksData);
        } else {
          // デフォルトタスクを設定（タスクが存在しない場合）
          const defaultTasks: ScheduleTask[] = [
            {
              task_type: 'UpdateModelCatalog',
              interval_seconds: 86400, // 24時間
              enabled: false,
            },
            {
              task_type: 'AutoBackup',
              interval_seconds: 604800, // 7日
              enabled: false,
            },
            {
              task_type: 'SyncSettings',
              interval_seconds: 3600, // 1時間
              enabled: false,
            },
            {
              task_type: 'CleanupLogs',
              interval_seconds: 86400, // 24時間
              enabled: false,
            },
            {
              task_type: 'CertificateRenewal',
              interval_seconds: 2592000, // 30日
              enabled: false,
            },
          ];

          setTasks(defaultTasks);
        }
      } catch (invokeErr) {
        // エラーが発生した場合はデフォルトタスクを使用
        const defaultTasks: ScheduleTask[] = [
          {
            task_type: 'UpdateModelCatalog',
            interval_seconds: 86400, // 24時間
            enabled: false,
          },
          {
            task_type: 'AutoBackup',
            interval_seconds: 604800, // 7日
            enabled: false,
          },
          {
            task_type: 'SyncSettings',
            interval_seconds: 3600, // 1時間
            enabled: false,
          },
          {
            task_type: 'CleanupLogs',
            interval_seconds: 86400, // 24時間
            enabled: false,
          },
          {
            task_type: 'CertificateRenewal',
            interval_seconds: 2592000, // 30日
            enabled: false,
          },
        ];

        setTasks(defaultTasks);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'タスクの読み込みに失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * タスクを追加または更新
   */
  const handleSaveTask = async (task: ScheduleTask) => {
    try {
      setSaving(true);

      await safeInvoke('add_schedule_task', {
        task_id: task.id || `task-${Date.now()}`,
        task_type: task.task_type,
        api_id: 'default',
        interval_seconds: task.interval_seconds,
      });

      showSuccess('タスクを保存しました');
      loadTasks();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'タスクの保存に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * タスクを開始
   */
  const handleStartTask = async (taskType: string) => {
    try {
      setSaving(true);

      await safeInvoke('start_schedule_task', { task_type: taskType });

      showSuccess('タスクを開始しました');
      loadTasks();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'タスクの開始に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * タスクタイプの表示名を取得
   */
  const getTaskTypeName = (taskType: string): string => {
    const names: { [key: string]: string } = {
      UpdateModelCatalog: 'モデルカタログ更新',
      AutoBackup: '自動バックアップ',
      SyncSettings: '設定同期',
      CleanupLogs: 'ログクリーンアップ',
      CertificateRenewal: '証明書更新',
    };
    return names[taskType] || taskType;
  };

  /**
   * 間隔を表示形式に変換
   */
  const formatInterval = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}分`;
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}時間`;
    } else {
      return `${Math.floor(seconds / 86400)}日`;
    }
  };

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: 'ホーム', path: '/' },
    { label: '設定', path: '/settings' },
    { label: 'スケジューラ設定' },
  ], []);

  if (loading) {
    return (
      <div className="scheduler-settings-page">
        <div className="scheduler-settings-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="scheduler-settings-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="200px" />
          </header>
          <div className="scheduler-settings-content">
            <SkeletonLoader type="paragraph" count={1} />
            <SkeletonLoader type="card" count={5} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scheduler-settings-page">
      <div className="scheduler-settings-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="scheduler-settings-header">
          <button className="back-button" onClick={() => navigate('/settings')}>
            ← 戻る
          </button>
          <h1>スケジューラ設定</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="scheduler-settings-content">
          <p className="scheduler-description">
            定期タスクを設定して、自動的に実行される処理を管理できます。
          </p>

          <div className="schedule-tasks-list">
            {tasks.map((task, index) => (
              <div key={index} className="schedule-task-item">
                <div className="schedule-task-header">
                  <h3 className="schedule-task-title">
                    {getTaskTypeName(task.task_type)}
                  </h3>
                  <label className="schedule-task-toggle">
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      onChange={e => {
                        const updatedTasks = [...tasks];
                        updatedTasks[index].enabled = e.target.checked;
                        setTasks(updatedTasks);
                        handleSaveTask(updatedTasks[index]);
                      }}
                      disabled={saving}
                    />
                    <span>{task.enabled ? '有効' : '無効'}</span>
                  </label>
                </div>

                <div className="schedule-task-body">
                  <div className="schedule-task-field">
                    <label
                      htmlFor={`task-interval-${index}`}
                      className="schedule-task-label"
                    >
                      実行間隔
                    </label>
                    <div className="schedule-task-interval-input">
                      <input
                        id={`task-interval-${index}`}
                        type="number"
                        className="form-input"
                        min="60"
                        max="31536000"
                        value={task.interval_seconds}
                        aria-label="実行間隔（秒）"
                        title="実行間隔（秒）"
                        placeholder="3600"
                        onChange={e => {
                          const updatedTasks = [...tasks];
                          updatedTasks[index].interval_seconds =
                            parseInt(e.target.value) || 3600;
                          setTasks(updatedTasks);
                        }}
                        disabled={saving}
                      />
                      <span className="schedule-task-interval-display">
                        ({formatInterval(task.interval_seconds)})
                      </span>
                    </div>
                    <small className="form-hint">
                      タスクの実行間隔を秒単位で設定します
                    </small>
                  </div>

                  {task.last_run && (
                    <div className="schedule-task-info">
                      <span className="schedule-task-info-label">
                        最終実行:
                      </span>
                      <span className="schedule-task-info-value">
                        {task.last_run}
                      </span>
                    </div>
                  )}

                  {task.next_run && (
                    <div className="schedule-task-info">
                      <span className="schedule-task-info-label">
                        次回実行:
                      </span>
                      <span className="schedule-task-info-value">
                        {task.next_run}
                      </span>
                    </div>
                  )}

                  <div className="schedule-task-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        startTransition(() => {
                          handleStartTask(task.task_type);
                        });
                      }}
                      disabled={saving || !task.enabled || isPending}
                    >
                      今すぐ実行
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => {
                        startTransition(() => {
                          handleSaveTask(task);
                        });
                      }}
                      disabled={saving || isPending}
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
