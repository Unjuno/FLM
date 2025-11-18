// ModelSelectionMain - モデル選択メインエリアコンポーネント

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import { ENGINE_NAMES } from './ModelSelection';
import type { OllamaModel } from './ModelSelectionSidebar';
import type { WebModelDefinition } from '../../types/webModel';
import { useI18n } from '../../contexts/I18nContext';
import './ModelSelection.css';

/**
 * モデル選択メインエリアのプロップス
 */
interface ModelSelectionMainProps {
  selectedEngine: string;
  engineDetectionResult: {
    installed: boolean;
    running: boolean;
    message?: string;
  } | null;
  checkingEngine: boolean;
  isAnyEngineStarting: boolean;
  engineStartingMessage: string | null;
  error: string | null;
  onRetry: () => void;
  localSelectedModel: OllamaModel | null;
  selectedWebModel: WebModelDefinition | null;
  onNext: () => void;
  isRecommended: (modelName: string) => boolean;
  detectModelCapabilities: (modelName: string) => {
    vision: boolean;
    audio: boolean;
    video: boolean;
  };
  getCategoryLabel: (modelName: string) => string;
  formatBytes: (bytes: number, decimals: number) => string;
  formatDate: (dateString: string) => string;
  FORMATTING: {
    DECIMAL_PLACES_SHORT: number;
  };
}

/**
 * モデル選択メインエリアコンポーネント
 */
