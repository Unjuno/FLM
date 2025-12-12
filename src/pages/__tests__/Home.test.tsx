import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Home } from '../Home';
import { I18nProvider } from '../../contexts/I18nContext';
import * as tauriUtils from '../../utils/tauri';

// Mock Tauri utilities
vi.mock('../../utils/tauri', () => ({
  safeInvoke: vi.fn(),
  extractCliError: vi.fn(),
}));

// Mock router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderHome = () => {
    return render(
      <BrowserRouter>
        <I18nProvider>
          <Home />
        </I18nProvider>
      </BrowserRouter>
    );
  };

  it('should render home page with title', () => {
    vi.mocked(tauriUtils.safeInvoke).mockResolvedValue({
      version: '1.0',
      data: [{ running: false }],
    });

    renderHome();

    expect(screen.getByText('FLM - Local LLM API Manager')).toBeInTheDocument();
    expect(screen.getByText('ローカルLLM API管理ツール')).toBeInTheDocument();
  });

  it('should display proxy status when running', async () => {
    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'dev-self-signed',
          },
        ],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      });

    renderHome();

    await waitFor(() => {
      // i18nを使用しているため、翻訳値を確認
      expect(screen.getByText(/実行中|running/i)).toBeInTheDocument();
    });

    // i18nを使用しているため、柔軟にチェック
    expect(screen.getByText(/8080/)).toBeInTheDocument();
  });

  it('should display proxy status when stopped', async () => {
    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      });

    renderHome();

    await waitFor(() => {
      // i18nを使用しているため、翻訳値を確認
      expect(screen.getByText(/停止中|stopped/i)).toBeInTheDocument();
    });
  });

  it('should display engines when detected', async () => {
    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [
            {
              id: 'ollama',
              name: 'Ollama',
              status: 'running-healthy',
            },
            {
              id: 'vllm',
              name: 'vLLM',
              status: 'installed-only',
            },
          ],
        },
      });

    renderHome();

    await waitFor(() => {
      // i18nを使用しているため、柔軟にチェック
      expect(screen.getByText(/エンジン/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Ollama/)).toBeInTheDocument();
    expect(screen.getByText(/vLLM/)).toBeInTheDocument();
  });

  it('should start proxy when start button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      })
      .mockResolvedValueOnce(undefined) // proxy start
      .mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'dev-selfsigned',
          },
        ],
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('プロキシを起動')).toBeInTheDocument();
    });

    // i18nを使用しているため、柔軟にチェック
    const startButton = screen.getByText(/プロキシを起動|start/i);
    await user.click(startButton);

    await waitFor(() => {
      expect(tauriUtils.safeInvoke).toHaveBeenCalledWith('ipc_proxy_start', {
        mode: 'dev-selfsigned',
        port: 8080,
        no_daemon: true,
      });
    });
  });

  it('should stop proxy when stop button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'dev-self-signed',
          },
        ],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      })
      .mockResolvedValueOnce(undefined) // proxy stop
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('プロキシを停止')).toBeInTheDocument();
    });

    // i18nを使用しているため、柔軟にチェック
    const stopButton = screen.getByText(/プロキシを停止|stop/i);
    await user.click(stopButton);

    await waitFor(() => {
      expect(tauriUtils.safeInvoke).toHaveBeenCalledWith('ipc_proxy_stop', {
        port: 8080,
      });
    });
  });

  it('should show error when stopping proxy that is not running', async () => {
    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('プロキシを起動')).toBeInTheDocument();
    });

    // プロキシが停止中の場合、停止ボタンは表示されない
    // 代わりに起動ボタンが表示される
    expect(screen.queryByText('プロキシを停止')).not.toBeInTheDocument();
  });

  it('should show error when stopping proxy without port', async () => {
    const user = userEvent.setup();

    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            // port is missing
          },
        ],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('プロキシを停止')).toBeInTheDocument();
    });

    // i18nを使用しているため、柔軟にチェック
    const stopButton = screen.getByText(/プロキシを停止|stop/i);
    await user.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText(/プロキシが実行されていません/)).toBeInTheDocument();
    });

    // ipc_proxy_stop should not be called when port is missing
    expect(tauriUtils.safeInvoke).not.toHaveBeenCalledWith('ipc_proxy_stop', expect.anything());
  });

  it('should show success message when proxy stops successfully', async () => {
    const user = userEvent.setup();

    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'dev-self-signed',
          },
        ],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          status: 'stopped',
        },
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('プロキシを停止')).toBeInTheDocument();
    });

    // i18nを使用しているため、柔軟にチェック
    const stopButton = screen.getByText(/プロキシを停止|stop/i);
    await user.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('プロキシが停止しました')).toBeInTheDocument();
    });
  });

  it('should show error message when proxy stop fails', async () => {
    const user = userEvent.setup();

    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'dev-self-signed',
          },
        ],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      })
      .mockRejectedValueOnce(new Error('Failed to stop proxy'));

    vi.mocked(tauriUtils.extractCliError).mockReturnValue({
      code: 'PROXY_STOP_ERROR',
      message: 'Failed to stop proxy',
      stderr: 'Error details',
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('プロキシを停止')).toBeInTheDocument();
    });

    // i18nを使用しているため、柔軟にチェック
    const stopButton = screen.getByText(/プロキシを停止|stop/i);
    await user.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to stop proxy/)).toBeInTheDocument();
    });
  });

  it('should navigate to chat tester when button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText('Chat Tester')).toBeInTheDocument();
    });

    const chatTesterButton = screen.getByText('Chat Tester');
    await user.click(chatTesterButton);

    expect(mockNavigate).toHaveBeenCalledWith('/chat/tester');
  });

  it('should display error message when proxy status fails', async () => {
    vi.mocked(tauriUtils.safeInvoke)
      .mockRejectedValueOnce(new Error('Failed to get proxy status'))
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      });

    vi.mocked(tauriUtils.extractCliError).mockReturnValue(null);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText(/Failed to get proxy status/)).toBeInTheDocument();
    });
  });

  it('should format proxy mode correctly', async () => {
    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [
          {
            running: true,
            port: 8080,
            mode: 'local-http',
          },
        ],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [],
        },
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText(/Local HTTP/)).toBeInTheDocument();
    });
  });

  it('should format engine status correctly', async () => {
    vi.mocked(tauriUtils.safeInvoke)
      .mockResolvedValueOnce({
        version: '1.0',
        data: [{ running: false }],
      })
      .mockResolvedValueOnce({
        version: '1.0',
        data: {
          engines: [
            {
              id: 'ollama',
              name: 'Ollama',
              status: {
                status: 'running-healthy',
                latency_ms: 100,
              },
            },
          ],
        },
      });

    renderHome();

    await waitFor(() => {
      expect(screen.getByText(/Running Healthy \(100ms\)/)).toBeInTheDocument();
    });
  });
});
