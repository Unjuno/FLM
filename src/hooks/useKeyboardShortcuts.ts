// useKeyboardShortcuts - キーボードショートカットフック

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * キーボードショートカットの定義
 */
export interface KeyboardShortcut {
  /** ショートカットキー（例: "Ctrl+N", "Ctrl+L"） */
  key: string;
  /** ショートカットの説明 */
  description: string;
  /** ショートカット実行時のハンドラ */
  handler: () => void;
  /** Ctrlキーを使用するか（Windows/Linux） */
  ctrlKey?: boolean;
  /** Metaキー（Cmdキー）を使用するか（macOS） */
  metaKey?: boolean;
  /** Shiftキーを使用するか */
  shiftKey?: boolean;
  /** Altキーを使用するか */
  altKey?: boolean;
  /** 有効化フラグ（オプション） */
  enabled?: boolean;
}

/**
 * キーボードショートカットフック
 * 
 * @param shortcuts ショートカット定義の配列
 * @param enabled ショートカットを有効にするか（デフォルト: true）
 * 
 * @example
 * ```tsx
 * const shortcuts: KeyboardShortcut[] = [
 *   {
 *     key: 'n',
 *     description: '新しいAPIを作成',
 *     ctrlKey: true,
 *     handler: () => navigate('/api/create'),
 *   },
 * ];
 * useKeyboardShortcuts(shortcuts);
 * ```
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) => {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 入力フィールドでのショートカットを無効化（オプション）
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Ctrl/Cmd+S や Esc などの一部のショートカットは入力フィールドでも有効
        const allowedInInput = ['Escape', 's', 'S'];
        if (!allowedInInput.includes(event.key)) {
          return;
        }
      }

      // 各ショートカットをチェック
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        // キーの一致をチェック（大文字小文字を区別しない）
        const keyMatches =
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.code.toLowerCase() === shortcut.key.toLowerCase();

        if (!keyMatches) continue;

        // 修飾キーの一致をチェック
        const ctrlMatches =
          shortcut.ctrlKey === undefined
            ? false
            : shortcut.ctrlKey === (event.ctrlKey || event.metaKey);
        const metaMatches =
          shortcut.metaKey === undefined
            ? false
            : shortcut.metaKey === (event.metaKey || event.ctrlKey);
        const shiftMatches =
          shortcut.shiftKey === undefined
            ? false
            : shortcut.shiftKey === event.shiftKey;
        const altMatches =
          shortcut.altKey === undefined
            ? false
            : shortcut.altKey === event.altKey;

        // すべての条件が一致した場合、ハンドラを実行
        if (
          (ctrlMatches || metaMatches || (!shortcut.ctrlKey && !shortcut.metaKey)) &&
          (shiftMatches || shortcut.shiftKey === undefined) &&
          (altMatches || shortcut.altKey === undefined)
        ) {
          // 修飾キーが正しく押されている場合のみ実行
          if (
            (shortcut.ctrlKey && !event.ctrlKey && !event.metaKey) ||
            (shortcut.metaKey && !event.metaKey && !event.ctrlKey) ||
            (shortcut.shiftKey && !event.shiftKey) ||
            (shortcut.altKey && !event.altKey)
          ) {
            continue;
          }

          event.preventDefault();
          event.stopPropagation();
          shortcut.handler();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  return { navigate };
};

/**
 * 標準的なキーボードショートカット定義を生成
 * グローバルに使用できるショートカット（各ページで共通）
 */
export const useGlobalKeyboardShortcuts = () => {
  const navigate = useNavigate();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      description: '新しいAPIを作成',
      ctrlKey: true,
      handler: () => navigate('/api/create'),
    },
    {
      key: 'l',
      description: 'APIログを表示',
      ctrlKey: true,
      handler: () => navigate('/logs'),
    },
    {
      key: 'p',
      description: 'パフォーマンスダッシュボードを表示',
      ctrlKey: true,
      handler: () => navigate('/performance'),
    },
    {
      key: 'm',
      description: 'モデル管理を表示',
      ctrlKey: true,
      handler: () => navigate('/models'),
    },
    {
      key: 'h',
      description: 'ヘルプを表示',
      ctrlKey: true,
      handler: () => navigate('/help'),
    },
    {
      key: 'Home',
      description: 'ホーム画面に戻る',
      ctrlKey: true,
      handler: () => navigate('/'),
    },
    {
      key: 'Escape',
      description: 'モーダルを閉じる',
      handler: () => {
        // モーダルを閉じる（カスタムイベントを発火）
        const event = new CustomEvent('closeModal');
        window.dispatchEvent(event);
      },
    },
  ];

  useKeyboardShortcuts(shortcuts);
};

/**
 * キーボードショートカットの文字列表現を取得
 * 
 * @param shortcut ショートカット定義
 * @returns ショートカットの文字列表現（例: "Ctrl+N"）
 */
export const getShortcutDisplay = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];

  // プラットフォームに応じてCtrl/Cmdを表示
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? 'Cmd' : 'Ctrl';

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(modifierKey);
  }
  if (shortcut.shiftKey) {
    parts.push('Shift');
  }
  if (shortcut.altKey) {
    parts.push('Alt');
  }

  // キー名を整形
  let keyName = shortcut.key;
  const keyMap: { [key: string]: string } = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Escape': 'Esc',
  };

  if (keyMap[keyName]) {
    keyName = keyMap[keyName];
  } else {
    // 大文字に変換（修飾キーがない場合）
    if (!shortcut.shiftKey && keyName.length === 1) {
      keyName = keyName.toUpperCase();
    }
  }

  parts.push(keyName);
  return parts.join('+');
};

