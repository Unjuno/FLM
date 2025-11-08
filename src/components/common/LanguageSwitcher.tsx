// LanguageSwitcher - 言語切り替えコンポーネント

import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { Tooltip } from './Tooltip';
import './LanguageSwitcher.css';

/**
 * 言語切り替えコンポーネント
 * ドロップダウンメニューで言語を切り替えます
 */
export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleLanguageChange = async (newLocale: 'ja' | 'en' | 'zh' | 'ko' | 'es' | 'fr' | 'de') => {
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

  const buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    className: 'language-switcher-button',
    onClick: () => setIsOpen(!isOpen),
    'aria-label': `${currentLanguage.label} - 言語を変更`,
    'aria-expanded': isOpen,
    'aria-haspopup': 'true',
  };

  return (
    <div className="language-switcher" ref={dropdownRef}>
      <Tooltip content={currentLanguage.label}>
        <button {...buttonProps}>
          <span className="language-flag">{currentLanguage.flag}</span>
          <span className="language-code">
            {currentLanguage.code.toUpperCase()}
          </span>
          <span className="language-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
      </Tooltip>

      {isOpen && (
        <div className="language-dropdown" role="menu">
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
