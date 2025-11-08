// BackupRestore - バックアップ・復元ページ

import React, { useState, useRef, useCallback, useTransition, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useI18n } from '../contexts/I18nContext';
import { extractErrorMessage } from '../utils/errorHandler';
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
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResponse | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResponse | null>(
    null
  );
  // 確認ダイアログの状態
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [encryptBackup, setEncryptBackup] = useState(false);

  // ESCキーで確認ダイアログを閉じる
  React.useEffect(() => {
    if (!confirmDialog.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [confirmDialog.isOpen]);
  const [backupPassword, setBackupPassword] = useState('');
  const [showPasswordWarning, setShowPasswordWarning] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: 'バックアップ・復元' },
  ], [t]);

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
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const defaultFileName = encryptBackup
        ? `flm-backup-${timestamp}.encrypted`
        : `flm-backup-${timestamp}.json`;

      // 暗号化が有効な場合、パスワードを検証
      if (encryptBackup && !backupPassword) {
        setError('暗号化が有効です。パスワードを入力してください。');
        showError('バックアップエラー', '暗号化が有効です。パスワードを入力してください。');
        setBackingUp(false);
        return;
      }

      if (encryptBackup && backupPassword.length < 8) {
        setError('パスワードは8文字以上である必要があります。');
        showError('バックアップエラー', 'パスワードは8文字以上である必要があります。');
        setBackingUp(false);
        return;
      }

      // バックアップを作成（output_pathは空文字列でOK、JSONデータを直接取得）
      const result = await safeInvoke<BackupResponse>('create_backup', {
        output_path: '', // ファイル保存はオプション、JSONデータを直接取得
        encrypt: encryptBackup,
        password: encryptBackup ? backupPassword : null,
      });

      // バックアップファイルをダウンロード
      if (result.json_data) {
        const blob = new Blob([result.json_data], {
          type: encryptBackup
            ? 'application/octet-stream'
            : 'application/json;charset=utf-8;',
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
      const message =
        `バックアップを作成しました\n` +
        `ファイルサイズ: ${formatFileSize(result.file_size)}\n` +
        `API: ${result.api_count}件, モデル: ${result.model_count}件, ログ: ${result.log_count}件`;

      setSuccessMessage(message);
      showSuccess('バックアップを作成しました');
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'バックアップの作成に失敗しました');
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
  const handleRestoreBackup = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
    setConfirmDialog({
      isOpen: true,
      message: 'バックアップを復元しますか？\n現在のデータは上書きされます。',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setRestoring(true);
          setError(null);
          setSuccessMessage(null);
          setRestoreResult(null);

          // ファイルを読み込む
          const fileContent = await file.text();

          // 暗号化されたファイルかどうかを判定（.encrypted拡張子またはBase64形式）
          const isEncrypted = file.name.endsWith('.encrypted') || 
            (fileContent.length > 0 && /^[A-Za-z0-9+/=]+$/.test(fileContent.trim()) && fileContent.length > 100);
          
          // 暗号化されたファイルの場合、パスワードが必要
          if (isEncrypted && !restorePassword) {
            setError('このファイルは暗号化されています。パスワードを入力してください。');
            showError('復元エラー', 'このファイルは暗号化されています。パスワードを入力してください。');
            setRestoring(false);
            return;
          }

          // 暗号化されていないファイルの場合、JSONの形式チェック（簡易）
          if (!isEncrypted) {
            try {
              JSON.parse(fileContent);
            } catch (parseError) {
              throw new Error('無効なJSONファイルです');
            }
          }

          // ファイル内容を直接バックエンドに送信して復元
          const result = await safeInvoke<RestoreResponse>(
            'restore_backup_from_json',
            {
              json_data: fileContent,
              password: restorePassword || null,
            }
          );

          setRestoreResult(result);

          // 成功メッセージ
          const message =
            `バックアップを復元しました\n` +
            `API: ${result.api_count}件, APIキー: ${result.api_key_count}件\n` +
            `モデル: ${result.model_count}件, ログ: ${result.log_count}件`;

          setSuccessMessage(message);
          showSuccess('バックアップを復元しました');

          // 入力フィールドをリセット
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (err) {
          const errorMessage =
            extractErrorMessage(err, 'バックアップの復元に失敗しました');
          setError(errorMessage);
          showError('バックアップの復元に失敗しました', errorMessage);
        } finally {
          setRestoring(false);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  /**
   * ファイルサイズをフォーマット
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // ローディング状態（バックアップ/復元中）
  const isLoading = backingUp || restoring;

  if (isLoading) {
    return (
      <div className="backup-restore-page">
        <div className="backup-restore-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="backup-restore-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="250px" />
            <SkeletonLoader type="text" width="400px" />
          </header>
          <div className="backup-restore-content">
            <SkeletonLoader type="card" count={2} />
            <SkeletonLoader type="form" count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backup-restore-page">
      <div className="backup-restore-container">
        <Breadcrumb items={breadcrumbItems} />
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
              
              {/* 暗号化オプション */}
              <div className="backup-restore-options">
                <label className="backup-restore-checkbox-label">
                  <input
                    type="checkbox"
                    checked={encryptBackup}
                    onChange={(e) => {
                      setEncryptBackup(e.target.checked);
                      if (!e.target.checked) {
                        setBackupPassword('');
                        setShowPasswordWarning(false);
                      } else {
                        setShowPasswordWarning(true);
                      }
                    }}
                    className="backup-restore-checkbox"
                  />
                  <span>ファイルを暗号化する</span>
                </label>
                
                {encryptBackup && (
                  <div className="backup-restore-password-section">
                    <label className="backup-restore-password-label">
                      パスワード（8文字以上）:
                      <input
                        type="password"
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                        className="backup-restore-password-input"
                        placeholder="パスワードを入力"
                        minLength={8}
                      />
                    </label>
                    {showPasswordWarning && (
                      <p className="backup-restore-password-hint">
                        ⚠️ パスワードを忘れるとバックアップファイルを復元できません。安全な場所に保管してください。
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <button
                className="backup-restore-button primary"
                onClick={() => {
                  startTransition(() => {
                    handleCreateBackup();
                  });
                }}
                disabled={backingUp || restoring || isPending}
                type="button"
              >
                {backingUp ? 'バックアップ作成中...' : '📦 バックアップを作成'}
              </button>

              {backupResult && (
                <div className="backup-restore-result">
                  <h3 className="backup-restore-result-title">
                    バックアップ作成結果
                  </h3>
                  <div className="backup-restore-result-details">
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        ファイルパス:
                      </span>
                      <span className="backup-restore-result-value">
                        {backupResult.file_path}
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        ファイルサイズ:
                      </span>
                      <span className="backup-restore-result-value">
                        {formatFileSize(backupResult.file_size)}
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        API数:
                      </span>
                      <span className="backup-restore-result-value">
                        {backupResult.api_count}件
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        モデル数:
                      </span>
                      <span className="backup-restore-result-value">
                        {backupResult.model_count}件
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        ログ数:
                      </span>
                      <span className="backup-restore-result-value">
                        {backupResult.log_count}件
                      </span>
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
                  <li>
                    復元前に現在のデータをバックアップすることをお勧めします
                  </li>
                  <li>復元処理中はアプリケーションを使用しないでください</li>
                  <li>復元に失敗した場合、データが破損する可能性があります</li>
                </ul>
              </div>
              <div className="backup-restore-file-selector">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.encrypted"
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
              
              {/* 復元時のパスワード入力 */}
              <div className="backup-restore-password-section">
                <label className="backup-restore-password-label">
                  パスワード（暗号化されたファイルの場合）:
                  <input
                    type="password"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    className="backup-restore-password-input"
                    placeholder="暗号化されたファイルの場合はパスワードを入力"
                  />
                </label>
                <p className="backup-restore-password-hint">
                  暗号化されていないファイルの場合は空欄のままで問題ありません。
                </p>
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
                      <span className="backup-restore-result-label">
                        復元されたAPI:
                      </span>
                      <span className="backup-restore-result-value">
                        {restoreResult.api_count}件
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        復元されたAPIキー:
                      </span>
                      <span className="backup-restore-result-value">
                        {restoreResult.api_key_count}件
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        復元されたモデル:
                      </span>
                      <span className="backup-restore-result-value">
                        {restoreResult.model_count}件
                      </span>
                    </div>
                    <div className="backup-restore-result-item">
                      <span className="backup-restore-result-label">
                        復元されたログ:
                      </span>
                      <span className="backup-restore-result-value">
                        {restoreResult.log_count}件
                      </span>
                    </div>
                  </div>
                  <div className="backup-restore-result-note">
                    <p>
                      ✅
                      復元が完了しました。ページを再読み込みするか、アプリケーションを再起動して
                      最新のデータを確認してください。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 確認ダイアログ */}
      {confirmDialog.isOpen && (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="confirm-dialog"
            role="document"
          >
            <h3 id="confirm-dialog-title">確認</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{confirmDialog.message}</p>
            <div className="confirm-dialog-actions">
              <button
                className="confirm-button cancel"
                onClick={confirmDialog.onCancel}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="confirm-button confirm"
                onClick={confirmDialog.onConfirm}
                type="button"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
