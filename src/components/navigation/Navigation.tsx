// FLM - ナビゲーションコンポーネント
// フロントエンドエージェント (FE) 実装
// FE-017-02: ナビゲーションコンポーネント実装

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { NavItem, NavItemProps } from './NavItem';
import './Navigation.css';

/**
 * ナビゲーション項目の型定義
 */
export interface NavigationItem extends Omit<NavItemProps, 'active' | 'children'> {
  /** 子項目（ネストされたメニュー） */
  children?: NavigationItem[];
}

/**
 * ナビゲーションコンポーネントのプロパティ
 */
export interface NavigationProps {
  /** ナビゲーション項目のリスト */
  items: NavigationItem[];
  /** 方向（horizontal または vertical） */
  orientation?: 'horizontal' | 'vertical';
  /** モバイルメニューを表示するか */
  showMobileMenu?: boolean;
  /** カスタムクラス名 */
  className?: string;
  /** アクティブなパス（指定しない場合は現在のパスと自動判定） */
  activePath?: string;
}

/**
 * ナビゲーションコンポーネント
 * 統一されたナビゲーションメニュー
 */
export const Navigation: React.FC<NavigationProps> = ({
  items,
  orientation = 'horizontal',
  showMobileMenu = false,
  className = '',
  activePath,
}) => {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // アクティブなパスを決定（指定されていない場合は現在のパスを使用）
  const currentActivePath = useMemo(() => {
    return activePath ?? location.pathname;
  }, [activePath, location.pathname]);

  // 項目を展開/折りたたみ
  const toggleExpanded = useCallback((path: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // モバイルメニューのトグル
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  // キーボードナビゲーション（矢印キー）
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (!navRef.current) return;

    const items = navRef.current.querySelectorAll<HTMLLIElement>('.nav-item-wrapper');
    const itemCount = items.length;
    if (itemCount === 0) return;

    // 現在フォーカスされているアイテムのインデックスを取得
    const getFocusedIndex = (): number => {
      return Array.from(items).findIndex((item) => 
        item.querySelector('button') === document.activeElement
      );
    };

    // 次のアイテムにフォーカスを移動
    const focusItem = (index: number): void => {
      items[index]?.querySelector('button')?.focus();
    };

    // 次のアイテムに移動（前/後）
    const moveToNext = (direction: 1 | -1): void => {
      e.preventDefault();
      const focused = getFocusedIndex();
      const next = direction === 1
        ? (focused === -1 ? 0 : Math.min(focused + 1, itemCount - 1))
        : (focused === -1 ? itemCount - 1 : Math.max(focused - 1, 0));
      focusItem(next);
    };

    switch (e.key) {
      case 'ArrowDown':
        moveToNext(1);
        break;
      case 'ArrowUp':
        moveToNext(-1);
        break;
      case 'ArrowRight':
        if (orientation === 'horizontal') {
          moveToNext(1);
        }
        break;
      case 'ArrowLeft':
        if (orientation === 'horizontal') {
          moveToNext(-1);
        }
        break;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        focusItem(itemCount - 1);
        break;
      case 'Escape':
        e.preventDefault();
        setMobileMenuOpen(false);
        navRef.current?.querySelector('button')?.blur();
        break;
    }
  }, [orientation]);

  // ナビゲーション項目をレンダリング（再帰的）
  const renderNavItems = useCallback((navItems: NavigationItem[], level: number = 0): React.ReactNode => {
    return (
      <>
        {navItems.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const isExpanded = expandedItems.has(item.path);
          const isActive = currentActivePath === item.path;

          // クリックハンドラを最適化
          const handleItemClick = () => {
            if (hasChildren) {
              toggleExpanded(item.path);
            }
            item.onClick?.();
          };

          return (
            <NavItem
              key={item.path}
              {...item}
              active={isActive}
              onClick={handleItemClick}
            >
              {hasChildren && isExpanded && (
                <ul className={`nav-submenu level-${level}`} role="menu">
                  {renderNavItems(item.children || [], level + 1)}
                </ul>
              )}
            </NavItem>
          );
        })}
      </>
    );
  }, [expandedItems, currentActivePath, toggleExpanded]);

  // className を安全に結合
  const navClassName = useMemo(() => {
    const classes: string[] = ['navigation', `navigation-${orientation}`];
    if (mobileMenuOpen) classes.push('mobile-menu-open');
    const trimmedClassName = className.trim();
    if (trimmedClassName) classes.push(trimmedClassName);
    return classes.join(' ');
  }, [orientation, mobileMenuOpen, className]);

  // モバイルメニューボタン（useMemoで最適化）
  const mobileMenuButton = useMemo(() => {
    if (!showMobileMenu) return null;

    return (
      <button
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label={mobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
        {...(mobileMenuOpen && { 'aria-expanded': true })}
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
    );
  }, [showMobileMenu, mobileMenuOpen, toggleMobileMenu]);

  // モバイルメニューのオーバーレイ（useMemoで最適化）
  const mobileOverlay = useMemo(() => {
    if (!mobileMenuOpen) return null;

    return (
      <div
        className="mobile-menu-overlay"
        onClick={toggleMobileMenu}
        aria-hidden="true"
      />
    );
  }, [mobileMenuOpen, toggleMobileMenu]);

  return (
    <>
      {mobileMenuButton}
      {mobileOverlay}
      <nav
        ref={navRef}
        className={navClassName}
        role="navigation"
        aria-label="メインナビゲーション"
        onKeyDown={handleKeyDown}
      >
        <ul 
          className="nav-list" 
          role="menubar"
          {...(orientation && { 'aria-orientation': orientation })}
        >
          {renderNavItems(items)}
        </ul>
      </nav>
    </>
  );
};

