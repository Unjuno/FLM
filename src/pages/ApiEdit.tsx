// ApiEdit - API編集ページ

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SecuritySettingsSection } from '../components/api/SecuritySettings';
import { PORT_RANGE, API_NAME } from '../constants/config';
import type { ApiUpdateRequest } from '../types/api';
import './ApiEdit.css';

/**
 * API設定情報
 */
interface ApiSettings {
  name: string;
  port: number;
  enableAuth: boolean;
}

/**
 * API設定変更ページ
 */
export const ApiEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ApiSettings>({
    name: '',
    port: 8080,
    enableAuth: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (id) {
      loadApiSettings(id);
    }
  }, [id]);

  // API設定を取得
  const loadApiSettings = async (apiId: string) => {
    try {
      setLoading(true);
      setError(null);

      // バックエンドのIPCコマンドを呼び出し（list_apisから該当APIを取得）
      const apis = await safeInvoke<Array<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        created_at: string;
        updated_at: string;
      }>>('list_apis');

      const api = apis.find((a) => a.id === apiId);
      
      if (!api) {
        setError('APIが見つかりませんでした');
        return;
      }

      setSettings({
        name: api.name,
        port: api.port,
        enableAuth: api.enable_auth,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // バリデーション
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    const trimmedName = settings.name.trim();
    if (!trimmedName) {
      newErrors.name = 'API名を入力してください';
    } else if (trimmedName.length < API_NAME.MIN_LENGTH) {
      newErrors.name = `API名は${API_NAME.MIN_LENGTH}文字以上で入力してください`;
    } else if (trimmedName.length > API_NAME.MAX_LENGTH) {
      newErrors.name = `API名は${API_NAME.MAX_LENGTH}文字以下で入力してください`;
    }

    if (settings.port < PORT_RANGE.MIN || settings.port > PORT_RANGE.MAX) {
      newErrors.port = `ポート番号は${PORT_RANGE.MIN}-${PORT_RANGE.MAX}の範囲で入力してください`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 設定を保存
  const handleSave = async () => {
    if (!validate() || !id) return;

    try {
      setSaving(true);
      setError(null);

      // バックエンドのupdate_apiコマンドを呼び出し
      const updateRequest: ApiUpdateRequest = {
        api_id: id,
        config: {
          name: settings.name,
          port: settings.port,
          enable_auth: settings.enableAuth,
        },
      };
      await safeInvoke('update_api', updateRequest as unknown as Record<string, unknown>);

      // 成功したら詳細画面に遷移
      navigate(`/api/details/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // APIキーを再生成
  const handleRegenerateApiKey = async () => {
    if (!id) return;

    const confirmed = window.confirm(
      'APIキーを再生成すると、現在のAPIキーは無効になります。続行しますか？'
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);

      // バックエンドのregenerate_api_keyコマンドを呼び出し
      const newApiKey = await safeInvoke<string>('regenerate_api_key', { api_id: id });

      // 新しいAPIキーを表示
      alert(`APIキーが再生成されました。\n新しいAPIキー: ${newApiKey}\n\nこのキーは今回のみ表示されます。コピーして安全な場所に保存してください。`);
      
      // 設定を再読み込みして反映
      if (id) {
        loadApiSettings(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'APIキーの再生成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="api-edit-page">
        <div className="api-edit-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>設定を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-edit-page">
      <div className="api-edit-container">
        <header className="api-edit-header">
          <button className="back-button" onClick={() => navigate(`/api/details/${id}`)}>
            ← 戻る
          </button>
          <h1>API設定を変更</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <form className="api-edit-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="form-section">
            <h2>基本設定</h2>

            <div className="form-group">
              <label htmlFor="api-name" className="form-label">
                API名 <span className="required">*</span>
              </label>
              <input
                id="api-name"
                type="text"
                className={`form-input ${errors.name ? 'error' : ''}`}
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                maxLength={API_NAME.MAX_LENGTH}
                required
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="api-port" className="form-label">
                ポート番号 <span className="required">*</span>
              </label>
              <input
                id="api-port"
                type="number"
                className={`form-input ${errors.port ? 'error' : ''}`}
                value={settings.port}
                onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || PORT_RANGE.DEFAULT })}
                min={PORT_RANGE.MIN}
                max={PORT_RANGE.MAX}
                required
              />
              {errors.port && <span className="form-error">{errors.port}</span>}
              <small className="form-hint">
                ポート番号を変更すると、APIが再起動されます。
              </small>
            </div>

            <div className="form-group">
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={settings.enableAuth}
                  onChange={(e) => setSettings({ ...settings, enableAuth: e.target.checked })}
                />
                <span className="form-checkbox-text">
                  認証を有効にする
                </span>
              </label>
              <small className="form-hint">
                認証を無効にすると、APIキーなしでアクセスできるようになります（非推奨）。
              </small>
            </div>
          </div>

          <div className="form-section">
            <h2>セキュリティ設定</h2>

            <div className="form-group">
              <label className="form-label">APIキー</label>
              <div className="api-key-actions">
                <button
                  type="button"
                  className="button-warning"
                  onClick={handleRegenerateApiKey}
                >
                  🔑 APIキーを再生成
                </button>
              </div>
              <small className="form-hint">
                APIキーを再生成すると、現在のAPIキーは無効になります。新しいAPIキーを安全に保存してください。
              </small>
            </div>

            <SecuritySettingsSection apiId={id || ''} />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => navigate(`/api/details/${id}`)}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={saving}
            >
              {saving ? '保存中...' : '変更を保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

