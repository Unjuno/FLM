// NavItem - ナビゲーションアイテムコンポーネント

import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from '../common/Tooltip';
import './NavItem.css';

/**
 * ナビゲーションアイテムのプロパティ
 */
export interface NavItemProps {
  /** パス */
  path: string;
  /** ラベル */
  label: string;
  /** アイコン（絵文字または文字） */
  icon?: string;
  /** バッジ（通知数など） */
  badge?: number;
  /** アクティブかどうか（指定しない場合は現在のパスと自動判定） */
  active?: boolean;
  /** クリック時のコールバック */
  onClick?: () => void;
  /** 無効状態 */
  disabled?: boolean;
  /** カスタムクラス名 */
  className?: string;
  /** 子要素（ネストされたメニュー） */
  children?: React.ReactNode;
  /** ツールチップを表示するか */
  showTooltip?: boolean;
}

/**
 * ナビゲーションアイテムコンポーネント
 * 統一されたナビゲーションアイテム
 */
export const NavItem: React.FC<NavItemProps> = ({
  path,
  label,
  icon,
  badge,
  active: activeProp,
  onClick,
  disabled = false,
  className = '',
  children,
  showTooltip = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // 現在のパス名をメモ化（再レンダリング時のパフォーマンス改善）
  const currentPath = useMemo(() => location.pathname, [location.pathname]);

  // アクティブ状態を判定（useMemoでメモ化）
  const isActive = useMemo(() => {
    if (activeProp !== undefined) {
      return activeProp;
    }
    return currentPath === path;
  }, [activeProp, currentPath, path]);

  // クリックハンドラ
  const handleClick = useCallback(() => {
    if (disabled) return;

    if (onClick) {
      onClick();
    } else {
      navigate(path);
    }
  }, [disabled, onClick, navigate, path]);

  // キーボードナビゲーションハンドラ
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [disabled, handleClick]
  );

  // className を安全に結合
  const itemClassName = useMemo(() => {
    const classes: string[] = ['nav-item'];
    if (isActive) classes.push('active');
    if (disabled) classes.push('disabled');
    const trimmedClassName = className.trim();
    if (trimmedClassName) classes.push(trimmedClassName);
    return classes.join(' ');
  }, [isActive, disabled, className]);

  const buttonContent = (
    <button
      className={itemClassName}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && <span className="nav-item-icon">{icon}</span>}
      <span className="nav-item-label">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="nav-item-badge" aria-label={`${badge}件の通知`}>
          {badge}
        </span>
      )}
    </button>
  );

  const content = (
    <>
      {buttonContent}
      {children && <div className="nav-item-children">{children}</div>}
    </>
  );

  return (
    <li className="nav-item-wrapper">
      {showTooltip ? (
        <Tooltip content={label} position="right" disabled={disabled}>
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </li>
  );
};
