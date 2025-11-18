// Help - ヘルプページコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Help } from '../../src/pages/Help';

// react-router-domのuseLocationをモック
const mockLocation = {
  pathname: '/help',
  search: '',
  hash: '',
  state: null,
};

const mockNavigate = jest.fn();
const mockUseLocation = jest.fn(() => mockLocation);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

// useOnboardingをモック
const mockHandleShowOnboarding = jest.fn();
jest.mock('../../src/components/onboarding/Onboarding', () => ({
  ...jest.requireActual('../../src/components/onboarding/Onboarding'),
  useOnboarding: () => ({
    handleShowOnboarding: mockHandleShowOnboarding,
  }),
}));

describe('Help.tsx', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockHandleShowOnboarding.mockClear();
    mockLocation.search = '';
    mockLocation.state = null;
  });

  describe('基本的なレンダリング', () => {
    it('ヘルプページを表示する', () => {
      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      // 複数の要素が存在する可能性があるため、getAllByTextを使用
      const helpElements = screen.getAllByText(/ヘルプ/i);
      expect(helpElements.length).toBeGreaterThan(0);
    });

    it('デフォルトでFAQセクションを表示する', () => {
      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      // h2タグの「よくある質問（FAQ）」を確認
      expect(
        screen.getByRole('heading', { name: /よくある質問.*FAQ/i })
      ).toBeInTheDocument();
    });

    it('ナビゲーションボタンを表示する', () => {
      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      expect(
        screen.getByRole('button', { name: /よくある質問/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /使い方ガイド/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /トラブルシューティング/i })
      ).toBeInTheDocument();
    });
  });

  describe('セクション切り替え', () => {
    it('使い方ガイドボタンをクリックすると、使い方ガイドセクションを表示する', async () => {
      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      const guideButton = screen.getByRole('button', { name: /使い方ガイド/i });

      await act(async () => {
        guideButton.click();
      });

      await waitFor(() => {
        // h2タグの「使い方ガイド」を確認
        expect(
          screen.getByRole('heading', { name: /使い方ガイド/i })
        ).toBeInTheDocument();
      });
    });

    it('トラブルシューティングボタンをクリックすると、トラブルシューティングセクションを表示する', async () => {
      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      const troubleButton = screen.getByRole('button', {
        name: /トラブルシューティング/i,
      });

      await act(async () => {
        troubleButton.click();
      });

      await waitFor(() => {
        // h2タグの「トラブルシューティング」を確認
        expect(
          screen.getByRole('heading', { name: /トラブルシューティング/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('エラータイプに応じたトラブルシューティングの自動表示', () => {
    it('errorTypeパラメータがある場合、トラブルシューティングセクションを自動表示する', async () => {
      mockLocation.search = '?errorType=ollama';

      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      await waitFor(() => {
        // h2タグの「トラブルシューティング」を確認
        expect(
          screen.getByRole('heading', { name: /トラブルシューティング/i })
        ).toBeInTheDocument();
      });
    });

    it('errorType=ollamaの場合、Ollama関連のトラブルシューティング項目を展開する', async () => {
      mockLocation.search = '?errorType=ollama';

      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      await waitFor(() => {
        // トラブルシューティングセクションが表示されることを確認
        expect(
          screen.getByRole('heading', { name: /トラブルシューティング/i })
        ).toBeInTheDocument();
        // Ollama関連のトラブルシューティング項目が表示されることを確認
        expect(screen.getByText(/Ollamaが起動しない/i)).toBeInTheDocument();
      });
    });

    it('errorType=apiの場合、API関連のトラブルシューティング項目を展開する', async () => {
      mockLocation.search = '?errorType=api';

      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /トラブルシューティング/i })
        ).toBeInTheDocument();
        expect(screen.getByText(/APIが起動しない/i)).toBeInTheDocument();
      });
    });

    it('errorType=modelの場合、モデル関連のトラブルシューティング項目を展開する', async () => {
      mockLocation.search = '?errorType=model';

      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /トラブルシューティング/i })
        ).toBeInTheDocument();
        expect(
          screen.getByText(/モデルのダウンロードが失敗する/i)
        ).toBeInTheDocument();
      });
    });

    it('errorType=networkの場合、ネットワーク関連のトラブルシューティング項目を展開する', async () => {
      mockLocation.search = '?errorType=network';

      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /トラブルシューティング/i })
        ).toBeInTheDocument();
        expect(
          screen.getByText(/モデルのダウンロードが失敗する/i)
        ).toBeInTheDocument();
      });
    });

    it('errorTypeが指定されていない場合、デフォルトでFAQセクションを表示する', () => {
      mockLocation.search = '';

      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      // h2タグの「よくある質問（FAQ）」を確認
      expect(
        screen.getByRole('heading', { name: /よくある質問.*FAQ/i })
      ).toBeInTheDocument();
    });
  });

  describe('オンボーディング再表示機能', () => {
    it('オンボーディングを再表示ボタンをクリックすると、オンボーディングを表示する', () => {
      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      const onboardingButton = screen.getByRole('button', {
        name: /オンボーディングを再表示/i,
      });
      onboardingButton.click();

      expect(mockHandleShowOnboarding).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('API作成チュートリアルを再表示ボタンをクリックすると、チュートリアル完了フラグをクリアしてホームに遷移する', () => {
      // チュートリアル完了フラグを設定
      localStorage.setItem('flm_api_creation_tutorial_completed', 'true');

      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      const tutorialButton = screen.getByRole('button', {
        name: /API作成チュートリアルを再表示/i,
      });
      tutorialButton.click();

      // チュートリアル完了フラグがクリアされることを確認
      expect(
        localStorage.getItem('flm_api_creation_tutorial_completed')
      ).toBeNull();
      // ホームページに遷移することを確認
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('FAQ機能', () => {
    it('FAQ項目をクリックすると展開する', async () => {
      render(
        <BrowserRouter>
          <Help />
        </BrowserRouter>
      );

      // FAQセクションが表示されていることを確認
      const faqHeading = screen.getByRole('heading', {
        name: /よくある質問.*FAQ/i,
      });
      expect(faqHeading).toBeInTheDocument();

      // FAQ項目のボタンを探す
      const faqButton = screen.getByRole('button', {
        name: /FLMとは何ですか/i,
      });
      expect(faqButton).toBeInTheDocument();

      await act(async () => {
        faqButton.click();
      });

      // 展開された内容が表示されることを確認（実装に応じて調整）
      // 実際のコンポーネントでは展開状態が変わることを確認
      await waitFor(() => {
        // アイコンが変更される（▶ → ▼）ことを確認
        const icon = faqButton.querySelector('.faq-icon');
        expect(icon?.textContent).toContain('▼');
      });
    });
  });
});
