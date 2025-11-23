// EngineSettings - エンジン設定ページ
// エンジン設定の編集・保存

import React, {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useI18n } from '../contexts/I18nContext';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { extractErrorMessage } from '../utils/errorHandler';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useIsMounted } from '../hooks/useIsMounted';
import './EngineSettings.css';

/**
 * エンジン設定データ
 */
interface EngineConfigData {
  id: string;
  engine_type: string;
  name: string;
  base_url: string;
  auto_detect: boolean;
  executable_path?: string;
  is_default: boolean;
}

/**
 * エンジン名のマッピング
 */
const ENGINE_NAMES: { [key: string]: string } = {
  ollama: 'Ollama',
  lm_studio: 'LM Studio',
  vllm: 'vLLM',
  llama_cpp: 'llama.cpp',
};

/**
 * デフォルトベースURLを取得
 */
function getDefaultBaseUrl(engineType: string): string {
  switch (engineType) {
    case 'ollama':
      return 'http://localhost:11434';
    case 'lm_studio':
      return 'http://localhost:1234';
    case 'vllm':
      return 'http://localhost:8000';
    case 'llama_cpp':
      return 'http://localhost:8080';
    default:
      return 'http://localhost:11434';
  }
}

/**
 * エンジン設定ページ
 */
export const EngineSettings: React.FC = () => {
  const navigate = useNavigate();
  const { engineType } = useParams<{ engineType: string }>();
  const { showSuccess, showError } = useNotifications();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  // 確認ダイアログの状態（共通コンポーネントを使用）
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmVariant?: 'primary' | 'danger';
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    confirmVariant: 'danger',
  });
  const [config, setConfig] = useState<EngineConfigData>({
    id: '',
    engine_type: engineType || 'ollama',
    name: '',
    base_url: getDefaultBaseUrl(engineType || 'ollama'),
    auto_detect: true,
    executable_path: '',
    is_default: false,
  });

  // メモリリーク対策: コンポーネントのマウント状態を追跡（アンマウント後の状態更新を防ぐ）
  const isMounted = useIsMounted();

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'エンジン管理', path: '/engines' },
    ];
    if (engineType && ENGINE_NAMES[engineType]) {
      items.push({ label: `${ENGINE_NAMES[engineType]}設定` });
    } else {
      items.push({ label: 'エンジン設定' });
    }
    return items;
  }, [t, engineType]);

  /**
   * 既存の設定を読み込む（useCallbackでメモ化）
   */
  const loadExistingConfig = useCallback(async () => {
    // アンマウントチェック
    if (!isMounted()) return;

    try {
      if (isMounted()) {
        setLoading(true);
        setError(null);
      }

      const configs = await safeInvoke<EngineConfigData[]>(
        'get_engine_configs',
        {
          engine_type: engineType,
        }
      );

      // アンマウントチェック
      if (!isMounted()) return;

      // デフォルト設定を優先、なければ最初の設定を使用
      const defaultConfig = configs.find(c => c.is_default) || configs[0];

      if (defaultConfig) {
        if (isMounted()) {
          setConfig(defaultConfig);
        }
      } else {
        // 設定がない場合は新規作成モード
        if (isMounted()) {
          setConfig({
            id: '',
            engine_type: engineType || 'ollama',
            name: `${ENGINE_NAMES[engineType || 'ollama'] || engineType} 設定`,
            base_url: getDefaultBaseUrl(engineType || 'ollama'),
            auto_detect: true,
            executable_path: '',
            is_default: true,
          });
        }
      }
    } catch (err) {
      if (isMounted()) {
        setError(extractErrorMessage(err, '設定の読み込みに失敗しました'));
      }
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [engineType, isMounted]);

  useEffect(() => {
    if (engineType) {
      loadExistingConfig();
    } else {
      setLoading(false);
    }
  }, [engineType, loadExistingConfig]);

  /**
   * 設定を保存（useCallbackでメモ化）
   */
  const handleSave = useCallback(async () => {
    // アンマウントチェック
    if (!isMounted()) return;

    try {
      if (isMounted()) {
        setSaving(true);
        setError(null);
      }

      // バリデーション
      if (!config.name.trim()) {
        if (isMounted()) {
          setError('設定名を入力してください');
        }
        return;
      }

      if (!config.base_url.trim()) {
        if (isMounted()) {
          setError('ベースURLを入力してください');
        }
        return;
      }

      // URL形式の検証
      try {
        new URL(config.base_url);
      } catch {
        if (isMounted()) {
          setError('有効なURL形式を入力してください');
        }
        return;
      }

      await safeInvoke<string>('save_engine_config', {
        id: config.id,
        engine_type: config.engine_type,
        name: config.name,
        base_url: config.base_url,
        auto_detect: config.auto_detect,
        executable_path: config.executable_path,
        is_default: config.is_default,
      });

      // アンマウントチェック
      if (!isMounted()) return;

      showSuccess('エンジン設定を保存しました');
      navigate('/engines');
    } catch (err) {
      if (!isMounted()) return;
      const errorMessage = extractErrorMessage(err, '設定の保存に失敗しました');
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      if (isMounted()) {
        setSaving(false);
      }
    }
  }, [config, showSuccess, showError, navigate, isMounted]);

  // ESCキーでのダイアログ閉じる処理はConfirmDialogコンポーネント内で処理

  /**
   * 設定を削除（useCallbackでメモ化）
   */
  const handleDelete = useCallback(async () => {
    // アンマウントチェック
    if (!isMounted()) return;

    if (!config.id) {
      return;
    }

    setConfirmDialog({
      isOpen: true,
      message: 'この設定を削除しますか？この操作は取り消せません。',
      confirmVariant: 'danger',
      onConfirm: async () => {
        if (!isMounted()) return;
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          if (isMounted()) {
            setSaving(true);
            setError(null);
          }

          await safeInvoke('delete_engine_config', { config_id: config.id });

          // アンマウントチェック
          if (!isMounted()) return;

          showSuccess('エンジン設定を削除しました');
          navigate('/engines');
        } catch (err) {
          if (!isMounted()) return;
          const errorMessage = extractErrorMessage(
            err,
            '設定の削除に失敗しました'
          );
          setError(errorMessage);
          showError(errorMessage);
        } finally {
          if (isMounted()) {
            setSaving(false);
          }
        }
      },
      onCancel: () => {
        if (isMounted()) {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  }, [config.id, showSuccess, showError, navigate, isMounted]);

  if (loading) {
    return (
      <div className="engine-settings-page">
        <div className="engine-settings-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="engine-settings-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="200px" />
          </header>
          <div className="engine-settings-content">
            <SkeletonLoader type="form" count={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="engine-settings-page">
      <div className="engine-settings-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="engine-settings-header">
          <button className="back-button" onClick={() => navigate('/engines')}>
            ← 戻る
          </button>
          <h1>{ENGINE_NAMES[config.engine_type] || config.engine_type} 設定</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="engine-settings-content">
          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="config-name">
                設定名 <span className="required">*</span>
              </label>
              <input
                id="config-name"
                type="text"
                className="form-input"
                value={config.name}
                onChange={e => setConfig({ ...config, name: e.target.value })}
                placeholder="例: Ollama ローカル設定"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="engine-type">エンジンタイプ</label>
              <input
                id="engine-type"
                type="text"
                className="form-input"
                value={ENGINE_NAMES[config.engine_type] || config.engine_type}
                disabled
              />
            </div>

            <div className="form-group">
              <label htmlFor="base-url">
                ベースURL <span className="required">*</span>
              </label>
              <input
                id="base-url"
                type="text"
                className="form-input"
                value={config.base_url}
                onChange={e =>
                  setConfig({ ...config, base_url: e.target.value })
                }
                placeholder="例: http://localhost:11434"
                disabled={saving}
              />
              <p className="form-help">
                エンジンサーバーのベースURLを入力してください
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="executable-path">
                実行ファイルパス（オプション）
              </label>
              <input
                id="executable-path"
                type="text"
                className="form-input"
                value={config.executable_path || ''}
                onChange={e =>
                  setConfig({ ...config, executable_path: e.target.value })
                }
                placeholder="例: C:\Program Files\Ollama\ollama.exe"
                disabled={saving}
              />
              <p className="form-help">
                エンジンの実行ファイルのパスを指定できます（自動検出を使用しない場合）
              </p>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.auto_detect}
                  onChange={e =>
                    setConfig({ ...config, auto_detect: e.target.checked })
                  }
                  disabled={saving}
                />
                <span>自動検出を使用する</span>
              </label>
              <p className="form-help">
                チェックを外すと、実行ファイルパスを手動で指定できます
              </p>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.is_default}
                  onChange={e =>
                    setConfig({ ...config, is_default: e.target.checked })
                  }
                  disabled={saving}
                />
                <span>デフォルト設定として使用する</span>
              </label>
              <p className="form-help">
                このエンジンタイプのデフォルト設定として使用されます
              </p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  startTransition(() => {
                    handleSave();
                  });
                }}
                disabled={saving || isPending}
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => navigate('/engines')}
                disabled={saving}
              >
                キャンセル
              </button>
              {config.id && (
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => {
                    startTransition(() => {
                      handleDelete();
                    });
                  }}
                  disabled={saving || isPending}
                >
                  削除
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 確認ダイアログ（共通コンポーネントを使用） */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        confirmVariant={confirmDialog.confirmVariant || 'danger'}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
