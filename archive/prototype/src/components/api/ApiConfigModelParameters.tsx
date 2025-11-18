// ApiConfigModelParameters - モデル生成パラメータセクション

import React from 'react';
import { Tooltip } from '../common/Tooltip';
import type { ModelParameters } from '../../types/api';
import { MODEL_PARAMETERS } from '../../constants/config';
import './ApiConfigForm.css';

/**
 * モデル生成パラメータセクションのプロパティ
 */
export interface ApiConfigModelParametersProps {
  modelParameters: ModelParameters;
  errors: { [key: string]: string };
  onParameterChange: (key: keyof ModelParameters, value: number | undefined) => void;
  showAdvancedParams: boolean;
  onToggleAdvancedParams: () => void;
}

/**
 * モデル生成パラメータセクション
 * 温度、Top-p、Top-k、Max tokens、Repeat penaltyの設定
 */
export const ApiConfigModelParameters: React.FC<ApiConfigModelParametersProps> = ({
  modelParameters,
  errors,
  onParameterChange,
  showAdvancedParams,
  onToggleAdvancedParams,
}) => {
  return (
    <div className="form-group">
      <div className="advanced-params-header">
        <button
          type="button"
          className="advanced-params-toggle"
          onClick={onToggleAdvancedParams}
          {...(showAdvancedParams
            ? { 'aria-expanded': 'true' as const }
            : { 'aria-expanded': 'false' as const })}
        >
          <span>{showAdvancedParams ? '▼' : '▶'}</span>
          <span>高度な設定: モデル生成パラメータ</span>
        </button>
        <Tooltip
          content="モデルの生成動作を調整するパラメータです。デフォルト値のままでも問題なく動作します。"
          position="right"
        >
          <span className="tooltip-trigger-icon">i</span>
        </Tooltip>
      </div>

      {showAdvancedParams && (
        <div className="advanced-params-content">
          {/* 温度 */}
          <div className="param-row">
            <label htmlFor="temperature">
              温度 (Temperature)
              <Tooltip
                content="出力のランダム性を制御します。値が高いほど創造的で多様な出力になります（推奨: 0.7）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="temperature"
                type="number"
                min={MODEL_PARAMETERS.TEMPERATURE.MIN}
                max={MODEL_PARAMETERS.TEMPERATURE.MAX}
                step="0.1"
                value={
                  modelParameters?.temperature ??
                  MODEL_PARAMETERS.TEMPERATURE.DEFAULT
                }
                onChange={e => {
                  const value =
                    e.target.value === ''
                      ? undefined
                      : parseFloat(e.target.value);
                  onParameterChange('temperature', value);
                }}
                className={errors.temperature ? 'error' : ''}
              />
              <small className="param-range">
                {MODEL_PARAMETERS.TEMPERATURE.MIN} -{' '}
                {MODEL_PARAMETERS.TEMPERATURE.MAX}
              </small>
            </div>
            {errors.temperature && (
              <span className="error-message">{errors.temperature}</span>
            )}
          </div>

          {/* Top-p */}
          <div className="param-row">
            <label htmlFor="top_p">
              Top-p (Nucleus Sampling)
              <Tooltip
                content="確率質量の累積分布がこの値に達するまでのトークンを考慮します（推奨: 0.9）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="top_p"
                type="number"
                min={MODEL_PARAMETERS.TOP_P.MIN}
                max={MODEL_PARAMETERS.TOP_P.MAX}
                step="0.01"
                value={
                  modelParameters?.top_p ?? MODEL_PARAMETERS.TOP_P.DEFAULT
                }
                onChange={e => {
                  const value =
                    e.target.value === '' ? undefined : parseFloat(e.target.value);
                  onParameterChange('top_p', value);
                }}
                className={errors.top_p ? 'error' : ''}
              />
              <small className="param-range">
                {MODEL_PARAMETERS.TOP_P.MIN} - {MODEL_PARAMETERS.TOP_P.MAX}
              </small>
            </div>
            {errors.top_p && (
              <span className="error-message">{errors.top_p}</span>
            )}
          </div>

          {/* Top-k */}
          <div className="param-row">
            <label htmlFor="top_k">
              Top-k
              <Tooltip
                content="最も確率の高いk個のトークンのみを考慮します（推奨: 40）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="top_k"
                type="number"
                min={MODEL_PARAMETERS.TOP_K.MIN}
                max={MODEL_PARAMETERS.TOP_K.MAX}
                step="1"
                value={modelParameters?.top_k ?? MODEL_PARAMETERS.TOP_K.DEFAULT}
                onChange={e => {
                  const value =
                    e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                  onParameterChange('top_k', value);
                }}
                className={errors.top_k ? 'error' : ''}
              />
              <small className="param-range">
                {MODEL_PARAMETERS.TOP_K.MIN} - {MODEL_PARAMETERS.TOP_K.MAX}
              </small>
            </div>
            {errors.top_k && (
              <span className="error-message">{errors.top_k}</span>
            )}
          </div>

          {/* Max tokens */}
          <div className="param-row">
            <label htmlFor="max_tokens">
              最大トークン数 (Max Tokens)
              <Tooltip
                content="生成する最大のトークン数です。値を大きくすると長い応答を生成できますが、処理時間が増加します（推奨: 2048）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="max_tokens"
                type="number"
                min={MODEL_PARAMETERS.MAX_TOKENS.MIN}
                max={MODEL_PARAMETERS.MAX_TOKENS.MAX}
                step="128"
                value={
                  modelParameters?.max_tokens ??
                  MODEL_PARAMETERS.MAX_TOKENS.DEFAULT
                }
                onChange={e => {
                  const value =
                    e.target.value === ''
                      ? undefined
                      : parseInt(e.target.value, 10);
                  onParameterChange('max_tokens', value);
                }}
                className={errors.max_tokens ? 'error' : ''}
              />
              <small className="param-range">
                {MODEL_PARAMETERS.MAX_TOKENS.MIN} -{' '}
                {MODEL_PARAMETERS.MAX_TOKENS.MAX}
              </small>
            </div>
            {errors.max_tokens && (
              <span className="error-message">{errors.max_tokens}</span>
            )}
          </div>

          {/* Repeat penalty */}
          <div className="param-row">
            <label htmlFor="repeat_penalty">
              繰り返しペナルティ (Repeat Penalty)
              <Tooltip
                content="同じトークンの繰り返しを抑制します。値が高いほど繰り返しが減ります（推奨: 1.1）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="repeat_penalty"
                type="number"
                min={MODEL_PARAMETERS.REPEAT_PENALTY.MIN}
                max={MODEL_PARAMETERS.REPEAT_PENALTY.MAX}
                step="0.01"
                value={
                  modelParameters?.repeat_penalty ??
                  MODEL_PARAMETERS.REPEAT_PENALTY.DEFAULT
                }
                onChange={e => {
                  const value =
                    e.target.value === ''
                      ? undefined
                      : parseFloat(e.target.value);
                  onParameterChange('repeat_penalty', value);
                }}
                className={errors.repeat_penalty ? 'error' : ''}
              />
              <small className="param-range">
                {MODEL_PARAMETERS.REPEAT_PENALTY.MIN} -{' '}
                {MODEL_PARAMETERS.REPEAT_PENALTY.MAX}
              </small>
            </div>
            {errors.repeat_penalty && (
              <span className="error-message">{errors.repeat_penalty}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

