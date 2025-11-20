// LanguageSwitcher - 言語切り替えコンポーネント

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import './LanguageSwitcher.css';

/**
 * 言語切り替えコンポーネント
 * ドロップダウンメニューで言語を切り替えます
 */
export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownElementRef = useRef<HTMLDivElement>(null);

  // ドロップダウンの位置を計算する関数
  const calculateDropdownPosition = useCallback(() => {
    if (!isOpen || !buttonRef.current || !dropdownElementRef.current) return;

    // 少し遅延を入れて、DOMが完全にレンダリングされた後に位置を計算
    requestAnimationFrame(() => {
      if (!buttonRef.current || !dropdownElementRef.current) return;

      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdown = dropdownElementRef.current;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const dropdownWidth = 180; // min-width
      const dropdownHeight = dropdown.offsetHeight || 300; // 推定高さ

      // 右端から左に表示するか、左端から右に表示するかを決定
      const spaceOnRight = viewportWidth - buttonRect.right;
      const spaceOnLeft = buttonRect.left;
      const spaceOnTop = buttonRect.top;
      const spaceOnBottom = viewportHeight - buttonRect.bottom;

      // 横方向の位置調整（ボタンの右端に合わせる）
      // 右側に十分なスペースがある場合は右端に表示
      if (spaceOnRight >= dropdownWidth) {
        dropdown.style.left = `${buttonRect.right}px`;
        dropdown.style.right = 'auto';
      } else if (spaceOnLeft >= dropdownWidth) {
        // 左側に十分なスペースがある場合は左端に表示（ボタンの左端から）
        dropdown.style.left = `${buttonRect.left - dropdownWidth}px`;
        dropdown.style.right = 'auto';
      } else {
        // どちらも足りない場合は、ウィンドウ内に収まるように調整
        if (spaceOnRight > spaceOnLeft) {
          // 右側の方が広い場合は、右端に合わせる
          dropdown.style.left = `${Math.max(8, viewportWidth - dropdownWidth - 8)}px`;
          dropdown.style.right = 'auto';
        } else {
          // 左側の方が広い場合は、左端に合わせる
          dropdown.style.left = '8px';
          dropdown.style.right = 'auto';
        }
      }

      // 縦方向の位置調整（通常は上に表示）
      if (spaceOnTop >= dropdownHeight + 8) {
        // 上に十分なスペースがある場合は上に表示
        dropdown.style.top = `${buttonRect.top - dropdownHeight - 8}px`;
        dropdown.style.bottom = 'auto';
      } else if (spaceOnBottom >= dropdownHeight + 8) {
        // 下に十分なスペースがある場合は下に表示
        dropdown.style.top = `${buttonRect.bottom + 8}px`;
        dropdown.style.bottom = 'auto';
      } else {
        // どちらも足りない場合は、ウィンドウ内に収まるように調整
        dropdown.style.top = '8px';
        dropdown.style.bottom = 'auto';
        dropdown.style.maxHeight = `${viewportHeight - 16}px`;
      }

      // 確実にウィンドウ内に収まるように最終チェック
      const finalRect = dropdown.getBoundingClientRect();
      if (finalRect.right > viewportWidth) {
        dropdown.style.left = `${viewportWidth - dropdownWidth - 8}px`;
      }
      if (finalRect.left < 0) {
        dropdown.style.left = '8px';
      }
      if (finalRect.bottom > viewportHeight) {
        dropdown.style.top = `${viewportHeight - dropdownHeight - 8}px`;
      }
      if (finalRect.top < 0) {
        dropdown.style.top = '8px';
      }
    });
  }, [isOpen]);

  // ドロップダウンの位置を計算
  useEffect(() => {
    calculateDropdownPosition();
  }, [calculateDropdownPosition]);

  // ウィンドウのリサイズ時にも位置を再計算
  useEffect(() => {
    if (isOpen) {
      const handleResize = () => {
        calculateDropdownPosition();
      };
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [isOpen, calculateDropdownPosition]);

  // クリックアウトサイドで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLanguageChange = async (
    newLocale: 'ja' | 'en' | 'zh' | 'ko' | 'es' | 'fr' | 'de'
  ) => {
    if (newLocale !== locale) {
      await setLocale(newLocale);
    }
    setIsOpen(false);
  };

  const languages = [
    { code: 'ja' as const, label: '日本語', flag: '🇯🇵' },
    { code: 'en' as const, label: 'English', flag: '🇺🇸' },
    { code: 'zh' as const, label: '中文', flag: '🇨🇳' },
    { code: 'ko' as const, label: '한국어', flag: '🇰🇷' },
    { code: 'es' as const, label: 'Español', flag: '🇪🇸' },
    { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
    { code: 'de' as const, label: 'Deutsch', flag: '🇩🇪' },
  ];

  const currentLanguage =
    languages.find(lang => lang.code === locale) || languages[0];

  return (
    <div className="language-switcher" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="language-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`${currentLanguage.label} - 言語を変更`}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="true"
      >
        <span className="language-flag">{currentLanguage.flag}</span>
        <span className="language-code">
          {currentLanguage.code.toUpperCase()}
        </span>
        <span className="language-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="language-dropdown" ref={dropdownElementRef} role="menu">
          {languages.map(language => (
            <button
              key={language.code}
              className={`language-option ${locale === language.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(language.code)}
              role="menuitem"
              aria-label={`${language.label}に切り替え`}
            >
              <span className="language-flag">{language.flag}</span>
              <span className="language-label">{language.label}</span>
              {locale === language.code && (
                <span className="language-check">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
