// FLM - API設定変更ページ
// フロントエンドエージェント (FE) 実装
// F003: API管理機能 - 設定変更画面

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../components/common/ErrorMessage';
import './ApiSettings.css';

/**
 * API設定情報
 */
interface ApiSettings {
  id: string;
  name: string;
  port: number;
  enableAuth: boolean;
}

/**
 * API設定変更ページ
 * APIの設定を変更します
 */
export const ApiSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadSettings();
  }, [id]);

  // 設定を読み込む
  const loadSettings = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      // バックエンドのIPCコマンドを呼び出し（list_apisから該当APIを取得）
      const apis = await invoke<Array<{
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

      const api = apis.find((a) => a.id === id);
      
      if (!api) {
        setError('APIが見つかりませんでした');
        return;
      }

      setSettings({
        id: api.id,
        name: api.name,
        port: api.port,
        enableAuth: api.enable_auth,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // バリデーション
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!settings) {
      setError('設定が読み込まれていません');
      return false;
    }

    if (!settings.name.trim()) {
      newErrors.name = 'API名を入力してください';
    }

    if (settings.port < 1024 || settings.port > 65535) {
      newErrors.port = 'ポート番号は1024-65535の範囲で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 設定を保存
  const handleSave = async () => {
    if (!settings || !validate()) return;

    try {
      setSaving(true);
      setError(null);

      // バックエンドのupdate_apiコマンドを呼び出し
      await invoke('update_api', {
        api_id: id,
        config: {
          name: settings.name,
          port: settings.port,
          enable_auth: settings.enableAuth,
        },
      });

      // ポート番号が変更された場合は再起動が必要
      // TODO: 再起動処理を実装（バックエンドエージェントが実装予定）

      navigate('/api/list');
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // APIキーを再生成
  const handleRegenerateApiKey = async () => {
    if (!id || !window.confirm('APIキーを再生成しますか？現在のAPIキーは無効になります。')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // バックエンドのregenerate_api_keyコマンドを呼び出し
      const newKey = await invoke<string>('regenerate_api_key', { api_id: id });

      // 新しいAPIキーを表示
      alert(`APIキーが再生成されました。\n新しいAPIキー: ${newKey}\n\nこのキーは今回のみ表示されます。コピーして安全な場所に保存してください。`);
      
      // 設定を再読み込みして反映
      loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'APIキーの再生成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // APIを削除
  const handleDelete = async () => {
    if (!id) return;

    const confirmMessage = 'このAPIを削除しますか？この操作は取り消せません。';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // TODO: バックエンドエージェントが実装するIPCコマンドを呼び出し
      // await invoke('delete_api', { id });

      // 暫定実装（バックエンド実装待ち）
      navigate('/api/list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'APIの削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="api-settings-page">
        <div className="api-settings-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>設定を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="api-settings-page">
        <div className="api-settings-container">
          <div className="error-container">
            <h2>APIが見つかりませんでした</h2>
            <button onClick={() => navigate('/api/list')}>API一覧に戻る</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-settings-page">
      <div className="api-settings-container">
        <header className="api-settings-header">
          <div className="header-top">
            <button className="back-button" onClick={() => navigate('/api/list')}>
              ← API一覧に戻る
            </button>
            <h1>API設定変更</h1>
          </div>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="api-settings-content">
          <section className="settings-section">
            <h2>基本設定</h2>
            <div className="form-group">
              <label htmlFor="api-name">
                API名 <span className="required">*</span>
              </label>
              <input
                id="api-name"
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="api-port">
                ポート番号 <span className="required">*</span>
              </label>
              <input
                id="api-port"
                type="number"
                value={settings.port}
                onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || 8080 })}
                min={1024}
                max={65535}
                className={errors.port ? 'error' : ''}
              />
              {errors.port && <span className="error-message-text">{errors.port}</span>}
              <small className="form-hint">
                ポート番号を変更する場合、APIが停止されます。
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.enableAuth}
                  onChange={(e) => setSettings({ ...settings, enableAuth: e.target.checked })}
                />
                <span>認証を有効にする</span>
              </label>
              <small className="form-hint">
                認証を無効にすると、APIキーなしでアクセス可能になります。
              </small>
            </div>
          </section>

          {settings.enableAuth && (
            <section className="settings-section">
              <h2>APIキー管理</h2>
              <div className="api-key-management">
                <p className="section-description">
                  現在のAPIキーを再生成することができます。
                </p>
                <button
                  className="regenerate-button"
                  onClick={handleRegenerateApiKey}
                >
                  🔄 APIキーを再生成
                </button>
                <small className="warning-text">
                  ⚠️ APIキーを再生成すると、現在のAPIキーは無効になります。
                  新しいAPIキーは詳細画面で確認できます。
                </small>
              </div>
            </section>
          )}

          <section className="settings-section danger-zone">
            <h2>危険な操作</h2>
            <div className="danger-actions">
              <p className="section-description">
                APIを削除すると、関連するすべてのデータとプロセスが削除されます。
                この操作は取り消せません。
              </p>
              <button
                className="delete-button"
                onClick={handleDelete}
              >
                🗑️ APIを削除
              </button>
            </div>
          </section>

          <div className="action-buttons">
            <button
              className="button-secondary"
              onClick={() => navigate('/api/list')}
              disabled={saving}
            >
              キャンセル
            </button>
            <button
              className="button-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
