/**
 * アプリケーションアップデート用のカスタムフック
 */

import { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../utils/tauri';
import { listen } from '@tauri-apps/api/event';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

/**
 * アップデートチェック結果
 */
export interface UpdateCheckResult {
  update_available: boolean;
  current_version: string;
  latest_version: string | null;
  release_notes: string | null;
  download_url: string | null;
}

/**
 * アップデート進捗情報
 */
export interface UpdateProgress {
  status: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  message: string | null;
}

/**
 * アップデートフックの戻り値
 */
export interface UseAppUpdateReturn {
  checking: boolean;
  installing: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  progress: UpdateProgress | null;
  error: string | null;
  checkUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

/**
 * アプリケーションアップデート機能を提供するフック
 */
export function useAppUpdate(options?: {
  autoCheck?: boolean;
  showNotification?: boolean;
}): UseAppUpdateReturn {
  const { showInfo, showWarning } = useNotifications();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasNotified, setHasNotified] = useState(false);

  /**
   * アップデートチェック
   */
  const checkUpdate = useCallback(async (silent = false) => {
    try {
      setChecking(true);
      setError(null);

      const result = await safeInvoke<UpdateCheckResult>('check_app_update');
      
      setUpdateAvailable(result.update_available);
      setCurrentVersion(result.current_version);
      setLatestVersion(result.latest_version || null);
      setReleaseNotes(result.release_notes || null);

      // アップデートが利用可能で、通知が有効な場合
      if (result.update_available && !silent && (options?.showNotification !== false) && !hasNotified) {
        setHasNotified(true);
        showInfo(
          'アップデートが利用可能です',
          `新しいバージョン ${result.latest_version} が利用可能です。設定画面でインストールできます。`,
          10000, // 10秒間表示
          {
            label: '設定画面を開く',
            onClick: () => {
              navigate('/settings');
            },
          }
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アップデートチェックに失敗しました';
      setError(errorMessage);
      setUpdateAvailable(false);
      
      // エラー通知（サイレントモードでない場合のみ）
      if (!silent && (options?.showNotification !== false)) {
        showWarning('アップデートチェックエラー', errorMessage);
      }
    } finally {
      setChecking(false);
    }
  }, [showInfo, showWarning, options?.showNotification, hasNotified]);

  /**
   * アップデートのインストール
   */
  const installUpdate = useCallback(async () => {
    try {
      setInstalling(true);
      setError(null);
      setProgress(null);

      // 進捗イベントをリッスン
      const unlisten = await listen<UpdateProgress>('app_update_progress', (event) => {
        if (event.payload) {
          setProgress(event.payload);
        }
      });

      // アップデートをインストール
      await safeInvoke('install_app_update');

      // イベントリスナーを解除
      unlisten();

      // インストール完了後、アプリケーションが再起動される
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップデートのインストールに失敗しました');
      setInstalling(false);
    }
  }, []);

  // アプリケーション起動時に自動チェック（オプション）
  useEffect(() => {
    if (options?.autoCheck !== false) {
      // アプリケーション起動後、少し遅延してから自動チェック
      const timer = setTimeout(() => {
        checkUpdate(true); // サイレントモードでチェック
      }, 5000); // 5秒後にチェック

      return () => clearTimeout(timer);
    }
  }, [options?.autoCheck, checkUpdate]);

  return {
    checking,
    installing,
    updateAvailable,
    currentVersion,
    latestVersion,
    releaseNotes,
    progress,
    error,
    checkUpdate,
    installUpdate,
  };
}

