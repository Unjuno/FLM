// AppLoading - アプリケーション起動時の読み込みUIコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppLoading } from '../../src/components/common/AppLoading';

describe('AppLoading.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('ローディング画面を表示する', () => {
      render(<AppLoading />);
      expect(screen.getByText('FLM')).toBeInTheDocument();
    });

    it('ロゴ画像を表示する', () => {
      render(<AppLoading />);
      const logo = screen.getByAltText('FLM');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/logo.png');
    });

    it('サブタイトルを表示する', () => {
      render(<AppLoading />);
      expect(screen.getByText('Local LLM API Manager')).toBeInTheDocument();
    });

    it('ローディングメッセージを表示する', () => {
      render(<AppLoading />);
      expect(
        screen.getByText('アプリケーションを起動しています...')
      ).toBeInTheDocument();
    });
  });

  describe('ローディング要素', () => {
    it('スピナーリングを表示する', () => {
      const { container } = render(<AppLoading />);
      const spinner = container.querySelector('.app-loading-spinner');
      expect(spinner).toBeInTheDocument();

      const rings = container.querySelectorAll('.spinner-ring');
      expect(rings.length).toBe(3);
    });

    it('プログレスバーを表示する', () => {
      const { container } = render(<AppLoading />);
      const progressBar = container.querySelector('.app-loading-progress');
      expect(progressBar).toBeInTheDocument();

      const progressFill = container.querySelector('.progress-fill');
      expect(progressFill).toBeInTheDocument();
    });
  });

  describe('構造', () => {
    it('適切なクラス名を持つ', () => {
      const { container } = render(<AppLoading />);
      expect(container.querySelector('.app-loading')).toBeInTheDocument();
      expect(container.querySelector('.app-loading-panel')).toBeInTheDocument();
      expect(container.querySelector('.app-loading-logo')).toBeInTheDocument();
    });
  });
});
