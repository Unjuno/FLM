// Sidebar - サイドバーコンポーネント

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from '../common/Tooltip';
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
  icon: string;
  badge?: number;
}

/**
 * サイドバーコンポーネント
 * 折りたたみ可能なサイドナビゲーション
 */
export const Sidebar: React.FC<SidebarProps> = ({
  defaultCollapsed = false,
  className = '',
  onCollapseChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // defaultCollapsed の変更を内部状態に反映
  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  // 折りたたみ状態を切り替える（useCallbackでメモ化）
  const toggleCollapse = useCallback(() => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  }, [collapsed, onCollapseChange]);

  // パスがアクティブかどうかを判定（useCallbackでメモ化）
  const isActive = useCallback((path: string): boolean => {
    return location.pathname === path;
  }, [location.pathname]);

  // ナビゲーションアイテム（useMemoでメモ化）
  const navItems: NavItem[] = useMemo(() => [
    { path: '/', label: 'ホーム', icon: '🏠' },
    { path: '/apis', label: 'API一覧', icon: '📡' },
    { path: '/models', label: 'モデル管理', icon: '🤖' },
    { path: '/logs', label: 'ログ', icon: '📊' },
    { path: '/performance', label: 'パフォーマンス', icon: '⚡' },
    { path: '/alerts', label: 'アラート', icon: '🔔' },
    { path: '/settings', label: '設定', icon: '⚙️' },
    { path: '/help', label: 'ヘルプ', icon: '❓' },
  ], []);

  // ナビゲーションハンドラ（useCallbackでメモ化）
  const handleNavigation = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // className を安全に結合
  const sidebarClassName = useMemo(() => {
    const classes = ['app-sidebar'];
    if (collapsed) {
      classes.push('collapsed');
    }
    if (className.trim()) {
      classes.push(className.trim());
    }
    return classes.join(' ');
  }, [collapsed, className]);

  return (
    <aside className={sidebarClassName}>
      <div className="sidebar-container">
        {/* 折りたたみボタン */}
        <div className="sidebar-header">
          <Tooltip content={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'} position="right">
            <button
              className="sidebar-toggle"
              onClick={toggleCollapse}
              aria-label={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
              {...(!collapsed && { 'aria-expanded': true })}
            >
              {collapsed ? '▶' : '◀'}
            </button>
          </Tooltip>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="sidebar-nav" aria-label="サイドナビゲーション">
          <ul className="sidebar-nav-list">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <li key={item.path} className="sidebar-nav-item">
                  <Tooltip content={item.label} position="right" disabled={!collapsed}>
                    <button
                      className={`sidebar-nav-link ${active ? 'active' : ''}`}
                      onClick={() => handleNavigation(item.path)}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="sidebar-nav-icon">{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span className="sidebar-nav-label">{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="sidebar-nav-badge">{item.badge}</span>
                          )}
                        </>
                      )}
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

