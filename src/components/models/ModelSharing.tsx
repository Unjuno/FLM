// ModelSharing - モデル共有コンポーネント

import React, { useState, useCallback, useTransition, useEffect } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNotifications } from '../../contexts/NotificationContext';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import { extractErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
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
 * 
 * **実装状況**:
 * - ✅ UI実装: 完全実装済み
 * - ✅ ローカルデータベースへの保存: 完全実装済み
 * - ✅ Hugging Face Hubリポジトリ作成: 実装済み
 * - ⚠️ Hugging Face Hubファイルアップロード: 将来実装予定
 * - ⚠️ Hugging Face Hubからのダウンロード: 将来実装予定
 * - ⚠️ Ollama Hub連携: 将来実装予定（公式APIが提供されていないため）
 * 
 * **注意**: 現在の実装では、モデル情報をローカルデータベースに保存するか、
 * Hugging Face Hubにリポジトリを作成することのみ可能です。
 * 実際のファイルアップロード/ダウンロード機能は将来実装予定です。
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
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [showIncompleteFeatures, setShowIncompleteFeatures] = useState(false);
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

  // 不完全な機能の表示設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await safeInvoke<{ show_incomplete_features?: boolean | null }>('get_app_settings');
        setShowIncompleteFeatures(settings.show_incomplete_features ?? false);
      } catch (err) {
        logger.warn('設定の読み込みに失敗しました。デフォルトで非表示にします。', String(err), 'ModelSharing');
        setShowIncompleteFeatures(false);
      }
    };
    loadSettings();
  }, []);

  // ESCキーで確認ダイアログを閉じる
  useEffect(() => {
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

  /**
   * モデルを共有
   */
  const handleShare = useCallback(async () => {
    if (!modelName || !modelPath) {
      setError('モデル名とモデルパスを入力してください');
      return;
    }

    // モデル共有の同意プロセス（監査レポートの推奨事項に基づき、詳細な説明を追加）
    const consentMessage = `モデルを共有しますか？

以下の内容に同意してください：

• 共有するモデルファイルが公開される可能性があります
• モデル名、説明、タグなどの情報が公開されます
• 公開設定（is_public）は後で変更できません
• 共有されたモデルは他のユーザーがダウンロードできるようになります

プライバシーに関する詳細は、SECURITY_POLICY.mdを参照してください。`;

    setConfirmDialog({
      isOpen: true,
      message: consentMessage,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setSharing(true);
          setError(null);

          const tagsArray = tags
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

          const info = await safeInvoke<SharedModelInfo>('share_model_command', {
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
          const errorMessage = extractErrorMessage(err, 'モデル共有に失敗しました');
          setError(errorMessage);
          showError(errorMessage);
        } finally {
          setSharing(false);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [
    modelName,
    modelPath,
    description,
    tags,
    license,
    isPublic,
    showSuccess,
    showError,
  ]);

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
      logger.warn('ファイル選択ダイアログが利用できません', String(err), 'ModelSharing');
      showError(
        'ファイル選択ダイアログが利用できません。手動でパスを入力してください。'
      );
    }
  };

  return (
    <div className="model-sharing">
      <InfoBanner
        type="warning"
        title="機能制限について"
        message="現在、モデル情報の保存とリポジトリ作成のみ対応しています。実際のファイルアップロード/ダウンロード機能は開発中です。"
        dismissible={false}
      />
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
            onChange={e => setModelName(e.target.value)}
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
              onChange={e => setModelPath(e.target.value)}
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
            onChange={e => setDescription(e.target.value)}
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
            onChange={e => setTags(e.target.value)}
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
            onChange={e => setLicense(e.target.value)}
            placeholder="例: Apache 2.0, MIT, CC BY 4.0"
            disabled={sharing}
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              disabled={sharing}
            />
            <span>公開（他のユーザーが検索・ダウンロード可能）</span>
          </label>
        </div>

        <div className="form-actions">
          <button
            className="button primary"
            onClick={() => {
              startTransition(() => {
                handleShare();
              });
            }}
            disabled={sharing || !modelName || !modelPath || isPending}
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
            <p>{confirmDialog.message}</p>
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
