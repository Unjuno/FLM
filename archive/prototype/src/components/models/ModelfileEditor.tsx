// ModelfileEditor - Modelfile作成・編集コンポーネント

import React, { useState, useCallback, useTransition } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNotifications } from '../../contexts/NotificationContext';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import './ModelfileEditor.css';

/**
 * Modelfile設定
 */
interface ModelfileConfig {
  model_name: string;
  base_model?: string;
  system_prompt?: string;
  template?: string;
  parameters?: string;
  adapter_path?: string;
  license?: string;
}

/**
 * Modelfileエディタコンポーネント
 */
export const ModelfileEditor: React.FC = () => {
  const { showSuccess } = useNotifications();
  const [config, setConfig] = useState<ModelfileConfig>({
    model_name: '',
    base_model: '',
    system_prompt: '',
    template: '',
    parameters: '',
    adapter_path: '',
    license: '',
  });
  const [generatedModelfile, setGeneratedModelfile] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  /**
   * Modelfileを生成
   */
  const handleGenerate = useCallback(async () => {
    if (!config.model_name) {
      setError('モデル名を入力してください');
      return;
    }

    try {
      setError(null);

      const modelfile = await safeInvoke<string>('generate_modelfile', {
        model_name: config.model_name,
        base_model: config.base_model || null,
        system_prompt: config.system_prompt || null,
        template: config.template || null,
        parameters: config.parameters || null,
        adapter_path: config.adapter_path || null,
        license: config.license || null,
      });

      setGeneratedModelfile(modelfile);
      showSuccess('Modelfileを生成しました');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Modelfile生成に失敗しました'
      );
    }
  }, [config, showSuccess]);

  /**
   * Modelfileを保存
   */
  const handleSave = useCallback(async () => {
    if (!generatedModelfile) {
      setError('Modelfileを生成してください');
      return;
    }

    if (!config.model_name) {
      setError('モデル名を入力してください');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const path = await safeInvoke<string>('save_modelfile', {
        modelName: config.model_name,
        modelfileContent: generatedModelfile,
      });

      setSavedPath(path);
      showSuccess('Modelfileを保存しました');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Modelfile保存に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  }, [config.model_name, generatedModelfile, showSuccess]);

  /**
   * 既存のModelfileを読み込む
   */
  const handleLoad = useCallback(async () => {
    if (!config.model_name) {
      setError('モデル名を入力してください');
      return;
    }

    try {
      setError(null);

      const modelfile = await safeInvoke<string>('load_modelfile', {
        modelName: config.model_name,
      });

      setGeneratedModelfile(modelfile);
      showSuccess('Modelfileを読み込みました');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Modelfile読み込みに失敗しました'
      );
    }
  }, [config.model_name, showSuccess]);

  /**
   * カスタムモデルを作成
   */
  const handleCreateModel = useCallback(async () => {
    if (!savedPath) {
      setError('Modelfileを保存してください');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await safeInvoke('create_custom_model', {
        modelName: config.model_name,
        modelfilePath: savedPath,
      });

      showSuccess(`カスタムモデル "${config.model_name}" を作成しました`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'カスタムモデル作成に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  }, [config.model_name, savedPath, showSuccess]);

  return (
    <div className="modelfile-editor">
      <div className="modelfile-editor-header">
        <h2>Modelfile作成・編集</h2>
        <p className="modelfile-editor-description">
          Ollama用のModelfileを作成・編集して、カスタムモデルを定義できます。
        </p>
      </div>

      <div className="modelfile-editor-content">
        <div className="modelfile-form">
          <div className="form-group">
            <label htmlFor="model-name">
              モデル名 <span className="required">*</span>
            </label>
            <input
              id="model-name"
              type="text"
              className="form-input"
              value={config.model_name}
              onChange={e =>
                setConfig({ ...config, model_name: e.target.value })
              }
              placeholder="例: my-custom-model"
            />
          </div>

          <div className="form-group">
            <label htmlFor="base-model">ベースモデル</label>
            <input
              id="base-model"
              type="text"
              className="form-input"
              value={config.base_model || ''}
              onChange={e =>
                setConfig({ ...config, base_model: e.target.value })
              }
              placeholder="例: llama3:8b"
            />
            <small className="form-hint">FROM句で使用するベースモデル</small>
          </div>

          <div className="form-group">
            <label htmlFor="system-prompt">システムプロンプト</label>
            <textarea
              id="system-prompt"
              className="form-textarea"
              rows={4}
              value={config.system_prompt || ''}
              onChange={e =>
                setConfig({ ...config, system_prompt: e.target.value })
              }
              placeholder="モデルの基本的な動作を定義するプロンプト"
            />
          </div>

          <div className="form-group">
            <label htmlFor="template">テンプレート</label>
            <textarea
              id="template"
              className="form-textarea"
              rows={4}
              value={config.template || ''}
              onChange={e => setConfig({ ...config, template: e.target.value })}
              placeholder="会話テンプレート（{{ .Prompt }}等を使用）"
            />
          </div>

          <div className="form-group">
            <label htmlFor="parameters">パラメータ</label>
            <input
              id="parameters"
              type="text"
              className="form-input"
              value={config.parameters || ''}
              onChange={e =>
                setConfig({ ...config, parameters: e.target.value })
              }
              placeholder="例: temperature 0.7, top_p 0.9"
            />
            <small className="form-hint">
              カンマ区切りで複数のパラメータを指定
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="adapter-path">アダプターパス</label>
            <input
              id="adapter-path"
              type="text"
              className="form-input"
              value={config.adapter_path || ''}
              onChange={e =>
                setConfig({ ...config, adapter_path: e.target.value })
              }
              placeholder="例: /path/to/adapter.bin"
            />
          </div>

          <div className="form-group">
            <label htmlFor="license">ライセンス</label>
            <textarea
              id="license"
              className="form-textarea"
              rows={3}
              value={config.license || ''}
              onChange={e => setConfig({ ...config, license: e.target.value })}
              placeholder="ライセンス情報"
            />
          </div>

          <div className="form-actions">
            <button
              className="button primary"
              onClick={() => {
                startTransition(() => {
                  handleGenerate();
                });
              }}
              disabled={!config.model_name || isPending}
            >
              Modelfile生成
            </button>
            <button
              className="button secondary"
              onClick={() => {
                startTransition(() => {
                  handleLoad();
                });
              }}
              disabled={!config.model_name || isPending}
            >
              読み込む
            </button>
          </div>
        </div>

        <div className="modelfile-preview">
          <div className="preview-header">
            <h3>生成されたModelfile</h3>
            <div className="preview-actions">
              <button
                className="button secondary"
                onClick={() => {
                  startTransition(() => {
                    handleSave();
                  });
                }}
                disabled={!generatedModelfile || saving || isPending}
              >
                {saving ? '保存中...' : '保存'}
              </button>
              {savedPath && (
                <button
                  className="button primary"
                  onClick={() => {
                    startTransition(() => {
                      handleCreateModel();
                    });
                  }}
                  disabled={saving || isPending}
                >
                  {saving ? '作成中...' : 'モデル作成'}
                </button>
              )}
            </div>
          </div>

          {error && (
            <ErrorMessage
              message={error}
              type="general"
              onClose={() => setError(null)}
            />
          )}

          {savedPath && (
            <InfoBanner
              type="success"
              message={`Modelfileを保存しました: ${savedPath}`}
            />
          )}

          {generatedModelfile ? (
            <pre className="modelfile-content">{generatedModelfile}</pre>
          ) : (
            <div className="modelfile-placeholder">
              <p>Modelfileを生成すると、ここに表示されます</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
