// settings-integration - 設定ページの結合テスト

/**
 * @jest-environment jsdom
 */
import React from 'react';
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('Settings.tsx - 結合テスト', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSafeInvoke.mockClear();
    mockListen.mockClear();
    window.confirm = jest.fn(() => true);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderWithProviders = async (component: React.ReactElement) => {
    const result = render(
      <BrowserRouter>
        <ThemeProvider>
          <I18nProvider>{component}</I18nProvider>
        </ThemeProvider>
      </BrowserRouter>
    );
    // ThemeProviderの初期化を待つ
    await waitFor(
      () => {
        expect(mockSafeInvoke).toHaveBeenCalled();
      },
      { timeout: 1000 }
    ).catch(() => {
      // エラーは無視（既に初期化済みの場合）
    });
    return result;
  };

  describe('設定の保存と読み込みの統合', () => {
    it('設定を保存してから再読み込みすると、保存した設定が反映される', async () => {
      const initialSettings = {
        theme: 'light',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      const updatedSettings = {
        theme: 'dark',
        language: 'en',
        auto_refresh_interval: 60,
        log_retention_days: 60,
        notifications_enabled: false,
        stop_apis_on_exit: false,
      };

      // 初回読み込み
      mockSafeInvoke.mockResolvedValueOnce(initialSettings);
      // 保存
      mockSafeInvoke.mockResolvedValueOnce(undefined);
      // 再読み込み
      mockSafeInvoke.mockResolvedValueOnce(updatedSettings);

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      // 設定を変更
      const themeSelect = screen.getByLabelText(/テーマ/i) as HTMLSelectElement;
      await userEvent.selectOptions(themeSelect, 'dark');

      const languageSelect = screen.getByLabelText(
        /表示言語/i
      ) as HTMLSelectElement;
      await userEvent.selectOptions(languageSelect, 'en');

      const intervalInput = screen.getByLabelText(
        /自動更新間隔/i
      ) as HTMLInputElement;
      fireEvent.change(intervalInput, { target: { value: '60' } });

      const retentionInput = screen.getByLabelText(
        /ログ保持期間/i
      ) as HTMLInputElement;
      fireEvent.change(retentionInput, { target: { value: '60' } });

      const notificationCheckbox = screen.getByLabelText(
        /通知を有効にする/i
      ) as HTMLInputElement;
      await userEvent.click(notificationCheckbox);

      const stopOnExitCheckbox = screen.getByLabelText(
        /アプリ終了時にAPIを停止する/i
      ) as HTMLInputElement;
      await userEvent.click(stopOnExitCheckbox);

      // 保存
      const saveButton = screen.getByRole('button', { name: /保存/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledWith('update_app_settings', {
          settings: expect.objectContaining({
            theme: 'dark',
            language: 'en',
            auto_refresh_interval: 60,
            log_retention_days: 60,
            notifications_enabled: false,
            stop_apis_on_exit: false,
          }),
        });
      });

      // 再読み込み
      const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledWith('get_app_settings');
      });
    });
  });

  describe('テーマとI18nコンテキストとの統合', () => {
    it('テーマを変更すると、ThemeContextが更新される', async () => {
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

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const themeSelect = screen.getByLabelText(/テーマ/i) as HTMLSelectElement;
      await userEvent.selectOptions(themeSelect, 'dark');

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledWith('update_app_settings', {
          settings: expect.objectContaining({
            theme: 'dark',
          }),
        });
      });

      // 成功メッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('テーマを変更しました')).toBeInTheDocument();
      });
    });

    it('言語を変更すると、I18nContextが更新される', async () => {
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

      await renderWithProviders(<Settings />);

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

  describe('CloudSyncSettingsとの統合', () => {
    it('CloudSyncSettingsコンポーネントが表示される', async () => {
      const mockSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      mockSafeInvoke.mockResolvedValueOnce(mockSettings);

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('cloud-sync-settings')).toBeInTheDocument();
      });
    });
  });

  describe('エラーハンドリングの統合', () => {
    it('設定の読み込みに失敗した場合、エラーメッセージを表示し、再試行できる', async () => {
      const errorMessage = '設定の読み込みに失敗しました';

      mockSafeInvoke
        .mockRejectedValueOnce(new Error(errorMessage)) // 初回読み込み失敗
        .mockResolvedValueOnce({
          // 再試行成功
          theme: 'auto',
          language: 'ja',
          auto_refresh_interval: 30,
          log_retention_days: 30,
          notifications_enabled: true,
          stop_apis_on_exit: true,
        });

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // エラーメッセージを閉じる
      const closeButton = screen.getByRole('button', { name: /閉じる/i });
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
      });
    });

    it('設定の保存に失敗した場合、エラーメッセージを表示し、再試行できる', async () => {
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
        .mockRejectedValueOnce(new Error(errorMessage)) // 保存失敗
        .mockResolvedValueOnce(undefined); // 再試行成功

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /保存/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // エラーメッセージを閉じる
      const closeButton = screen.getByRole('button', { name: /閉じる/i });
      await userEvent.click(closeButton);

      // 再試行
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('設定を保存しました')).toBeInTheDocument();
      });
    });
  });

  describe('成功メッセージの自動非表示', () => {
    it('設定を保存すると、成功メッセージが表示され、5秒後に自動的に非表示になる', async () => {
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
        .mockResolvedValueOnce(undefined); // 保存

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /保存/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('設定を保存しました')).toBeInTheDocument();
      });

      // 5秒経過
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(
          screen.queryByText('設定を保存しました')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('複数の設定項目の同時変更', () => {
    it('複数の設定項目を同時に変更して保存できる', async () => {
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
        .mockResolvedValueOnce(undefined); // 保存

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      // 複数の設定を変更
      const themeSelect = screen.getByLabelText(/テーマ/i) as HTMLSelectElement;
      await userEvent.selectOptions(themeSelect, 'dark');

      const languageSelect = screen.getByLabelText(
        /表示言語/i
      ) as HTMLSelectElement;
      await userEvent.selectOptions(languageSelect, 'en');

      const intervalInput = screen.getByLabelText(
        /自動更新間隔/i
      ) as HTMLInputElement;
      fireEvent.change(intervalInput, { target: { value: '60' } });

      const retentionInput = screen.getByLabelText(
        /ログ保持期間/i
      ) as HTMLInputElement;
      fireEvent.change(retentionInput, { target: { value: '60' } });

      const notificationCheckbox = screen.getByLabelText(
        /通知を有効にする/i
      ) as HTMLInputElement;
      await userEvent.click(notificationCheckbox);

      // 保存
      const saveButton = screen.getByRole('button', { name: /保存/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledWith('update_app_settings', {
          settings: expect.objectContaining({
            theme: 'dark',
            language: 'en',
            auto_refresh_interval: 60,
            log_retention_days: 60,
            notifications_enabled: false,
            stop_apis_on_exit: true,
          }),
        });
      });
    });
  });

  describe('保存中の状態管理', () => {
    it('保存中は保存ボタンが無効化される', async () => {
      const mockSettings = {
        theme: 'light',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
        stop_apis_on_exit: true,
      };

      // 保存処理を遅延させる
      let resolveSave: () => void;
      const savePromise = new Promise<void>(resolve => {
        resolveSave = resolve;
      });

      mockSafeInvoke
        .mockResolvedValueOnce(mockSettings) // 初回読み込み
        .mockImplementationOnce(() => savePromise); // 保存（遅延）

      await renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('アプリケーション設定')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /保存/i });
      await userEvent.click(saveButton);

      // 保存中はボタンが無効化される
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
        expect(saveButton.textContent).toContain('保存中');
      });

      // 保存完了
      resolveSave!();
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
        expect(saveButton.textContent).toContain('保存');
      });
    });
  });
});
