// LanguageSwitcher - 言語切り替えコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LanguageSwitcher } from '../../src/components/common/LanguageSwitcher';

// I18nContextをモック
const mockSetLocale = jest.fn();
const mockUseI18n = jest.fn(() => ({
  locale: 'ja',
  setLocale: mockSetLocale,
}));

jest.mock('../../src/contexts/I18nContext', () => ({
  useI18n: () => mockUseI18n(),
}));

// Tooltipをモック
jest.mock('../../src/components/common/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('LanguageSwitcher.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseI18n.mockReturnValue({
      locale: 'ja',
      setLocale: mockSetLocale,
    });
  });

  describe('基本的なレンダリング', () => {
    it('現在の言語を表示する', () => {
      render(<LanguageSwitcher />);

      expect(screen.getByText('🇯🇵')).toBeInTheDocument();
      expect(screen.getByText('JA')).toBeInTheDocument();
    });

    it('英語に切り替えた場合、英語を表示する', () => {
      mockUseI18n.mockReturnValue({
        locale: 'en',
        setLocale: mockSetLocale,
      });

      render(<LanguageSwitcher />);

      expect(screen.getByText('🇺🇸')).toBeInTheDocument();
      expect(screen.getByText('EN')).toBeInTheDocument();
    });
  });

  describe('ドロップダウンの開閉', () => {
    it('ボタンをクリックするとドロップダウンを開く', () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('再度ボタンをクリックするとドロップダウンを閉じる', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('外部をクリックするとドロップダウンを閉じる', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('言語の切り替え', () => {
    it('言語オプションをクリックすると言語を切り替える', async () => {
      mockSetLocale.mockResolvedValue(undefined);

      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      const englishOption = screen.getByRole('menuitem', {
        name: /Englishに切り替え/i,
      });
      fireEvent.click(englishOption);

      await waitFor(() => {
        expect(mockSetLocale).toHaveBeenCalledWith('en');
      });

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('現在の言語を選択しても切り替えない', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const japaneseOption = screen.getByRole('menuitem', {
        name: /日本語に切り替え/i,
      });
      fireEvent.click(japaneseOption);

      await waitFor(() => {
        expect(mockSetLocale).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('アクティブな言語にチェックマークを表示する', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const japaneseOption = screen.getByRole('menuitem', {
        name: /日本語に切り替え/i,
      });
      expect(japaneseOption).toHaveClass('active');
      expect(screen.getByText('✓')).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('ボタンに適切なaria属性を設定する', () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'true');
    });

    it('ドロップダウンが開いたとき、aria-expandedをtrueにする', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('言語オプションに適切なaria-labelを設定する', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const japaneseOption = screen.getByRole('menuitem', {
        name: /日本語に切り替え/i,
      });
      expect(japaneseOption).toHaveAttribute('aria-label', '日本語に切り替え');

      const englishOption = screen.getByRole('menuitem', {
        name: /Englishに切り替え/i,
      });
      expect(englishOption).toHaveAttribute('aria-label', 'Englishに切り替え');
    });
  });

  describe('UI要素', () => {
    it('矢印アイコンが開閉状態に応じて変化する', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });

      // 閉じている状態
      expect(screen.getByText('▼')).toBeInTheDocument();

      // 開いている状態
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('▲')).toBeInTheDocument();
      });
    });

    it('すべての言語オプションを表示する', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /日本語.*言語を変更/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('日本語')).toBeInTheDocument();
        expect(screen.getByText('English')).toBeInTheDocument();
      });
    });
  });
});
