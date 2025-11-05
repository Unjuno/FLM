// BackupRestore - バックアップ・復元ページ

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import './BackupRestore.css';

/**
 * バックアップレスポンス
 */
interface BackupResponse {
  file_path: string;
  file_size: number;
  api_count: number;
  model_count: number;
  log_count: number;
  json_data: string; // バックアップデータのJSON文字列
}

/**
 * 復元レスポンス
 */
interface RestoreResponse {
  api_count: number;
  api_key_count: number;
  model_count: number;
  log_count: number;
}

/**
 * バックアップ・復元ページコンポーネント
 */
export const BackupRestore: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResponse | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  /**
   * バックアップを作成
   */
  const handleCreateBackup = useCallback(async () => {
    try {
      setBackingUp(true);
      setError(null);
      setSuccessMessage(null);
      setBackupResult(null);

      // デフォルトのファイル名を生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFileName = `flm-backup-${timestamp}.json`;

      // バックアップを作成（output_pathは空文字列でOK、JSONデータを直接取得）
      const result = await safeInvoke<BackupResponse>('create_backup', {
        output_path: '', // ファイル保存はオプション、JSONデータを直接取得
      });

      // バックアップファイルをダウンロード
      if (result.json_data) {
        const blob = new Blob([result.json_data], {
          type: 'application/json;charset=utf-8;',
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setBackupResult(result);
      
      // 成功メッセージ
      const message = `バックアップを作成しました\n` +
        `ファイルサイズ: ${formatFileSize(result.file_size)}\n` +
        `API: ${result.api_count}件, モデル: ${result.model_count}件, ログ: ${result.log_count}件`;
      
      setSuccessMessage(message);
      showSuccess('バックアップを作成しました');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'バックアップの作成に失敗しました';
      setError(errorMessage);
      showError('バックアップの作成に失敗しました', errorMessage);
    } finally {
      setBackingUp(false);
    }
  }, [showSuccess, showError]);

  /**
   * ファイル選択ダイアログを開く
   */
  const handleSelectBackupFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * バックアップファイルを復元
   */
  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // ファイルがJSON形式か確認
    if (!file.name.endsWith('.json')) {
      setError('JSON形式のファイルを選択してください');
      showError('ファイル形式エラー', 'JSON形式のファイルを選択してください');
      return;
    }

    // 確認ダイアログ
    if (!confirm('バックアップを復元しますか？\n現在のデータは上書きされます。')) {
      return;
    }

    try {
      setRestoring(true);
      setError(null);
      setSuccessMessage(null);
      setRestoreResult(null);

      // ファイルを読み込む
      const fileContent = await file.text();

      // JSONの形式チェック（簡易）
      try {
        JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('無効なJSONファイルです');
      }

      // ファイル内容を直接バックエンドに送信して復元
      const result = await safeInvoke<RestoreResponse>('restore_backup_from_json', {
        json_data: fileContent,
      });

      setRestoreResult(result);
      
      // 成功メッセージ
      const message = `バックアップを復元しました\n` +
        `API: ${result.api_count}件, APIキー: ${result.api_key_count}件\n` +
        `モデル: ${result.model_count}件, ログ: ${result.log_count}件`;
      
      setSuccessMessage(message);
      showSuccess('バックアップを復元しました');

      // 入力フィールドをリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'バックアップの復元に失敗しました';
      setError(errorMessage);
      showError('バックアップの復元に失敗しました', errorMessage);
    } finally {
      setRestoring(false);
    }
  };

  /**
   * ファイルサイズをフォーマット
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="backup-restore-page">
      <div className="backup-restore-container">
        <header className="backup-restore-header">
          <button 
            className="backup-restore-back-button" 
            onClick={() => navigate('/')}
            aria-label="ホームに戻る"
          >
            ← ホームに戻る
          </button>
          <h1 className="backup-restore-title">バックアップ・復元</h1>
          <p className="backup-restore-subtitle">
            データベースのバックアップを作成、または以前のバックアップから復元します
          </p>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="general"
            onClose={() => setError(null)}
          />
        )}

        {successMessage && (
          <InfoBanner
            type="success"
            message={successMessage}
            dismissible
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        <div className="backup-restore-content">
          {/* バックアップ作成セクション */}
          <section className="backup-restore-section">
            <h2 className="backup-restore-section-title">バックアップ作成</h2>
            <div className="backup-restore-section-content">
              <p className="backup-restore-description">
                現在のデータベース全体（API設定、APIキー、インストール済みモデル、リクエストログ）を
                JSON形式でバックアップします。
              </p>
              <div className="backup-restore-info">
                <p>バックアップに含まれるデータ:</p>
                <ul>
                  <li>API設定（すべて）</li>
                  <li>APIキー（暗号化されたキー）</li>
                  <li>インストール済みモデル情報</li>
                  <li>リクエストログ（最新1000件）</li>
                </ul>
              </div>
              <button
                className="backup-restore-button primary"
                onClick={handleCreateBackup}
                disabled={backingUp || restoring}
                type="button"
              >
                {backingUp ? 'バックアップ作成中...' : '📦 バックアップを作成'}
              </button>

              {backupResult && (
                <div className="backup-restore-result">
                  <h3 className="backup-restore-result-title">バックアップ作成結果</h3>
                  <div className="backup-restore-result-details">
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">ファイルパス:</span>
                      <span className="backup-restore-result-value">{backupResult.file_path}</span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">ファイルサイズ:</span>
                      <span className="backup-restore-result-value">
                        {formatFileSize(backupResult.file_size)}
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">API数:</span>
                      <span className="backup-restore-result-value">{backupResult.api_count}件</span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">モデル数:</span>
                      <span className="backup-restore-result-value">{backupResult.model_count}件</span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">ログ数:</span>
                      <span className="backup-restore-result-value">{backupResult.log_count}件</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* バックアップ復元セクション */}
          <section className="backup-restore-section">
            <h2 className="backup-restore-section-title">バックアップ復元</h2>
            <div className="backup-restore-section-content">
              <p className="backup-restore-description">
                以前に作成したバックアップファイルからデータを復元します。
                <strong>注意: 復元すると現在のデータは上書きされます。</strong>
              </p>
              <div className="backup-restore-warning">
                <p>⚠️ 重要な注意事項:</p>
                <ul>
                  <li>復元前に現在のデータをバックアップすることをお勧めします</li>
                  <li>復元処理中はアプリケーションを使用しないでください</li>
                  <li>復元に失敗した場合、データが破損する可能性があります</li>
                </ul>
              </div>
              <div className="backup-restore-file-selector">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="backup-restore-file-input"
                  aria-label="バックアップファイルを選択"
                />
                <button
                  className="backup-restore-button secondary"
                  onClick={handleSelectBackupFile}
                  disabled={backingUp || restoring}
                  type="button"
                >
                  📁 バックアップファイルを選択
                </button>
              </div>

              {restoring && (
                <div className="backup-restore-progress">
                  <p>復元処理中...</p>
                </div>
              )}

              {restoreResult && (
                <div className="backup-restore-result">
                  <h3 className="backup-restore-result-title">復元結果</h3>
                  <div className="backup-restore-result-details">
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">復元されたAPI:</span>
                      <span className="backup-restore-result-value">{restoreResult.api_count}件</span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">復元されたAPIキー:</span>
                      <span className="backup-restore-result-value">{restoreResult.api_key_count}件</span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">復元されたモデル:</span>
                      <span className="backup-restore-result-value">{restoreResult.model_count}件</span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">復元されたログ:</span>
                      <span className="backup-restore-result-value">{restoreResult.log_count}件</span>
                    </div>
                  </div>
                  <div className="backup-restore-result-note">
                    <p>
                      ✅ 復元が完了しました。ページを再読み込みするか、アプリケーションを再起動して
                      最新のデータを確認してください。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

