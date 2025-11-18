// Header - ヘッダーコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Header } from '../../src/components/layout/Header';

// useI18nをモック（I18nProviderのエラーを回避）
jest.mock('../../src/contexts/I18nContext', () => {
  const actual = jest.requireActual('../../src/contexts/I18nContext');
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'header.home': 'ホーム',
          'header.apiList': 'API一覧',
          'header.modelManagement': 'モデル',
          'header.logs': 'ログ',
          'header.performance': 'パフォーマンス',
          'header.settings': '設定',
          'header.help': 'ヘルプ',
        };
        return translations[key] || key;
      },
      locale: 'ja',
      setLocale: jest.fn(),
    }),
  };
});

describe('Header.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  describe('基本的なレンダリング', () => {
    it('ヘッダーを表示する', () => {
      const { container } = renderWithRouter(<Header />);
      // ヘッダーコンポーネントが表示される（header要素）
      const header = container.querySelector('header');
      expect(header).toBeTruthy();
      expect(header).toBeInTheDocument();
    });

    it('アプリケーション名またはロゴを表示する', () => {
      const { container } = renderWithRouter(<Header />);
      // ロゴまたはアプリケーション名が表示される（header-app-nameクラスまたはbrand-link）
      const appName = container.querySelector('.header-app-name');
      const brandLink = container.querySelector('.brand-link');
      expect(appName || brandLink).toBeTruthy();
      if (appName) {
        expect(appName.textContent).toContain('FLM');
      } else if (brandLink) {
        expect(brandLink).toBeInTheDocument();
      }
    });
  });

  describe('ナビゲーション', () => {
    it('ナビゲーションメニューを表示する', () => {
      const { container } = renderWithRouter(<Header />);
      // ナビゲーションボタンが存在する（nav-list内のボタンまたは複数のホームボタン）
      const navList = container.querySelector('.nav-list');
      const homeButtons = screen.getAllByRole('button', { name: /ホーム/i });
      expect(navList || homeButtons.length > 0).toBeTruthy();
    });
  });

  describe('ユーザー設定', () => {
    it('設定ボタンまたはリンクを表示する', () => {
      renderWithRouter(<Header />);
      const settingsButton = screen.getByRole('button', { name: /設定/i });
      expect(settingsButton).toBeInTheDocument();
    });
  });
});
