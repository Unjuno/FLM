// ApiConfigMemorySettings - メモリ・リソース設定セクション

import React from 'react';
import { Tooltip } from '../common/Tooltip';
import type { MemorySettings } from '../../types/api';
import { MEMORY_SETTINGS } from '../../constants/config';
import './ApiConfigForm.css';

/**
 * メモリ・リソース設定セクションのプロパティ
 */
export interface ApiConfigMemorySettingsProps {
  memorySettings: MemorySettings | undefined;
  errors: { [key: string]: string };
  onMemorySettingChange: (
    key: keyof MemorySettings,
    value: number | boolean | undefined
  ) => void;
  showMemorySettings: boolean;
  onToggleMemorySettings: () => void;
  onReset: () => void;
}

/**
 * メモリ・リソース設定セクション
 * コンテキストウィンドウ、GPUレイヤー、CPUスレッド、バッチサイズ、MMAP、MLock、低メモリモードの設定
 */
export const ApiConfigMemorySettings: React.FC<ApiConfigMemorySettingsProps> = ({
  memorySettings,
  errors,
  onMemorySettingChange,
  showMemorySettings,
  onToggleMemorySettings,
  onReset,
}) => {
  return (
    <div className="form-group">
      <div className="advanced-params-header">
        <button
          type="button"
          className="advanced-params-toggle"
          onClick={onToggleMemorySettings}
          {...(showMemorySettings
            ? { 'aria-expanded': 'true' as const }
            : { 'aria-expanded': 'false' as const })}
        >
          <span>{showMemorySettings ? '▼' : '▶'}</span>
          <span>メモリ・リソース設定</span>
        </button>
        <Tooltip
          content="モデルのメモリ使用量やパフォーマンスを調整する設定です。通常はデフォルト値のままでも問題なく動作します。"
          position="right"
        >
          <span className="tooltip-trigger-icon">i</span>
        </Tooltip>
      </div>

      {showMemorySettings && (
        <div className="advanced-params-content">
          {/* コンテキストウィンドウ */}
          <div className="param-row">
            <label htmlFor="context_window">
              コンテキストウィンドウサイズ (Context Window)
              <Tooltip
                content="モデルが一度に処理できる最大のトークン数です。値を大きくすると長い文章を処理できますが、メモリ使用量が増加します（推奨: モデル依存）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="context_window"
                type="number"
                min={MEMORY_SETTINGS.CONTEXT_WINDOW.MIN}
                max={MEMORY_SETTINGS.CONTEXT_WINDOW.MAX}
                step="128"
                value={memorySettings?.context_window ?? ''}
                onChange={e => {
                  const value =
                    e.target.value === ''
                      ? undefined
                      : parseInt(e.target.value, 10);
                  onMemorySettingChange('context_window', value);
                }}
                placeholder="モデル依存"
                className={errors.context_window ? 'error' : ''}
              />
              <small className="param-range">
                {MEMORY_SETTINGS.CONTEXT_WINDOW.MIN}-
                {MEMORY_SETTINGS.CONTEXT_WINDOW.MAX}（トークン数）
              </small>
            </div>
            {errors.context_window && (
              <span className="error-message">{errors.context_window}</span>
            )}
          </div>

          {/* GPUレイヤー数 */}
          <div className="param-row">
            <label htmlFor="num_gpu_layers">
              GPUレイヤー数 (GPU Layers)
              <Tooltip
                content="GPUを使用するレイヤー数です。0にするとCPUのみで動作します。GPUが利用可能な場合、値を大きくすると高速化できますが、VRAM使用量が増加します（推奨: モデル依存、0=CPUのみ）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="num_gpu_layers"
                type="number"
                min={MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}
                max={MEMORY_SETTINGS.NUM_GPU_LAYERS.MAX}
                step="1"
                value={memorySettings?.num_gpu_layers ?? ''}
                onChange={e => {
                  const value =
                    e.target.value === ''
                      ? undefined
                      : parseInt(e.target.value, 10);
                  onMemorySettingChange('num_gpu_layers', value);
                }}
                placeholder="モデル依存（0=CPUのみ）"
                className={errors.num_gpu_layers ? 'error' : ''}
              />
              <small className="param-range">
                {MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}-
                {MEMORY_SETTINGS.NUM_GPU_LAYERS.MAX}（
                {MEMORY_SETTINGS.NUM_GPU_LAYERS.MIN}=CPUのみ）
              </small>
            </div>
            {errors.num_gpu_layers && (
              <span className="error-message">{errors.num_gpu_layers}</span>
            )}
          </div>

          {/* CPUスレッド数 */}
          <div className="param-row">
            <label htmlFor="num_threads">
              CPUスレッド数 (CPU Threads)
              <Tooltip
                content="使用するCPUスレッド数です。通常はシステムのコア数に合わせて設定します。値を大きくすると処理速度が向上する場合があります（推奨: システム依存）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="num_threads"
                type="number"
                min={MEMORY_SETTINGS.NUM_THREADS.MIN}
                max={MEMORY_SETTINGS.NUM_THREADS.MAX}
                step="1"
                value={memorySettings?.num_threads ?? ''}
                onChange={e => {
                  const value =
                    e.target.value === ''
                      ? undefined
                      : parseInt(e.target.value, 10);
                  onMemorySettingChange('num_threads', value);
                }}
                placeholder="システム依存"
                className={errors.num_threads ? 'error' : ''}
              />
              <small className="param-range">
                {MEMORY_SETTINGS.NUM_THREADS.MIN}-
                {MEMORY_SETTINGS.NUM_THREADS.MAX}
              </small>
            </div>
            {errors.num_threads && (
              <span className="error-message">{errors.num_threads}</span>
            )}
          </div>

          {/* バッチサイズ */}
          <div className="param-row">
            <label htmlFor="batch_size">
              バッチサイズ (Batch Size)
              <Tooltip
                content="一度に処理するトークン数です。値を大きくすると処理速度が向上する場合がありますが、メモリ使用量が増加します（推奨: 512）。"
                position="right"
              >
                <span className="tooltip-trigger-icon">i</span>
              </Tooltip>
            </label>
            <div className="param-input-group">
              <input
                id="batch_size"
                type="number"
                min={MEMORY_SETTINGS.BATCH_SIZE.MIN}
                max={MEMORY_SETTINGS.BATCH_SIZE.MAX}
                step="1"
                value={
                  memorySettings?.batch_size ??
                  MEMORY_SETTINGS.BATCH_SIZE.DEFAULT
                }
                onChange={e => {
                  const value =
                    e.target.value === ''
                      ? undefined
                      : parseInt(e.target.value, 10);
                  onMemorySettingChange('batch_size', value);
                }}
                className={errors.batch_size ? 'error' : ''}
              />
              <small className="param-range">
                {MEMORY_SETTINGS.BATCH_SIZE.MIN}-
                {MEMORY_SETTINGS.BATCH_SIZE.MAX}（推奨:{' '}
                {MEMORY_SETTINGS.BATCH_SIZE.DEFAULT}）
              </small>
            </div>
            {errors.batch_size && (
              <span className="error-message">{errors.batch_size}</span>
            )}
          </div>

          {/* MMAP */}
          <div className="param-row">
            <label className="checkbox-label">
              <Tooltip
                content="メモリマップドファイルを使用してモデルを読み込みます。有効にすると、起動時間が短縮され、メモリ使用量が削減されます（推奨: 有効）。"
                position="right"
              >
                <input
                  type="checkbox"
                  checked={memorySettings?.use_mmap ?? true}
                  onChange={e =>
                    onMemorySettingChange('use_mmap', e.target.checked)
                  }
                />
              </Tooltip>
              <span>メモリマップドファイルを使用 (Use MMAP)</span>
            </label>
          </div>

          {/* MLock */}
          <div className="param-row">
            <label className="checkbox-label">
              <Tooltip
                content="メモリをロックして、スワップに移行しないようにします。有効にすると、パフォーマンスが向上する場合がありますが、システムメモリが不足する可能性があります（推奨: 無効）。"
                position="right"
              >
                <input
                  type="checkbox"
                  checked={memorySettings?.use_mlock ?? false}
                  onChange={e =>
                    onMemorySettingChange('use_mlock', e.target.checked)
                  }
                />
              </Tooltip>
              <span>メモリをロック (Use MLock)</span>
            </label>
          </div>

          {/* 低メモリモード */}
          <div className="param-row">
            <label className="checkbox-label">
              <Tooltip
                content="低メモリモードを有効にします。メモリが少ない環境で使用しますが、パフォーマンスが低下する可能性があります（推奨: 無効）。"
                position="right"
              >
                <input
                  type="checkbox"
                  checked={memorySettings?.low_mem ?? false}
                  onChange={e =>
                    onMemorySettingChange('low_mem', e.target.checked)
                  }
                />
              </Tooltip>
              <span>低メモリモード (Low Memory Mode)</span>
            </label>
          </div>

          {/* リセットボタン */}
          <div className="param-reset">
            <button
              type="button"
              className="param-reset-button"
              onClick={onReset}
            >
              メモリ設定をデフォルト値にリセット
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

