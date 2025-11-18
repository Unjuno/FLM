// Settings - 設定ページコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Settings } from '../../src/pages/Settings';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import { I18nProvider } from '../../src/contexts/I18nContext';

// react-router-domをモック
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Tauri IPCをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
  isTauriAvailable: () => true,
}));

// Tauri event listenをモック
const mockListen = jest.fn();
jest.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

// ThemeContextとI18nContextは実際のプロバイダーを使用するため、モックしない
// ただし、safeInvokeのモックでテーマと言語の設定を読み込む

// CloudSyncSettingsをモック
jest.mock('../../src/components/settings/CloudSyncSettings', () => ({
  CloudSyncSettings: () => (
    <div data-testid="cloud-sync-settings">CloudSyncSettings</div>
  ),
}));

// ErrorMessageとInfoBannerをモック
jest.mock('../../src/components/common/ErrorMessage', () => ({
  ErrorMessage: ({
    message,
    onClose,
  }: {
    message: string;
    onClose: () => void;
  }) => (
    <div data-testid="error-message">
      <span>{message}</span>
      <button onClick={onClose}>閉じる</button>
    </div>
  ),
}));

jest.mock('../../src/components/common/InfoBanner', () => ({
  InfoBanner: ({
    message,
    onDismiss,
  }: {
    message: string;
    onDismiss?: () => void;
  }) => (
    <div data-testid="info-banner">
      <span>{message}</span>
      {onDismiss && <button onClick={onDismiss}>閉じる</button>}
    </div>
  ),
}));

