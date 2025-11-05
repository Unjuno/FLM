// NavItem - NavItemコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { NavItem } from '../../src/components/navigation/NavItem';

describe('NavItem.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('ラベルを表示する', () => {
      render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト項目" />
        </BrowserRouter>
      );
      
      expect(screen.getByText('テスト項目')).toBeInTheDocument();
    });

    it('アイコンを表示する', () => {
      render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト" icon="🏠" />
        </BrowserRouter>
      );
      
      expect(screen.getByText('🏠')).toBeInTheDocument();
    });

    it('バッジを表示する', () => {
      render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト" badge={5} />
        </BrowserRouter>
      );
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('アクティブ状態', () => {
    it('アクティブな項目を表示する', () => {
      const { container } = render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト" active={true} />
        </BrowserRouter>
      );
      
      const navItem = container.querySelector('.nav-item');
      expect(navItem).toHaveClass('active');
    });

    it('非アクティブな項目を表示する', () => {
      const { container } = render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト" active={false} />
        </BrowserRouter>
      );
      
      const navItem = container.querySelector('.nav-item');
      expect(navItem).not.toHaveClass('active');
    });
  });

  describe('クリックイベント', () => {
    it('クリック時にonClickコールバックを呼び出す', () => {
      const onClick = jest.fn();
      render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト" onClick={onClick} />
        </BrowserRouter>
      );
      
      const navItem = screen.getByText('テスト');
      fireEvent.click(navItem);
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('無効状態', () => {
    it('無効な項目を表示する', () => {
      const { container } = render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト" disabled={true} />
        </BrowserRouter>
      );
      
      const navItem = container.querySelector('.nav-item');
      expect(navItem).toHaveClass('disabled');
    });

    it('無効な項目はクリックできない', () => {
      const onClick = jest.fn();
      render(
        <BrowserRouter>
          <NavItem path="/test" label="テスト" disabled={true} onClick={onClick} />
        </BrowserRouter>
      );
      
      const navItem = screen.getByText('テスト');
      fireEvent.click(navItem);
      
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});

