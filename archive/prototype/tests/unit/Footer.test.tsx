// Footer - フッターコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Footer } from '../../src/components/layout/Footer';

describe('Footer.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  describe('基本的なレンダリング', () => {
    it('フッターを表示する', () => {
      renderWithRouter(<Footer />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('著作権情報を表示する', () => {
      renderWithRouter(<Footer />);
      expect(screen.getByText(/©|Copyright|2024/i)).toBeInTheDocument();
    });
  });

  describe('リンク', () => {
    it('ヘルプリンクを表示する', () => {
      renderWithRouter(<Footer />);
      // Footerはbuttonとしてリンクを表示している
      const helpButton = screen.getByRole('button', { name: /ヘルプ/i });
      expect(helpButton).toBeInTheDocument();
    });

    it('プライバシーポリシーリンクを表示する', () => {
      renderWithRouter(<Footer />);
      // Footerはbuttonとしてリンクを表示している
      const privacyButton = screen.getByRole('button', {
        name: /プライバシーポリシー/i,
      });
      expect(privacyButton).toBeInTheDocument();
    });

    it('利用規約リンクを表示する', () => {
      renderWithRouter(<Footer />);
      // Footerはbuttonとしてリンクを表示している
      const termsButton = screen.getByRole('button', { name: /利用規約/i });
      expect(termsButton).toBeInTheDocument();
    });
  });

  describe('バージョン情報', () => {
    it('バージョン情報を表示する', () => {
      renderWithRouter(<Footer />);
      expect(screen.getByText(/Version|v\d+\.\d+\.\d+/i)).toBeInTheDocument();
    });
  });
});
