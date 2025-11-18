// ApiConfigMultimodalSettings - マルチモーダル設定セクション

import React from 'react';
import { Tooltip } from '../common/Tooltip';
import type { MultimodalSettings, SelectedModel } from '../../types/api';
import { MULTIMODAL_SETTINGS } from '../../constants/config';
import './ApiConfigForm.css';

/**
 * マルチモーダル設定セクションのプロパティ
 */
export interface ApiConfigMultimodalSettingsProps {
  multimodal: MultimodalSettings | undefined;
  model: SelectedModel;
  errors?: { [key: string]: string };
  onMultimodalSettingChange: (
    key: keyof MultimodalSettings,
    value: boolean | number | string[] | undefined
  ) => void;
  showMultimodalSettings: boolean;
  onToggleMultimodalSettings: () => void;
  onReset: () => void;
}

/**
 * マルチモーダル設定セクション
 * 画像・音声・動画処理機能の設定
 */
export const ApiConfigMultimodalSettings: React.FC<ApiConfigMultimodalSettingsProps> = ({
  multimodal,
  model,
  onMultimodalSettingChange,
  showMultimodalSettings,
  onToggleMultimodalSettings,
  onReset,
}) => {
  // モデルがマルチモーダル機能をサポートしているかチェック
  if (
    !model.capabilities ||
    (!model.capabilities.vision &&
      !model.capabilities.audio &&
      !model.capabilities.video)
  ) {
    return null;
  }

  return (
    <div className="form-group">
      <div className="advanced-params-header">
        <button
          type="button"
          className="advanced-params-toggle"
          onClick={onToggleMultimodalSettings}
          {...(showMultimodalSettings
            ? { 'aria-expanded': 'true' as const }
            : { 'aria-expanded': 'false' as const })}
        >
          <span>{showMultimodalSettings ? '▼' : '▶'}</span>
          <span>マルチモーダル機能設定（画像・音声・動画）</span>
        </button>
        <Tooltip
          content="このモデルは画像・音声・動画を処理できます。各機能を有効化すると、対応するAPIエンドポイントが利用可能になります。"
          position="right"
        >
          <span className="tooltip-trigger-icon">i</span>
        </Tooltip>
      </div>

      {showMultimodalSettings && (
        <div className="advanced-params-content">
          {/* 機能の有効化 */}
          {model.capabilities.vision && (
            <div className="param-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={multimodal?.enableVision ?? false}
                  onChange={e =>
                    onMultimodalSettingChange('enableVision', e.target.checked)
                  }
                />
                <span>画像処理機能を有効化</span>
                <Tooltip
                  content="画像認識・画像説明・画像生成などの機能を有効化します。"
                  position="right"
                >
                  <span className="tooltip-trigger-icon">i</span>
                </Tooltip>
              </label>
            </div>
          )}

          {model.capabilities.audio && (
            <div className="param-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={multimodal?.enableAudio ?? false}
                  onChange={e =>
                    onMultimodalSettingChange('enableAudio', e.target.checked)
                  }
                />
                <span>音声処理機能を有効化</span>
                <Tooltip
                  content="音声認識・音声合成・音声変換などの機能を有効化します。"
                  position="right"
                >
                  <span className="tooltip-trigger-icon">i</span>
                </Tooltip>
              </label>
            </div>
          )}

          {model.capabilities.video && (
            <div className="param-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={multimodal?.enableVideo ?? false}
                  onChange={e =>
                    onMultimodalSettingChange('enableVideo', e.target.checked)
                  }
                />
                <span>動画処理機能を有効化</span>
                <Tooltip
                  content="動画認識・動画生成などの機能を有効化します。"
                  position="right"
                >
                  <span className="tooltip-trigger-icon">i</span>
                </Tooltip>
              </label>
            </div>
          )}

          {/* ファイルサイズ制限 */}
          {multimodal?.enableVision && (
            <div className="param-row">
              <label htmlFor="maxImageSize">
                最大画像サイズ (MB)
                <Tooltip
                  content="アップロード可能な画像の最大サイズです（デフォルト: 10MB）。"
                  position="right"
                >
                  <span className="tooltip-trigger-icon">i</span>
                </Tooltip>
              </label>
              <div className="param-input-group">
                <input
                  id="maxImageSize"
                  type="number"
                  min={MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MIN}
                  max={MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MAX}
                  step="1"
                  value={
                    multimodal?.maxImageSize ??
                    MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.DEFAULT
                  }
                  onChange={e => {
                    const value =
                      e.target.value === ''
                        ? undefined
                        : parseInt(e.target.value, 10);
                    onMultimodalSettingChange('maxImageSize', value);
                  }}
                />
                <small className="param-range">
                  {MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MIN}-
                  {MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.MAX} MB
                </small>
              </div>
            </div>
          )}

          {multimodal?.enableAudio && (
            <div className="param-row">
              <label htmlFor="maxAudioSize">
                最大音声サイズ (MB)
                <Tooltip
                  content="アップロード可能な音声ファイルの最大サイズです（デフォルト: 50MB）。"
                  position="right"
                >
                  <span className="tooltip-trigger-icon">i</span>
                </Tooltip>
              </label>
              <div className="param-input-group">
                <input
                  id="maxAudioSize"
                  type="number"
                  min={MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MIN}
                  max={MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MAX}
                  step="1"
                  value={
                    multimodal?.maxAudioSize ??
                    MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.DEFAULT
                  }
                  onChange={e => {
                    const value =
                      e.target.value === ''
                        ? undefined
                        : parseInt(e.target.value, 10);
                    onMultimodalSettingChange('maxAudioSize', value);
                  }}
                />
                <small className="param-range">
                  {MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MIN}-
                  {MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.MAX} MB
                </small>
              </div>
            </div>
          )}

          {multimodal?.enableVideo && (
            <div className="param-row">
              <label htmlFor="maxVideoSize">
                最大動画サイズ (MB)
                <Tooltip
                  content="アップロード可能な動画ファイルの最大サイズです（デフォルト: 100MB）。"
                  position="right"
                >
                  <span className="tooltip-trigger-icon">i</span>
                </Tooltip>
              </label>
              <div className="param-input-group">
                <input
                  id="maxVideoSize"
                  type="number"
                  min={MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MIN}
                  max={MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MAX}
                  step="1"
                  value={
                    multimodal?.maxVideoSize ??
                    MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.DEFAULT
                  }
                  onChange={e => {
                    const value =
                      e.target.value === ''
                        ? undefined
                        : parseInt(e.target.value, 10);
                    onMultimodalSettingChange('maxVideoSize', value);
                  }}
                />
                <small className="param-range">
                  {MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MIN}-
                  {MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.MAX} MB
                </small>
              </div>
            </div>
          )}

          {/* リセットボタン */}
          <div className="param-reset">
            <button
              type="button"
              className="param-reset-button"
              onClick={onReset}
            >
              マルチモーダル設定をデフォルト値にリセット
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

