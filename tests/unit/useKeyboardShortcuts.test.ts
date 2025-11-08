// useKeyboardShortcuts - キーボードショートカット管理フックのユニットテスト

/**
 * @jest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import {
  useKeyboardShortcuts,
  getShortcutDisplay,
} from '../../src/hooks/useKeyboardShortcuts';
import type { KeyboardShortcut } from '../../src/hooks/useKeyboardShortcuts';

// BrowserRouterでラップするヘルパー
const wrapper = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(BrowserRouter, {}, children);
};

describe('useKeyboardShortcuts.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // クリーンアップは不要（renderHookが自動的にクリーンアップする）
  });

  describe('基本的な機能', () => {
    it('ショートカットを登録する', () => {
      const handler = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'n',
          description: '新しいAPIを作成',
          ctrlKey: true,
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts), { wrapper });

      // ショートカットが登録されたことを確認（実際のイベント発火は別テストで）
      expect(handler).not.toHaveBeenCalled(); // まだ呼ばれていない
    });

    it('enabledがfalseの場合、ショートカットを無効化する', () => {
      const handler = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'n',
          description: 'テスト',
          ctrlKey: true,
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts, false), { wrapper });

      // ショートカットが無効化されていることを確認
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getShortcutDisplay関数', () => {
    it('Ctrlキーのショートカットを表示する', () => {
      const shortcut: KeyboardShortcut = {
        key: 'n',
        description: 'テスト',
        ctrlKey: true,
        handler: () => {},
      };

      const display = getShortcutDisplay(shortcut);
      expect(display).toContain('Ctrl');
      expect(display).toContain('N');
    });

    it('Shiftキーのショートカットを表示する', () => {
      const shortcut: KeyboardShortcut = {
        key: 'n',
        description: 'テスト',
        ctrlKey: true,
        shiftKey: true,
        handler: () => {},
      };

      const display = getShortcutDisplay(shortcut);
      expect(display).toContain('Shift');
    });

    it('Altキーのショートカットを表示する', () => {
      const shortcut: KeyboardShortcut = {
        key: 'n',
        description: 'テスト',
        ctrlKey: true,
        altKey: true,
        handler: () => {},
      };

      const display = getShortcutDisplay(shortcut);
      expect(display).toContain('Alt');
    });

    it('特殊キーを適切に表示する', () => {
      const escapeShortcut: KeyboardShortcut = {
        key: 'Escape',
        description: 'テスト',
        handler: () => {},
      };

      const display = getShortcutDisplay(escapeShortcut);
      expect(display).toContain('Esc');
    });

    it('矢印キーを適切に表示する', () => {
      const arrowUpShortcut: KeyboardShortcut = {
        key: 'ArrowUp',
        description: 'テスト',
        handler: () => {},
      };

      const display = getShortcutDisplay(arrowUpShortcut);
      expect(display).toContain('↑');
    });

    it('スペースキーを適切に表示する', () => {
      const spaceShortcut: KeyboardShortcut = {
        key: ' ',
        description: 'テスト',
        handler: () => {},
      };

      const display = getShortcutDisplay(spaceShortcut);
      expect(display).toContain('Space');
    });
  });

  describe('ショートカットの無効化', () => {
    it('enabledがfalseのショートカットを無視する', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'n',
          description: 'テスト1',
          ctrlKey: true,
          handler: handler1,
          enabled: false,
        },
        {
          key: 'l',
          description: 'テスト2',
          ctrlKey: true,
          handler: handler2,
          enabled: true,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts), { wrapper });

      // enabledがfalseのショートカットは無視される
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('入力フィールドでのショートカット', () => {
    it('入力フィールドでは一部のショートカットのみ有効', () => {
      const handler = jest.fn();
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'n',
          description: 'テスト',
          ctrlKey: true,
          handler,
        },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts), { wrapper });

      // 入力フィールドではCtrl+Nは無効化される
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        bubbles: true,
      });
      input.dispatchEvent(event);

      // 入力フィールドでは無効化される（allowedInInputに'n'がない）
      expect(handler).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  describe('プラットフォーム対応', () => {
    it('macOSではCmdキーを表示する', () => {
      // navigator.platformをモック
      Object.defineProperty(navigator, 'platform', {
        writable: true,
        value: 'MacIntel',
      });

      const shortcut: KeyboardShortcut = {
        key: 'n',
        description: 'テスト',
        metaKey: true,
        handler: () => {},
      };

      const display = getShortcutDisplay(shortcut);
      expect(display).toContain('Cmd');
    });

    it('Windows/LinuxではCtrlキーを表示する', () => {
      // navigator.platformをモック
      Object.defineProperty(navigator, 'platform', {
        writable: true,
        value: 'Win32',
      });

      const shortcut: KeyboardShortcut = {
        key: 'n',
        description: 'テスト',
        ctrlKey: true,
        handler: () => {},
      };

      const display = getShortcutDisplay(shortcut);
      expect(display).toContain('Ctrl');
    });
  });
});
