// ModelConverter - モデル変換コンポーネント

import React, { useState, useCallback } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { listen } from '@tauri-apps/api/event';
import { useNotifications } from '../../contexts/NotificationContext';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import './ModelConverter.css';

/**
 * モデル変換進捗情報
 */
interface ConversionProgress {
  status: string;
  progress: number;
  message?: string;
}

/**
 * モデル変換コンポーネント
 */
export const ModelConverter: React.FC = () => {
  const { showSuccess, showError } = useNotifications();
  const [sourcePath, setSourcePath] = useState('');
  const [targetName, setTargetName] = useState('');
  const [quantization, setQuantization] = useState('Q4_K_M');
  const [outputFormat, setOutputFormat] = useState('gguf');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  /**
   * モデル変換を開始
   */
  const handleConvert = useCallback(async () => {
    if (!sourcePath || !targetName) {
      setError('ソースパスとターゲット名を入力してください');
      return;
    }

    if (!confirm('モデル変換を開始しますか？この処理には時間がかかる場合があります。')) {
      return;
    }

    try {
      setConverting(true);
      setError(null);
      setProgress(null);
      setOutputPath(null);

      // 進捗イベントをリッスン
      const unlisten = await listen<ConversionProgress>('model_conversion_progress', (event) => {
        setProgress(event.payload);
      });

      // 変換実行
      const path = await safeInvoke<string>('convert_model', {
        config: {
          source_path: sourcePath,
          target_name: targetName,
          quantization: quantization || null,
          output_format: outputFormat,
        },
      });

      // イベントリスナーを解除
      unlisten();

      setOutputPath(path);
      showSuccess('モデル変換が完了しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'モデル変換に失敗しました');
      showError(err instanceof Error ? err.message : 'モデル変換に失敗しました');
    } finally {
      setConverting(false);
      setProgress(null);
    }
  }, [sourcePath, targetName, quantization, outputFormat, showSuccess, showError]);

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
            extensions: ['gguf', 'ggml', 'bin', 'pt', 'onnx', 'safetensors', 'pth', 'ckpt'],
          },
        ],
      });
      
      if (selectedPath) {
        setSourcePath(selectedPath);
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
    <div className="model-converter">
      <div className="model-converter-header">
        <h2>モデル変換</h2>
        <p className="model-converter-description">
          PyTorch、ONNX等のモデルをGGUF形式に変換して、Ollamaで使用できるようにします。
        </p>
      </div>

      <div className="model-converter-form">
        <div className="form-group">
          <label htmlFor="source-path">
            ソースモデルパス <span className="required">*</span>
          </label>
          <div className="file-input-group">
            <input
              id="source-path"
              type="text"
              className="form-input"
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="例: /path/to/model.safetensors"
              disabled={converting}
            />
            <button
              className="button secondary"
              onClick={handleSelectFile}
              disabled={converting}
            >
              ファイル選択
            </button>
          </div>
          <small className="form-hint">
            変換元のモデルファイルのパス（.safetensors, .bin, .onnx等）
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="target-name">
            ターゲットモデル名 <span className="required">*</span>
          </label>
          <input
            id="target-name"
            type="text"
            className="form-input"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            placeholder="例: my-model-gguf"
            disabled={converting}
          />
          <small className="form-hint">変換後のモデル名</small>
        </div>

        <div className="form-group">
          <label htmlFor="quantization">量子化レベル</label>
          <select
            id="quantization"
            className="form-select"
            value={quantization}
            onChange={(e) => setQuantization(e.target.value)}
            disabled={converting}
          >
            <option value="Q4_K_M">Q4_K_M（推奨・バランス型）</option>
            <option value="Q8_0">Q8_0（高精度）</option>
            <option value="Q4_0">Q4_0（軽量）</option>
            <option value="Q5_K_M">Q5_K_M（中精度）</option>
            <option value="F16">F16（最高精度・大容量）</option>
          </select>
          <small className="form-hint">
            量子化レベルによって、モデルサイズと精度が変わります
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="output-format">出力形式</label>
          <select
            id="output-format"
            className="form-select"
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value)}
            disabled={converting}
          >
            <option value="gguf">GGUF（Ollama推奨）</option>
          </select>
        </div>

        <div className="form-actions">
          <button
            className="button primary"
            onClick={handleConvert}
            disabled={converting || !sourcePath || !targetName}
          >
            {converting ? '変換中...' : '🔄 変換開始'}
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

      {progress && (
        <div className="conversion-progress">
          <div className="progress-header">
            <h3>変換進捗</h3>
            <span className="progress-status">{progress.status}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="progress-info">
            <span className="progress-percentage">{progress.progress.toFixed(1)}%</span>
            {progress.message && (
              <span className="progress-message">{progress.message}</span>
            )}
          </div>
        </div>
      )}

      {outputPath && (
        <InfoBanner
          type="success"
          message={`モデル変換が完了しました: ${outputPath}`}
        />
      )}
    </div>
  );
};

