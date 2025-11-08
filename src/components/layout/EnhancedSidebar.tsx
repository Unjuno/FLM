/* eslint-disable jsx-a11y/aria-props */
// EnhancedSidebar - 非開発者向けに改善されたサイドバーコンポーネント

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from '../common/Tooltip';
import './Sidebar.css';
import './EnhancedSidebar.css';

/**
 * サイドバーコンポーネントのプロパティ
 */
export interface EnhancedSidebarProps {
  /** 折りたたみ状態 */
  defaultCollapsed?: boolean;
  /** カスタムクラス名 */
  className?: string;
  /** 折りたたみ状態変更コールバック */
  onCollapseChange?: (collapsed: boolean) => void;
}

/**
 * ナビゲーションアイテムの型定義（階層対応）
 */
interface NavItem {
  path: string;
  label: string;
  icon: string;
  description?: string; // 非開発者向けの説明
  badge?: number;
  children?: NavItem[]; // サブメニュー
  category?: string; // カテゴリ（「基本機能」「設定」「高度な機能」など）
}

/**
 * 改善されたサイドバーコンポーネント
 * 非開発者向けにわかりやすいナビゲーションを提供
 */
export const EnhancedSidebar: React.FC<EnhancedSidebarProps> = ({
  defaultCollapsed = false,
  className = '',
  onCollapseChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['基本機能'])
  );

  // defaultCollapsed の変更を内部状態に反映
  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  // 折りたたみ状態を切り替える
  const toggleCollapse = useCallback(() => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  }, [collapsed, onCollapseChange]);

  // カテゴリの展開/折りたたみを切り替える
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  // パスがアクティブかどうかを判定
  const isActive = useCallback(
    (path: string): boolean => {
      return (
        location.pathname === path || location.pathname.startsWith(`${path}/`)
      );
    },
    [location.pathname]
  );

  // ナビゲーションアイテム（非開発者向けに分類）
  const navItems: NavItem[] = useMemo(
    () => [
      // 基本機能
      {
        path: '/',
        label: 'ホーム',
        icon: '',
        description: 'アプリケーションのホーム画面',
        category: '基本機能',
      },
      {
        path: '/api/list',
        label: 'API一覧',
        icon: '',
        description: '作成したAPIの一覧を表示・管理',
        category: '基本機能',
      },
      {
        path: '/api/keys',
        label: 'APIキー',
        icon: '',
        description: 'APIキーの作成・管理',
        category: '基本機能',
      },
      {
        path: '/api/create',
        label: 'APIを作成',
        icon: '',
        description: '新しいAPIを作成',
        category: '基本機能',
      },
      {
        path: '/api/test',
        label: 'LLMテスト',
        icon: '',
        description: '作成したAPIでLLMモデルをテスト',
        category: '基本機能',
      },
      {
        path: '/models',
        label: 'モデル管理',
        icon: '',
        description: 'AIモデルの検索・ダウンロード・管理',
        category: '基本機能',
      },

      // 利用・監視
      {
        path: '/logs',
        label: 'ログ',
        icon: '',
        description: 'APIの使用履歴を確認',
        category: '利用・監視',
      },
      {
        path: '/performance',
        label: 'パフォーマンス',
        icon: '',
        description: 'APIのパフォーマンスを監視',
        category: '利用・監視',
      },
      {
        path: '/alerts/history',
        label: 'アラート履歴',
        icon: '',
        description: 'アラートの履歴を確認',
        category: '利用・監視',
      },

      // 設定
      {
        path: '/settings',
        label: '基本設定',
        icon: '',
        description: 'アプリケーションの基本設定',
        category: '設定',
        children: [
          {
            path: '/settings',
            label: '一般設定',
            icon: '',
            description: 'テーマ、言語などの基本設定',
          },
          {
            path: '/backup',
            label: 'バックアップ',
            icon: '',
            description: '設定のバックアップ・復元',
          },
          {
            path: '/scheduler',
            label: 'スケジューラー',
            icon: '',
            description: '自動実行タスクの設定',
          },
        ],
      },
      {
        path: '/certificates',
        label: '証明書管理',
        icon: '',
        description: 'SSL証明書の管理',
        category: '設定',
      },
      {
        path: '/alerts/settings',
        label: 'アラート設定',
        icon: '',
        description: 'アラートの設定',
        category: '設定',
      },

      // 高度な機能（折りたたみ可能）
      {
        path: '/plugins',
        label: 'プラグイン',
        icon: '',
        description: 'プラグインの管理',
        category: '高度な機能',
      },
      {
        path: '/engines',
        label: 'エンジン管理',
        icon: '',
        description: 'LLMエンジンの管理',
        category: '高度な機能',
      },
      {
        path: '/oauth',
        label: 'OAuth認証',
        icon: '',
        description: 'OAuth認証の設定',
        category: '高度な機能',
      },
      {
        path: '/audit-logs',
        label: '監査ログ',
        icon: '',
        description: 'システムの監査ログ',
        category: '高度な機能',
      },

      // ヘルプ
      {
        path: '/help',
        label: 'ヘルプ',
        icon: '',
        description: '使い方やFAQ',
        category: 'ヘルプ',
      },
      {
        path: '/about',
        label: 'このアプリについて',
        icon: '',
        description: 'アプリケーションの情報',
        category: 'ヘルプ',
      },
    ],
    []
  );

  // カテゴリごとにグループ化
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: NavItem[] } = {};
    navItems.forEach(item => {
      const category = item.category || 'その他';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });
    return groups;
  }, [navItems]);

  // ナビゲーションハンドラ（ホーム中心のナビゲーション）
  // すべての機能はホーム画面から選択するため、すべての項目をクリックした場合はホームに遷移
  const handleNavigation = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // className を安全に結合
  const sidebarClassName = useMemo(() => {
    const classes = ['app-sidebar', 'enhanced-sidebar'];
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
          <Tooltip
            content={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
            position="right"
          >
            <button
              className="sidebar-toggle"
              onClick={toggleCollapse}
              aria-label={
                collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'
              }
              aria-expanded={!collapsed}
            >
              {collapsed ? '▶' : '◀'}
            </button>
          </Tooltip>
          {!collapsed && <h2 className="sidebar-title">メニュー</h2>}
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="sidebar-nav" aria-label="サイドナビゲーション">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="sidebar-category">
              {!collapsed && (
                <button
                  className="sidebar-category-header"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={expandedCategories.has(category)}
                >
                  <span className="sidebar-category-title">{category}</span>
                  <span className="sidebar-category-toggle">
                    {expandedCategories.has(category) ? '▼' : '▶'}
                  </span>
                </button>
              )}
              {(!collapsed && expandedCategories.has(category)) || collapsed ? (
                <ul className="sidebar-nav-list">
                  {items.map(item => {
                    const active = isActive(item.path);
                    return (
                      <li key={item.path} className="sidebar-nav-item">
                        <Tooltip
                          content={
                            collapsed
                              ? item.label
                              : item.description || item.label
                          }
                          position="right"
                          disabled={!collapsed}
                        >
                          <button
                            className={`sidebar-nav-link ${active ? 'active' : ''}`}
                            onClick={() => handleNavigation()}
                            aria-label={item.label}
                            aria-current={active ? 'page' : undefined}
                          >
                            <span className="sidebar-nav-icon">
                              {item.icon}
                            </span>
                            {!collapsed && (
                              <>
                                <span className="sidebar-nav-label">
                                  {item.label}
                                </span>
                                {item.badge !== undefined && item.badge > 0 && (
                                  <span className="sidebar-nav-badge">
                                    {item.badge}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        </Tooltip>
                        {/* サブメニュー */}
                        {!collapsed && item.children && active && (
                          <ul className="sidebar-sub-nav-list">
                            {item.children.map(child => (
                              <li
                                key={child.path}
                                className="sidebar-sub-nav-item"
                              >
                                <button
                                  className={`sidebar-sub-nav-link ${isActive(child.path) ? 'active' : ''}`}
                                  onClick={() => handleNavigation()}
                                  aria-label={child.label}
                                >
                                  <span className="sidebar-sub-nav-icon">
                                    {child.icon}
                                  </span>
                                  <span className="sidebar-sub-nav-label">
                                    {child.label}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};
