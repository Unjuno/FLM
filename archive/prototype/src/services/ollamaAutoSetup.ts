import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { safeInvoke } from '../utils/tauri';
import type {
  DownloadProgress,
  OllamaHealthStatus,
  OllamaStatus,
} from '../types/ollama';

export type AutoSetupStepId =
  | 'detect'
  | 'download'
  | 'install'
  | 'start'
  | 'health-check';

export type AutoSetupStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'warning'
  | 'error';

export interface AutoSetupStepState {
  id: AutoSetupStepId;
  label: string;
  status: AutoSetupStepStatus;
  message?: string;
  progress?: number;
}

export interface AutoSetupResult {
  status: OllamaStatus | null;
  steps: AutoSetupStepState[];
  error?: string;
}

const INITIAL_STEPS: AutoSetupStepState[] = [
  {
    id: 'detect',
    label: 'Ollamaの検出',
    status: 'pending',
  },
  {
    id: 'download',
    label: 'Ollamaのダウンロード',
    status: 'pending',
  },
  {
    id: 'install',
    label: 'Ollamaのインストール',
    status: 'pending',
  },
  {
    id: 'start',
    label: 'Ollamaの起動',
    status: 'pending',
  },
  {
    id: 'health-check',
    label: 'ヘルスチェック',
    status: 'pending',
  },
];

function cloneInitialSteps(): AutoSetupStepState[] {
  return INITIAL_STEPS.map(step => ({ ...step }));
}

function updateStep(
  steps: AutoSetupStepState[],
  id: AutoSetupStepId,
  patch: Partial<AutoSetupStepState>
): AutoSetupStepState[] {
  return steps.map(step =>
    step.id === id
      ? {
          ...step,
          ...patch,
        }
      : step
  );
}

export async function autoSetupOllama(
  onStepUpdate?: (steps: AutoSetupStepState[]) => void
): Promise<AutoSetupResult> {
  let steps = cloneInitialSteps();
  let healthInfo: OllamaHealthStatus | null = null;
  let downloadListener: UnlistenFn | null = null;

  const emitUpdate = () => {
    onStepUpdate?.(steps);
  };

  const setStep = (
    id: AutoSetupStepId,
    patch: Partial<AutoSetupStepState>
  ) => {
    steps = updateStep(steps, id, patch);
    emitUpdate();
  };

  try {
    // Step 1: Detect
    setStep('detect', {
      status: 'running',
      message: 'Ollamaを検出しています...でしばらくお待ちください。',
    });
    let status = await safeInvoke<OllamaStatus>('detect_ollama');
    setStep('detect', {
      status: 'success',
      message: status.running
        ? 'Ollamaは起動済みです'
        : status.installed || status.portable
          ? 'Ollamaはインストール済みですが停止中です'
          : 'Ollamaは未インストールです',
    });

    // Step 2: Download (when not installed)
    if (!status.installed && !status.portable) {
      setStep('download', {
        status: 'running',
        message: '最新版のOllamaをダウンロードしています...',
        progress: 0,
      });

      try {
        downloadListener = await listen<DownloadProgress>(
          'ollama_download_progress',
          event => {
            const payload = event.payload;
            steps = updateStep(steps, 'download', {
              status: payload.status === 'error' ? 'error' : 'running',
              message:
                payload.message ??
                `ダウンロード中... ${payload.progress.toFixed(1)}%`,
              progress: payload.progress,
            });
            emitUpdate();
          }
        );
      } catch {
        // イベント登録に失敗しても致命的ではないため無視
      }

      const downloadPath = await safeInvoke<string>('download_ollama', {
        platform: null,
      });

      if (downloadListener) {
        await downloadListener();
        downloadListener = null;
      }

      setStep('download', {
        status: 'success',
        message: 'ダウンロードが完了しました',
        progress: 100,
      });

      setStep('install', {
        status: 'success',
        message: `Ollamaをアプリディレクトリに展開しました (パス: ${downloadPath})`,
      });

      // 再検出
      status = await safeInvoke<OllamaStatus>('detect_ollama');
    } else {
      setStep('download', {
        status: 'success',
        message: '既にOllamaが利用可能です',
        progress: 100,
      });
      setStep('install', {
        status: 'success',
        message: 'インストール済みのOllamaを検出しました',
      });
    }

    // Step 3: Start (when not running)
    if (!status.running) {
      setStep('start', {
        status: 'running',
        message: 'Ollamaを起動しています...',
      });

      const explicitPath = status.portable_path || status.system_path || null;

      await safeInvoke<number>('start_ollama', {
        ollama_path: explicitPath,
      });

      setStep('start', {
        status: 'success',
        message: 'Ollamaを起動しました',
      });
    } else {
      setStep('start', {
        status: 'success',
        message: 'Ollamaは既に起動しています',
      });
    }

    // Step 4: Health check
    setStep('health-check', {
      status: 'running',
      message: 'ヘルスチェックを実行しています...',
    });

    healthInfo = await safeInvoke<OllamaHealthStatus>('check_ollama_health');

    if (!healthInfo.running) {
      setStep('health-check', {
        status: 'error',
        message: 'Ollamaサービスから応答がありませんでした',
      });
      return {
        status: null,
        steps,
        error: 'Ollamaサービスが起動していません。再試行してください。',
      };
    }

    if (!healthInfo.port_available) {
      setStep('health-check', {
        status: 'success',
        message: 'Ollamaがポート11434で待機中です',
      });
    } else {
      setStep('health-check', {
        status: 'warning',
        message:
          'Ollamaは起動しましたがポート11434が利用可能な状態です。別環境でプロキシ経由になっている可能性があります。',
      });
    }

    const finalStatus = await safeInvoke<OllamaStatus>('detect_ollama');

    return {
      status: finalStatus,
      steps,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Ollamaの自動セットアップに失敗しました';

    // 最後にエラーになったステップを更新
    const runningStep = steps.find(step => step.status === 'running');
    if (runningStep) {
      setStep(runningStep.id, {
        status: 'error',
        message,
      });
    }

    return {
      status: null,
      steps,
      error: message,
    };
  } finally {
    if (downloadListener) {
      try {
        await downloadListener();
      } catch {
        // ignore cleanup error
      }
    }
  }
}

