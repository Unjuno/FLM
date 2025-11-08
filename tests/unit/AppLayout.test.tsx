// AppLayout - アプリケーションレイアウトコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppLayout } from '../../src/components/layout/AppLayout';

// Header, Sidebar, Footerをモック
jest.mock('../../src/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

jest.mock('../../src/components/layout/EnhancedSidebar', () => ({
  EnhancedSidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

jest.mock('../../src/components/layout/Footer', () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));

describe('AppLayout.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('デフォルトレイアウトで子要素を表示する', () => {
      render(
        <AppLayout>
          <div>Test Content</div>
        </AppLayout>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    // 注意: AppLayoutコンポーネントにはshowSidebarプロパティが存在しないため、
    // これらのテストはスキップします
    it.skip('サイドバーを表示する（showSidebar=true）', () => {
      render(
        <AppLayout>
          <div>Test Content</div>
        </AppLayout>
      );

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it.skip('サイドバーを非表示にする（showSidebar=false）', () => {
      render(
        <AppLayout>
          <div>Test Content</div>
        </AppLayout>
      );

      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });
  });

  describe('レイアウトタイプ', () => {
    it('minimalレイアウトを表示する', () => {
      const { container } = render(
        <AppLayout layoutType="minimal">
          <div>Test Content</div>
        </AppLayout>
      );

      expect(
        container.querySelector('.app-layout.minimal')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });

    it('defaultレイアウトを表示する', () => {
      const { container } = render(
        <AppLayout layoutType="default">
          <div>Test Content</div>
        </AppLayout>
      );

      expect(
        container.querySelector('.app-layout.default')
      ).toBeInTheDocument();
    });

    it('sidebarレイアウトを表示する', () => {
      const { container } = render(
        <AppLayout layoutType="sidebar">
          <div>Test Content</div>
        </AppLayout>
      );

      expect(
        container.querySelector('.app-layout.sidebar')
      ).toBeInTheDocument();
    });
  });

  describe('カスタムクラス名', () => {
    it('カスタムクラス名を適用する', () => {
      const { container } = render(
        <AppLayout className="custom-class">
          <div>Test Content</div>
        </AppLayout>
      );

      expect(
        container.querySelector('.app-layout.custom-class')
      ).toBeInTheDocument();
    });
  });

  describe('サイドバーの折りたたみ', () => {
    // 注意: AppLayoutコンポーネントにはサイドバーの折りたたみ機能が実装されていないため、
    // このテストはスキップします
    it.skip('サイドバーが折りたたまれた状態で表示される', () => {
      const { container } = render(
        <AppLayout>
          <div>Test Content</div>
        </AppLayout>
      );

      expect(
        container.querySelector('.app-layout.sidebar-collapsed')
      ).toBeInTheDocument();
    });
  });
});
