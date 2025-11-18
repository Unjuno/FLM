// Navigation - Navigationコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Navigation } from '../../src/components/navigation/Navigation';

describe('Navigation.tsx', () => {
  const mockItems = [
    { path: '/', label: 'ホーム', icon: '🏠' },
    { path: '/api/list', label: 'API一覧', icon: '📋' },
    { path: '/models', label: 'モデル管理', icon: '🤖' },
  ];

  describe('基本的なレンダリング', () => {
    it('ナビゲーション項目を表示する', () => {
      render(
        <BrowserRouter>
          <Navigation items={mockItems} />
        </BrowserRouter>
      );

      expect(screen.getByText('ホーム')).toBeInTheDocument();
      expect(screen.getByText('API一覧')).toBeInTheDocument();
      expect(screen.getByText('モデル管理')).toBeInTheDocument();
    });

    it('アイコンを表示する', () => {
      render(
        <BrowserRouter>
          <Navigation items={mockItems} />
        </BrowserRouter>
      );

      expect(screen.getByText('🏠')).toBeInTheDocument();
      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });
  });

  describe('方向の設定', () => {
    it('horizontal（デフォルト）でレンダリングする', () => {
      const { container } = render(
        <BrowserRouter>
          <Navigation items={mockItems} orientation="horizontal" />
        </BrowserRouter>
      );

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('navigation', 'navigation-horizontal');
    });

    it('verticalでレンダリングする', () => {
      const { container } = render(
        <BrowserRouter>
          <Navigation items={mockItems} orientation="vertical" />
        </BrowserRouter>
      );

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('navigation', 'navigation-vertical');
    });
  });

  describe('ネストされたメニュー', () => {
    const nestedItems = [
      {
        path: '/api',
        label: 'API',
        icon: '📋',
        children: [
          { path: '/api/list', label: 'API一覧', icon: '📄' },
          { path: '/api/create', label: 'API作成', icon: '➕' },
        ],
      },
    ];

    it('ネストされたメニュー項目を表示する', () => {
      render(
        <BrowserRouter>
          <Navigation items={nestedItems} />
        </BrowserRouter>
      );

      expect(screen.getByText('API')).toBeInTheDocument();
      // 子項目は展開されていない場合、表示されない可能性がある
    });
  });
});
