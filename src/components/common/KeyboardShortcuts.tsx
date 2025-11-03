// KeyboardShortcuts - キーボードショートカット一覧コンポーネント

import React from 'react';
import { getShortcutDisplay, KeyboardShortcut } from '../../hooks/useKeyboardShortcuts';
import './KeyboardShortcuts.css';

/**
 * キーボードショートカット一覧コンポーネントのプロパティ
 */
interface KeyboardShortcutsProps {
  /** ショートカット定義の配列 */
  shortcuts: KeyboardShortcut[];
  /** カテゴリ別にグループ化するか */
  grouped?: boolean;
}

/**
 * キーボードショートカット一覧コンポーネント
 * 利用可能なショートカットを表示します
 */
export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  shortcuts,
  grouped = false,
}) => {
  if (shortcuts.length === 0) {
    return (
      <div className="keyboard-shortcuts">
        <p className="keyboard-shortcuts-empty">ショートカットがありません</p>
      </div>
    );
  }

  const filteredShortcuts = shortcuts.filter(s => s.enabled !== false);

  if (grouped) {
    // カテゴリ別にグループ化（将来的に実装可能）
    return (
      <div className="keyboard-shortcuts">
        <div className="keyboard-shortcuts-list">
          {filteredShortcuts.map((shortcut, index) => (
            <div key={index} className="keyboard-shortcuts-item">
              <div className="keyboard-shortcuts-keys">
                {getShortcutDisplay(shortcut).split('+').map((key, keyIndex) => (
                  <kbd key={keyIndex} className="keyboard-key">
                    {key}
                  </kbd>
                ))}
              </div>
              <div className="keyboard-shortcuts-description">
                {shortcut.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="keyboard-shortcuts">
      <div className="keyboard-shortcuts-list">
        {filteredShortcuts.map((shortcut, index) => (
          <div key={index} className="keyboard-shortcuts-item">
            <div className="keyboard-shortcuts-keys">
              {getShortcutDisplay(shortcut).split('+').map((key, keyIndex) => (
                <kbd key={keyIndex} className="keyboard-key">
                  {key}
                </kbd>
              ))}
            </div>
            <div className="keyboard-shortcuts-description">
              {shortcut.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

