// ModelSharing - モデル共有コンポーネント

import React, { useState, useCallback } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNotifications } from '../../contexts/NotificationContext';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import './ModelSharing.css';

/**
 * 共有モデル情報
 */
interface SharedModelInfo {
  id: string;
  name: string;
  author: string;
  description?: string;
  tags: string[];
  download_count: number;
  rating?: number;
  created_at: string;
  updated_at: string;
}

/**
 * モデル共有コンポーネント
 */
export const ModelSharing: React.FC = () => {
  const { showSuccess, showError } = useNotifications();
  const [modelName, setModelName] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [license, setLicense] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedInfo, setSharedInfo] = useState<SharedModelInfo | null>(null);

  /**
   * モデルを共有
   */
  const handleShare = useCallback(async () => {
    if (!modelName || !modelPath) {
      setError('モデル名とモデルパスを入力してください');
      return;
    }

    if (!confirm('モデルを共有しますか？公開設定は後で変更できません。')) {
      return;
    }

    try {
      setSharing(true);
      setError(null);
      
      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      
      const info = await safeInvoke<SharedModelInfo>('share_model', {
        config: {
          model_name: modelName,
          model_path: modelPath,
          description: description || null,
          tags: tagsArray,
          license: license || null,
          is_public: isPublic,
        },
      });

      setSharedInfo(info);
      showSuccess('モデルを共有しました');
      
      // フォームをリセット
      setModelName('');
      setModelPath('');
      setDescription('');
      setTags('');
      setLicense('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'モデル共有に失敗しました');
      showError(err instanceof Error ? err.message : 'モデル共有に失敗しました');
    } finally {
      setSharing(false);
    }
  }, [modelName, modelPath, description, tags, license, isPublic, showSuccess, showError]);

  /**
   * ファイル選択ダイアログを開く
   */
  const handleSelectFile = async () => {
    try {
      // IPCコマンドでファイル選択ダイアログを開く
      const selectedPath = await safeInvoke<string | null>('open_file_dialog', {
        filters: [
          {
            name: 'モデルファイル',
            extensions: ['gguf', 'ggml', 'bin', 'pt', 'onnx', 'safetensors'],
          },
        ],
      });
      
      if (selectedPath) {
        setModelPath(selectedPath);
        showSuccess('ファイルを選択しました');
      }
    } catch (err) {
      // エラーは静かに処理（手動入力にフォールバック）
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('ファイル選択ダイアログが利用できません:', err);
      }
      showError('ファイル選択ダイアログが利用できません。手動でパスを入力してください。');
    }
  };

  return (
    <div className="model-sharing">
      <div className="model-sharing-header">
        <h2>モデル共有</h2>
        <p className="model-sharing-description">
          作成したカスタムモデルをコミュニティと共有できます。
        </p>
      </div>

      <div className="model-sharing-form">
        <div className="form-group">
          <label htmlFor="model-name">
            モデル名 <span className="required">*</span>
          </label>
          <input
            id="model-name"
            type="text"
            className="form-input"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="例: my-custom-model"
            disabled={sharing}
          />
        </div>

        <div className="form-group">
          <label htmlFor="model-path">
            モデルパス <span className="required">*</span>
          </label>
          <div className="file-input-group">
            <input
              id="model-path"
              type="text"
              className="form-input"
              value={modelPath}
              onChange={(e) => setModelPath(e.target.value)}
              placeholder="例: /path/to/model.gguf"
              disabled={sharing}
            />
            <button
              className="button secondary"
              onClick={handleSelectFile}
              disabled={sharing}
            >
              ファイル選択
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">説明</label>
          <textarea
            id="description"
            className="form-textarea"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="モデルの説明、用途、特徴などを記入してください"
            disabled={sharing}
          />
        </div>

        <div className="form-group">
          <label htmlFor="tags">タグ（カンマ区切り）</label>
          <input
            id="tags"
            type="text"
            className="form-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例: chat, japanese, code"
            disabled={sharing}
          />
          <small className="form-hint">カンマで区切って複数のタグを入力</small>
        </div>

        <div className="form-group">
          <label htmlFor="license">ライセンス</label>
          <input
            id="license"
            type="text"
            className="form-input"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="例: Apache 2.0, MIT, CC BY 4.0"
            disabled={sharing}
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={sharing}
            />
            <span>公開（他のユーザーが検索・ダウンロード可能）</span>
          </label>
        </div>

        <div className="form-actions">
          <button
            className="button primary"
            onClick={handleShare}
            disabled={sharing || !modelName || !modelPath}
          >
            {sharing ? '共有中...' : '📤 モデルを共有'}
          </button>
        </div>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          type="general"
          onClose={() => setError(null)}
        />
      )}

      {sharedInfo && (
        <InfoBanner
          type="success"
          message={`モデル "${sharedInfo.name}" を共有しました。共有ID: ${sharedInfo.id}`}
        />
      )}
    </div>
  );
};

