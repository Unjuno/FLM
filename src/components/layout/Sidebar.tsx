// Sidebar - サイドバーコンポーネント

import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../../contexts/I18nContext';
import './Sidebar.css';

/**
 * サイドバーコンポーネントのプロパティ
 */
export interface SidebarProps {
  /** 折りたたみ状態 */
  defaultCollapsed?: boolean;
  /** カスタムクラス名 */
  className?: string;
  /** 折りたたみ状態変更コールバック */
  onCollapseChange?: (collapsed: boolean) => void;
}

/**
 * ナビゲーションアイテムの型定義
 */
interface NavItem {
  path: string;
  label: string;
}

/**
 * サイドバーコンポーネント
 */
export const Sidebar: React.FC<SidebarProps> = ({
  defaultCollapsed = false,
  className = '',
  onCollapseChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // 折りたたみ状態を切り替える
  const toggleCollapse = useCallback(() => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  }, [collapsed, onCollapseChange]);

  // パスがアクティブかどうかを判定
  const isActive = useCallback(
    (path: string): boolean => {
      return (
        location.pathname === path || location.pathname.startsWith(`${path}/`)
      );
    },
    [location.pathname]
  );

  // ナビゲーションアイテム
  const navItems: NavItem[] = [
    { path: '/', label: t('sidebar.home') },
    { path: '/chat/tester', label: t('sidebar.chatTester') },
    { path: '/security/events', label: t('sidebar.securityEvents') },
    { path: '/security/ip-blocklist', label: t('sidebar.ipBlocklist') },
    { path: '/security/ip-whitelist', label: t('sidebar.ipWhitelist') },
    { path: '/models/profiles', label: t('sidebar.modelProfiles') },
    { path: '/models/comparison', label: t('sidebar.modelComparison') },
    { path: '/settings', label: t('sidebar.settings') },
  ];

  // ナビゲーションハンドラ
  const handleNavigation = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  // className を安全に結合
  const sidebarClassName = `app-sidebar ${collapsed ? 'collapsed' : ''} ${className}`.trim();

  return (
    <aside className={sidebarClassName}>
      <div className="sidebar-container">
        {/* 折りたたみボタン */}
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            onClick={toggleCollapse}
            aria-label={
              collapsed ? t('sidebar.expand') : t('sidebar.collapse')
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? '▶' : '◀'}
          </button>
          {!collapsed && <h2 className="sidebar-title">{t('sidebar.menu')}</h2>}
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="sidebar-nav" aria-label={t('sidebar.menu')}>
          <ul className="sidebar-nav-list">
            {navItems.map(item => {
              const active = isActive(item.path);
              return (
                <li key={item.path} className="sidebar-nav-item">
                  <button
                    className={`sidebar-nav-link ${active ? 'active' : ''}`}
                    onClick={() => handleNavigation(item.path)}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    {!collapsed && (
                      <span className="sidebar-nav-label">{item.label}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
};
