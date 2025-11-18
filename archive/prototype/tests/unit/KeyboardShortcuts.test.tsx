// KeyboardShortcuts - キーボードショートカット一覧コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KeyboardShortcuts } from '../../src/components/common/KeyboardShortcuts';
import type { KeyboardShortcut } from '../../src/hooks/useKeyboardShortcuts';

describe('KeyboardShortcuts.tsx', () => {
  const mockShortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      description: '新しいAPIを作成',
      ctrlKey: true,
      handler: () => {},
      enabled: true,
    },
    {
      key: 'l',
      description: 'APIログを表示',
      ctrlKey: true,
      handler: () => {},
      enabled: true,
    },
    {
      key: 'h',
      description: 'ヘルプを表示',
      ctrlKey: true,
      handler: () => {},
      enabled: false, // 無効化されたショートカット
    },
  ];

  describe('基本的なレンダリング', () => {
    it('ショートカット一覧を表示する', () => {
      render(<KeyboardShortcuts shortcuts={mockShortcuts} />);
      expect(screen.getByText('新しいAPIを作成')).toBeInTheDocument();
      expect(screen.getByText('APIログを表示')).toBeInTheDocument();
    });

    it('ショートカットが空の場合、メッセージを表示する', () => {
      render(<KeyboardShortcuts shortcuts={[]} />);
      expect(
        screen.getByText('ショートカットがありません')
      ).toBeInTheDocument();
    });

    it('無効化されたショートカットを非表示にする', () => {
      render(<KeyboardShortcuts shortcuts={mockShortcuts} />);
      expect(screen.queryByText('ヘルプを表示')).not.toBeInTheDocument();
    });
  });

  describe('ショートカットキーの表示', () => {
    it('Ctrlキーを含むショートカットを表示する', () => {
      render(<KeyboardShortcuts shortcuts={[mockShortcuts[0]]} />);
      // Ctrl+Nが表示されることを確認
      expect(screen.getByText(/Ctrl/i)).toBeInTheDocument();
      expect(screen.getByText(/N/i)).toBeInTheDocument();
    });

    it('複数の修飾キーを含むショートカットを表示する', () => {
      const shortcut: KeyboardShortcut = {
        key: 's',
        description: '保存',
        ctrlKey: true,
        shiftKey: true,
        handler: () => {},
      };
      render(<KeyboardShortcuts shortcuts={[shortcut]} />);
      expect(screen.getByText(/Ctrl/i)).toBeInTheDocument();
      expect(screen.getByText(/Shift/i)).toBeInTheDocument();
    });
  });

  describe('groupedプロパティ', () => {
    it('groupedがfalseの場合、通常のリストを表示する', () => {
      const { container } = render(
        <KeyboardShortcuts shortcuts={mockShortcuts} grouped={false} />
      );
      expect(
        container.querySelector('.keyboard-shortcuts-list')
      ).toBeInTheDocument();
    });

    it('groupedがtrueの場合、グループ化されたリストを表示する', () => {
      const { container } = render(
        <KeyboardShortcuts shortcuts={mockShortcuts} grouped={true} />
      );
      expect(
        container.querySelector('.keyboard-shortcuts-list')
      ).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('kbd要素を使用してキーを表示する', () => {
      const { container } = render(
        <KeyboardShortcuts shortcuts={[mockShortcuts[0]]} />
      );
      const kbdElements = container.querySelectorAll('kbd');
      expect(kbdElements.length).toBeGreaterThan(0);
    });

    it('各ショートカットに説明を表示する', () => {
      render(<KeyboardShortcuts shortcuts={mockShortcuts} />);
      expect(screen.getByText('新しいAPIを作成')).toBeInTheDocument();
      expect(screen.getByText('APIログを表示')).toBeInTheDocument();
    });
  });
});
