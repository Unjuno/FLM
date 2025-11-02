// FLM - ヘッダーコンポーネント
// フロントエンドエージェント (FE) 実装
// FE-017-01: 共通レイアウトコンポーネント実装

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from '../common/Tooltip';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useI18n } from '../../contexts/I18nContext';
import './Header.css';

/**
 * ナビゲーション項目の型定義
 */
interface NavigationItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * ヘッダーコンポーネントのプロパティ
 */
export interface HeaderProps {
  /** アプリケーション名 */
  appName?: string;
  /** ロゴ画像のパス（オプション） */
  logoUrl?: string;
  /** ユーザーメニューを表示するか */
  showUserMenu?: boolean;
  /** 通知アイコンを表示するか */
  showNotifications?: boolean;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * ヘッダーコンポーネント
 * アプリケーション全体で使用する共通ヘッダー
 */
export const Header: React.FC<HeaderProps> = ({
  appName = 'FLM',
  logoUrl,
  showUserMenu = false,
  showNotifications = false,
  className = '',
}) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // 現在のパス名（文字列なのでメモ化は不要）
  const currentPath = location.pathname;

  // パスがアクティブかどうかを判定（useCallbackでメモ化）
  const isActive = useCallback((path: string): boolean => {
    return currentPath === path;
  }, [currentPath]);

  // ナビゲーションアイテム（useMemoでメモ化）
  const navigationItems: NavigationItem[] = useMemo(
    () => [
      { path: '/', label: t('header.home'), icon: '🏠' },
      { path: '/api/list', label: t('header.apiList'), icon: '📡' },
      { path: '/models', label: t('header.modelManagement'), icon: '🤖' },
      { path: '/logs', label: t('header.logs'), icon: '📊' },
      { path: '/performance', label: t('header.performance'), icon: '⚡' },
      { path: '/settings', label: t('header.settings'), icon: '⚙️' },
      { path: '/help', label: t('header.help'), icon: '❓' },
    ],
    [t]
  );

  // ホームにナビゲート
  const handleHomeNavigation = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // ナビゲーションハンドラ
  const handleNavigation = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // モバイルメニューのトグル
  const toggleMobileMenu = useCallback(() => {
    setShowMobileMenu((prev) => !prev);
  }, []);

  // モバイルナビゲーションハンドラ
  const handleMobileNavigation = useCallback((path: string) => {
    navigate(path);
    setShowMobileMenu(false);
  }, [navigate]);

  // className を安全に結合
  const headerClassName = useMemo(() => {
    return className.trim() ? `app-header ${className.trim()}` : 'app-header';
  }, [className]);

  return (
    <header className={headerClassName}>
      <div className="header-container">
        {/* ロゴとアプリ名 */}
        <div className="header-brand">
          <button 
            className="brand-link" 
            onClick={handleHomeNavigation}
            aria-label={t('header.home')}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="header-logo" />
            ) : (
              <span className="header-logo-text">🚀</span>
            )}
            <span className="header-app-name">{appName}</span>
          </button>
        </div>

        {/* デスクトップナビゲーション */}
        <nav className="header-nav" aria-label="メインナビゲーション">
          <ul className="nav-list">
            {navigationItems.map((item) => {
              const active = isActive(item.path);
              const handleClick = () => handleNavigation(item.path);
              return (
                <li key={item.path}>
                  <Tooltip content={item.label}>
                    <button
                      className={`nav-link ${active ? 'active' : ''}`}
                      onClick={handleClick}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 右側のアクションボタン */}
        <div className="header-actions">
          {/* 言語切り替え */}
          <LanguageSwitcher />

          {showNotifications && (
            <Tooltip content={t('header.notifications')}>
              <button 
                className="action-button notification-button"
                aria-label={t('header.notifications')}
              >
                🔔
              </button>
            </Tooltip>
          )}
          
          {showUserMenu && (
            <Tooltip content={t('header.userMenu')}>
              <button 
                className="action-button user-menu-button"
                aria-label={t('header.userMenu')}
              >
                👤
              </button>
            </Tooltip>
          )}

          {/* モバイルメニューボタン */}
          <button
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
            aria-label={showMobileMenu ? t('header.closeMenu') : t('header.openMenu')}
            {...(showMobileMenu && { 'aria-expanded': true })}
          >
            {showMobileMenu ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      {showMobileMenu && (
        <nav className="mobile-nav" aria-label={t('header.home')}>
          <ul className="mobile-nav-list">
            {navigationItems.map((item) => {
              const active = isActive(item.path);
              const handleClick = () => handleMobileNavigation(item.path);
              return (
                <li key={item.path}>
                  <button
                    className={`mobile-nav-link ${active ? 'active' : ''}`}
                    onClick={handleClick}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="mobile-nav-icon">{item.icon}</span>
                    <span className="mobile-nav-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
};