export const ModelSelectionMain: React.FC<ModelSelectionMainProps> = ({
  selectedEngine,
  engineDetectionResult,
  checkingEngine,
  isAnyEngineStarting,
  engineStartingMessage,
  error,
  onRetry,
  localSelectedModel,
  selectedWebModel,
  onNext,
  isRecommended,
  detectModelCapabilities,
  getCategoryLabel,
  formatBytes,
  formatDate,
  FORMATTING,
}) => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="lmstudio-main">
      {/* エンジンインストール状態の警告 */}
      {engineDetectionResult &&
        !checkingEngine &&
        !engineDetectionResult.installed && (
          <InfoBanner
            type="warning"
            title={
              selectedEngine === 'ollama'
                ? t('engine.ollama.notInstalled')
                : selectedEngine === 'lm_studio'
                  ? t('engine.lmStudio.notInstalled')
                  : selectedEngine === 'vllm'
                    ? t('engine.vllm.notInstalled')
                    : selectedEngine === 'llama_cpp'
                      ? t('engine.llamaCpp.notInstalled')
                      : t('engine.general.notInstalled', { engineName: ENGINE_NAMES[selectedEngine] || selectedEngine })
            }
            message={
              (engineDetectionResult.message ||
                (selectedEngine === 'ollama'
                  ? t('engine.ollama.installMessage')
                  : selectedEngine === 'lm_studio'
                    ? t('engine.lmStudio.installMessage')
                    : selectedEngine === 'vllm'
                      ? t('engine.vllm.installMessage')
                      : selectedEngine === 'llama_cpp'
                        ? t('engine.llamaCpp.installMessage')
                        : t('engine.general.installMessage', { engineName: ENGINE_NAMES[selectedEngine] || selectedEngine })))
            }
            dismissible={false}
          />
        )}

      {/* エンジン起動中の表示 */}
      {isAnyEngineStarting && engineStartingMessage && (
        <InfoBanner
          type="info"
          title={engineStartingMessage}
          message={t('engine.starting.waitMessage')}
          dismissible={false}
        />
      )}

      {engineDetectionResult &&
        !checkingEngine &&
        engineDetectionResult.installed &&
        !engineDetectionResult.running &&
        !isAnyEngineStarting && (
          <InfoBanner
            type="info"
            title={`${ENGINE_NAMES[selectedEngine] || selectedEngine}が起動していません`}
            message={`${ENGINE_NAMES[selectedEngine] || selectedEngine}を起動中です。自動的に起動しますので、しばらくお待ちください。`}
            dismissible={false}
          />
        )}

      {/* エラーメッセージ */}
      {error &&
        (() => {
          // エラーがエンジン起動に関するものかチェック
          const errorLower = error.toLowerCase();
          const isEngineError =
            errorLower.includes('起動') ||
            errorLower.includes('接続') ||
            errorLower.includes('running') ||
            errorLower.includes('start') ||
            errorLower.includes('connection') ||
            errorLower.includes('aiエンジン') ||
            errorLower.includes('実行されていません') ||
            errorLower.includes('実行中か確認') ||
            errorLower.includes('not running') ||
            errorLower.includes('起動していません');

          // エンジン別の提案メッセージを生成
          const engineName = ENGINE_NAMES[selectedEngine] || selectedEngine;
          const suggestion = isEngineError
            ? selectedEngine === 'ollama'
              ? 'Ollamaを起動してから再度お試しください。Ollamaがインストールされていない場合は、ホーム画面から「Ollamaセットアップ」を実行してください。'
              : `${engineName}を起動してから再度お試しください。${engineName}がインストールされていない場合は、設定画面からセットアップを実行してください。`
            : undefined;

          // エラータイプを決定（エンジンに応じて）
          const errorType: 'ollama' | 'model' =
            selectedEngine === 'ollama' ? 'ollama' : 'model';

          return (
            <ErrorMessage
              message={error}
              type={errorType}
              suggestion={suggestion}
              onRetry={onRetry}
            />
          );
        })()}

      {/* モデル詳細表示 */}
      {localSelectedModel || selectedWebModel ? (
        <ModelDetail
          localSelectedModel={localSelectedModel}
          selectedWebModel={selectedWebModel}
          onNext={onNext}
          isRecommended={isRecommended}
          detectModelCapabilities={detectModelCapabilities}
          getCategoryLabel={getCategoryLabel}
          formatBytes={formatBytes}
          formatDate={formatDate}
          FORMATTING={FORMATTING}
        />
      ) : (
        <div className="main-empty-state">
          <div className="empty-state-content">
            <h2>モデルを選択してください</h2>
            <p>
              左側のサイドバーからモデルを選択すると、詳細情報が表示されます。
            </p>

            {/* モデル検索ボタン */}
            <div className="empty-state-actions">
              <button
                className="search-models-button"
                onClick={() =>
                  navigate('/models', {
                    state: { returnTo: 'api/create', selectedEngine },
                  })
                }
                title="モデル検索・ダウンロードページを開く"
              >
                モデルを検索・ダウンロード
              </button>
              <p className="empty-state-hint">
                LM Studioのように多様なモデルを検索してダウンロードできます
              </p>
            </div>

            <div className="empty-state-hints">
              <h3>推奨モデル</h3>
              <ul>
                <li>
                  <strong>llama3:8b</strong> - 高性能な汎用チャットモデル
                </li>
                <li>
                  <strong>codellama:7b</strong> - コード生成に特化
                </li>
                <li>
                  <strong>mistral:7b</strong> - 効率的な多目的モデル
                </li>
                <li>
                  <strong>phi3:mini</strong> - 軽量高性能モデル
                </li>
              </ul>
              <p className="hint-note">
                より多くのモデルを見つけるには、上の「モデルを検索・ダウンロード」ボタンから
                外部リポジトリ（Ollamaライブラリ、Hugging
                Faceなど）を検索できます
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * モデル詳細表示コンポーネント
 */
interface ModelDetailProps {
  localSelectedModel: OllamaModel | null;
  selectedWebModel: WebModelDefinition | null;
  onNext: () => void;
  isRecommended: (modelName: string) => boolean;
  detectModelCapabilities: (modelName: string) => {
    vision: boolean;
    audio: boolean;
    video: boolean;
  };
  getCategoryLabel: (modelName: string) => string;
  formatBytes: (bytes: number, decimals: number) => string;
  formatDate: (dateString: string) => string;
  FORMATTING: {
    DECIMAL_PLACES_SHORT: number;
  };
}

const ModelDetail: React.FC<ModelDetailProps> = ({
  localSelectedModel,
  selectedWebModel,
  onNext,
  isRecommended,
  detectModelCapabilities,
  getCategoryLabel,
  formatBytes,
  formatDate,
  FORMATTING,
}) => {
  return (
    <div className="main-model-details">
      <div className="detail-header">
        <div className="detail-title-section">
          <h2 className="detail-model-name">
            {selectedWebModel ? (
              <>
                {selectedWebModel.icon && (
                  <span className="model-icon-large">
                    {selectedWebModel.icon}
                  </span>
                )}
                {selectedWebModel.name}
              </>
            ) : (
              (localSelectedModel?.name ?? 'モデル名不明')
            )}
          </h2>
          {(selectedWebModel?.recommended ||
            (localSelectedModel &&
              isRecommended(localSelectedModel.name))) && (
            <span className="detail-recommended-badge">推奨モデル</span>
          )}
        </div>
        <div className="detail-actions">
          <button
            className="detail-action-button primary"
            onClick={onNext}
            disabled={!localSelectedModel && !selectedWebModel}
          >
            次へ →
          </button>
        </div>
      </div>

      <div className="detail-content">
        {/* Webサイト用モデルの場合 */}
        {selectedWebModel ? (
          <WebModelDetailContent selectedWebModel={selectedWebModel} />
        ) : localSelectedModel ? (
          <OllamaModelDetailContent
            localSelectedModel={localSelectedModel}
            isRecommended={isRecommended}
            detectModelCapabilities={detectModelCapabilities}
            getCategoryLabel={getCategoryLabel}
            formatBytes={formatBytes}
            formatDate={formatDate}
            FORMATTING={FORMATTING}
          />
        ) : null}
      </div>
    </div>
  );
};

/**
 * Webモデル詳細コンテンツ
 */
interface WebModelDetailContentProps {
  selectedWebModel: WebModelDefinition;
}

const WebModelDetailContent: React.FC<WebModelDetailContentProps> = ({
  selectedWebModel,
}) => {
  return (
    <>
      <InfoBanner
        type="info"
        title="Webサイト用モデル"
        message={selectedWebModel.description}
        dismissible
      />

      <div className="detail-info-grid">
        <div className="detail-info-item">
          <span className="detail-info-label">カテゴリ</span>
          <span className="detail-info-value">
            {selectedWebModel.category === 'chat' && 'チャット'}
            {selectedWebModel.category === 'code' && 'コード'}
            {selectedWebModel.category === 'translation' && '翻訳'}
            {selectedWebModel.category === 'summarization' && '要約'}
            {selectedWebModel.category === 'qa' && '質問応答'}
            {selectedWebModel.category === 'vision' && '画像認識'}
            {selectedWebModel.category === 'audio' && '音声処理'}
            {selectedWebModel.category === 'multimodal' && 'マルチモーダル'}
            {selectedWebModel.category === 'image-generation' && '画像生成'}
            {selectedWebModel.category === 'audio-generation' && '音声生成'}
            {selectedWebModel.category === 'embedding' && '埋め込み'}
            {selectedWebModel.category === 'video-generation' && '動画生成'}
            {selectedWebModel.category === 'other' && 'その他'}
          </span>
        </div>

        {selectedWebModel.capabilities && (
          <div className="detail-info-item">
            <span className="detail-info-label">対応機能</span>
            <span className="detail-info-value">
              <span className="capability-badges">
                {selectedWebModel.capabilities.vision && (
                  <span className="capability-badge vision">画像</span>
                )}
                {selectedWebModel.capabilities.audio && (
                  <span className="capability-badge audio">音声</span>
                )}
                {selectedWebModel.capabilities.video && (
                  <span className="capability-badge video">動画</span>
                )}
              </span>
            </span>
          </div>
        )}

        {selectedWebModel.requirements && (
          <>
            {selectedWebModel.requirements.minMemory && (
              <div className="detail-info-item">
                <span className="detail-info-label">最小メモリ</span>
                <span className="detail-info-value">
                  {selectedWebModel.requirements.minMemory}GB
                </span>
              </div>
            )}
            {selectedWebModel.requirements.recommendedMemory && (
              <div className="detail-info-item">
                <span className="detail-info-label">推奨メモリ</span>
                <span className="detail-info-value">
                  {selectedWebModel.requirements.recommendedMemory} GB
                </span>
              </div>
            )}
            {selectedWebModel.requirements.gpuRecommended && (
              <div className="detail-info-item">
                <span className="detail-info-label">GPU</span>
                <span className="detail-info-value">
                  {selectedWebModel.requirements.gpuRecommended
                    ? '推奨'
                    : '不要'}
                </span>
              </div>
            )}
          </>
        )}

        {selectedWebModel.useCases &&
          selectedWebModel.useCases.length > 0 && (
            <div className="detail-info-item full-width">
              <span className="detail-info-label">使用例</span>
              <div className="detail-info-value">
                <ul className="use-cases-list">
                  {selectedWebModel.useCases.map((useCase, index) => (
                    <li key={index}>{useCase}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
      </div>

      <div className="detail-note">
        <p>
          <strong>推奨設定が自動適用されます</strong>
        </p>
        <p>
          このモデルはWebサイト用途に最適化された設定でAPIが作成されます。
        </p>
      </div>
    </>
  );
};

/**
 * Ollamaモデル詳細コンテンツ
 */
interface OllamaModelDetailContentProps {
  localSelectedModel: OllamaModel;
  isRecommended: (modelName: string) => boolean;
  detectModelCapabilities: (modelName: string) => {
    vision: boolean;
    audio: boolean;
    video: boolean;
  };
  getCategoryLabel: (modelName: string) => string;
  formatBytes: (bytes: number, decimals: number) => string;
  formatDate: (dateString: string) => string;
  FORMATTING: {
    DECIMAL_PLACES_SHORT: number;
  };
}

const OllamaModelDetailContent: React.FC<OllamaModelDetailContentProps> = ({
  localSelectedModel,
  isRecommended,
  detectModelCapabilities,
  getCategoryLabel,
  formatBytes,
  formatDate,
  FORMATTING,
}) => {
  const capabilities = detectModelCapabilities(localSelectedModel.name);
  const hasMultimodal =
    capabilities.vision || capabilities.audio || capabilities.video;

  return (
    <>
      {/* 初めての方へのガイダンス */}
      {isRecommended(localSelectedModel.name) && (
        <InfoBanner
          type="tip"
          title="推奨モデル"
          message="このモデルは推奨モデルです。チャット用途やコード生成に最適化されています。"
          dismissible
        />
      )}

      <div className="detail-info-grid">
        {localSelectedModel.size > 0 && (
          <div className="detail-info-item">
            <span className="detail-info-label">サイズ</span>
            <span className="detail-info-value">
              {formatBytes(localSelectedModel.size, FORMATTING.DECIMAL_PLACES_SHORT)}
            </span>
          </div>
        )}

        {localSelectedModel.parameter_size && (
          <div className="detail-info-item">
            <span className="detail-info-label">パラメータ数</span>
            <span className="detail-info-value">
              {localSelectedModel.parameter_size}
            </span>
          </div>
        )}

        <div className="detail-info-item">
          <span className="detail-info-label">カテゴリ</span>
          <span className="detail-info-value">
            {localSelectedModel.family || getCategoryLabel(localSelectedModel.name)}
          </span>
        </div>

        {localSelectedModel.description && (
          <div className="detail-info-item full-width">
            <span className="detail-info-label">説明</span>
            <span className="detail-info-value">
              {localSelectedModel.description}
            </span>
          </div>
        )}

        {localSelectedModel.recommended && (
          <div className="detail-info-item">
            <span className="detail-info-label">推奨</span>
            <span className="detail-info-value">
              <span className="recommended-badge-inline">推奨モデル</span>
            </span>
          </div>
        )}

        {/* マルチモーダル機能の表示 */}
        {hasMultimodal && (
          <div className="detail-info-item">
            <span className="detail-info-label">対応機能</span>
            <span className="detail-info-value">
              <span className="capability-badges">
                {capabilities.vision && (
                  <span className="capability-badge vision">画像</span>
                )}
                {capabilities.audio && (
                  <span className="capability-badge audio">音声</span>
                )}
                {capabilities.video && (
                  <span className="capability-badge video">動画</span>
                )}
              </span>
            </span>
          </div>
        )}

        {localSelectedModel.modified_at &&
          localSelectedModel.modified_at.trim() !== '' && (
            <div className="detail-info-item">
              <span className="detail-info-label">更新日時</span>
              <span className="detail-info-value">
                {formatDate(localSelectedModel.modified_at)}
              </span>
            </div>
          )}
      </div>
    </>
  );
};