describe('Settings.tsx - ユニットテスト', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSafeInvoke.mockReset();
    mockSafeInvoke.mockImplementation((command: string) => {
      switch (command) {
        case 'get_app_settings':
          return Promise.resolve({
            theme: 'auto',
            language: 'ja',
            auto_refresh_interval: 30,
            log_retention_days: 30,
            notifications_enabled: true,
            stop_apis_on_exit: true,
          });
        case 'detect_engine':
          return Promise.resolve({
            installed: false,
            running: false,
          });
        case 'check_ollama_update':
          return Promise.resolve({
            update_available: false,
            current_version: null,
            latest_version: '0.0.0',
          });
        case 'check_engine_update':
          return Promise.resolve({
            update_available: false,
            current_version: null,
            latest_version: '0.0.0',
          });
        default:
          return Promise.resolve(undefined);
      }
    });
    mockListen.mockClear();
    // window.confirmをモック
    window.confirm = jest.fn(() => true);
    // タイマーは使用しない（userEventと競合するため）
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <ThemeProvider>
          <I18nProvider>
            {component}
          </I18nProvider>
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  describe('基本的なレンダリング', () => {
    it('設定ページを表示する', async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      });

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });
    });

    it('ローディング中はローディングメッセージを表示する', async () => {
      mockSafeInvoke.mockImplementation(() => new Promise(() => {})); // 解決しないPromise

      renderWithProviders(<Settings />);

      expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    });
  });

  describe('設定の読み込み', () => {
    it('設定を正常に読み込む', async () => {
      const mockSettings = {
        theme: 'dark',
        language: 'en',
        auto_refresh_interval: 60,
        log_retention_days: 60,
        notifications_enabled: false,
        stop_apis_on_exit: false,
      };

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledWith('get_app_settings');
      });

      await waitFor(() => {
        const themeSelect = screen.getByRole('combobox', {
          name: /テーマ/i,
        }) as HTMLSelectElement;
        expect(themeSelect.value).toBe('dark');
      });
    });

    it('設定の読み込みに失敗した場合、エラーメッセージを表示する', async () => {
      const errorMessage = '設定の読み込みに失敗しました';
      mockSafeInvoke.mockRejectedValueOnce(new Error(errorMessage));

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('設定の保存', () => {
    it('設定を正常に保存する', async () => {
      const mockSettings = {
        theme: 'light',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke
        .mockResolvedValueOnce(mockSettings) // 初回読み込み
        .mockResolvedValueOnce(undefined); // 保存（setThemeの呼び出し後）

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /保存/i });

      await act(async () => {
        await userEvent.click(saveButton);
      });

      // setThemeが呼ばれることを確認
      await waitFor(
        () => {
          expect(mockSetTheme).toHaveBeenCalledWith('light');
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(mockSafeInvoke).toHaveBeenCalledWith('update_app_settings', {
            settings: expect.objectContaining({
              theme: 'light',
              language: 'ja',
            }),
          });
        },
        { timeout: 3000 }
      );

      // saving状態がfalseになるまで待つ（エラーが発生していないことを確認）
      await waitFor(
        () => {
          const currentSaveButton = screen.getByRole('button', {
            name: /保存/i,
          });
          expect(currentSaveButton).not.toBeDisabled();
        },
        { timeout: 5000 }
      );

      // エラーメッセージが表示されていないことを確認
      const errorMessage = screen.queryByTestId('error-message');
      expect(errorMessage).not.toBeInTheDocument();

      // InfoBannerコンポーネントがレンダリングされるまで待つ
      await waitFor(
        () => {
          const infoBanner = screen.queryByTestId('info-banner');
          expect(infoBanner).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // 成功メッセージが表示されるまで待つ（タイムアウトを長めに設定）
      await waitFor(
        () => {
          const successMessage = screen.queryByText('設定を保存しました');
          expect(successMessage).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('設定の保存に失敗した場合、エラーメッセージを表示する', async () => {
      const mockSettings = {
        theme: 'light',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      const errorMessage = '設定の保存に失敗しました';

      mockSafeInvoke
        .mockResolvedValueOnce(mockSettings) // 初回読み込み
        .mockRejectedValueOnce(new Error(errorMessage)); // 保存失敗

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /保存/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('設定のリセット', () => {
    it('設定をデフォルト値にリセットする', async () => {
      const mockSettings = {
        theme: 'dark',
        language: 'en',
        auto_refresh_interval: 60,
        log_retention_days: 60,
        notifications_enabled: false,
        stop_apis_on_exit: false,
      };

      mockSafeInvoke
        .mockResolvedValueOnce(mockSettings) // 初回読み込み
        .mockResolvedValueOnce(undefined); // リセット

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', {
        name: /デフォルトに戻す/i,
      });

      await act(async () => {
        await userEvent.click(resetButton);
      });

      // リセット処理が完了するまで待つ
      await waitFor(
        () => {
          expect(mockSafeInvoke).toHaveBeenCalledWith('update_app_settings', {
            settings: expect.objectContaining({
              theme: 'auto',
              language: 'ja',
              auto_refresh_interval: 30,
              log_retention_days: 30,
              notifications_enabled: true,
              stop_apis_on_exit: true,
            }),
          });
        },
        { timeout: 3000 }
      );

      // saving状態がfalseになるまで待つ（エラーが発生していないことを確認）
      await waitFor(
        () => {
          const currentResetButton = screen.getByRole('button', {
            name: /デフォルトに戻す/i,
          });
          expect(currentResetButton).not.toBeDisabled();
        },
        { timeout: 5000 }
      );

      // エラーメッセージが表示されていないことを確認
      const errorMessage = screen.queryByTestId('error-message');
      expect(errorMessage).not.toBeInTheDocument();

      // InfoBannerコンポーネントがレンダリングされるまで待つ
      await waitFor(
        () => {
          const infoBanner = screen.queryByTestId('info-banner');
          expect(infoBanner).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // リセット成功メッセージが表示されることを確認（タイムアウトを長めに設定）
      await waitFor(
        () => {
          const successMessage = screen.queryByText('設定をリセットしました');
          expect(successMessage).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('リセット確認でキャンセルした場合、リセットしない', async () => {
      const mockSettings = {
        theme: 'dark',
        language: 'en',
        auto_refresh_interval: 60,
        log_retention_days: 60,
        notifications_enabled: false,
        stop_apis_on_exit: false,
      };

      window.confirm = jest.fn(() => false); // キャンセル

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', {
        name: /デフォルトに戻す/i,
      });
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
      });

      // update_app_settingsが呼ばれていないことを確認
      const updateCalls = mockSafeInvoke.mock.calls.filter(
        call => call[0] === 'update_app_settings'
      );
      expect(updateCalls.length).toBe(0);
    });
  });

  describe('テーマ変更', () => {
    it('テーマを変更する', async () => {
      const mockSettings = {
        theme: 'light',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke
        .mockResolvedValueOnce(mockSettings) // 初回読み込み
        .mockResolvedValueOnce(undefined); // テーマ変更

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const themeSelect = screen.getByRole('combobox', {
        name: /テーマ/i,
      }) as HTMLSelectElement;

      await act(async () => {
        await userEvent.selectOptions(themeSelect, 'dark');
      });

      // テーマが変更されることを確認（setThemeはThemeProvider内で呼ばれる）

      // テーマ変更成功メッセージが表示されるまで待つ（タイムアウトを長めに設定）
      await waitFor(
        () => {
          const successMessage = screen.queryByText('テーマを変更しました');
          expect(successMessage).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('言語変更', () => {
    it('言語を変更する', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke
        .mockResolvedValueOnce(mockSettings) // 初回読み込み
        .mockResolvedValueOnce({ language: 'en' }) // 言語設定読み込み
        .mockResolvedValueOnce(undefined); // 言語設定保存

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const languageSelect = screen.getByLabelText(
        /表示言語/i
      ) as HTMLSelectElement;
      await userEvent.selectOptions(languageSelect, 'en');

      await waitFor(() => {
        expect(languageSelect.value).toBe('en');
      });
    });
  });

  describe('自動更新間隔の変更', () => {
    it('自動更新間隔を変更する', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const intervalInput = screen.getByLabelText(
        /自動更新間隔/i
      ) as HTMLInputElement;
      fireEvent.change(intervalInput, { target: { value: '60' } });

      expect(intervalInput.value).toBe('60');
    });
  });

  describe('ログ保持期間の変更', () => {
    it('ログ保持期間を変更する', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const retentionInput = screen.getByLabelText(
        /ログ保持期間/i
      ) as HTMLInputElement;
      fireEvent.change(retentionInput, { target: { value: '60' } });

      expect(retentionInput.value).toBe('60');
    });
  });

  describe('通知設定の変更', () => {
    it('通知設定を変更する', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const notificationCheckbox = screen.getByLabelText(
        /通知を有効にする/i
      ) as HTMLInputElement;
      expect(notificationCheckbox.checked).toBe(true);

      await userEvent.click(notificationCheckbox);

      expect(notificationCheckbox.checked).toBe(false);
    });
  });

  describe('アプリ終了時の動作設定の変更', () => {
    it('アプリ終了時の動作設定を変更する', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const stopOnExitCheckbox = screen.getByLabelText(
        /アプリ終了時にAPIを停止する/i
      ) as HTMLInputElement;
      expect(stopOnExitCheckbox.checked).toBe(true);

      await userEvent.click(stopOnExitCheckbox);

      expect(stopOnExitCheckbox.checked).toBe(false);
    });
  });

  describe('ナビゲーション', () => {
    it('ホームに戻るボタンをクリックすると、ホームに遷移する', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /ホームに戻る/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('キャンセルボタン', () => {
    it('キャンセルボタンをクリックすると、設定を再読み込みする', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke
        .mockResolvedValueOnce(mockSettings) // 初回読み込み
        .mockResolvedValueOnce(mockSettings); // キャンセル時の再読み込み

      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        // ThemeProviderもget_app_settingsを呼び出すため、呼び出し回数は2以上になる
        const getAppSettingsCalls = mockSafeInvoke.mock.calls.filter(
          call => call[0] === 'get_app_settings'
        );
        expect(getAppSettingsCalls.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
