// Breadcrumb - パンくずリストコンポーネント

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Breadcrumb.css';

/**
 * パンくず項目の型定義
 */
export interface BreadcrumbItem {
  /** ラベル */
  label: string;
  /** パス（最後の項目は通常空文字列） */
  path?: string;
  /** カスタムクリックハンドラ */
  onClick?: () => void;
}

/**
 * パンくずリストコンポーネントのプロパティ
 */
export interface BreadcrumbProps {
  /** パンくず項目のリスト */
  items: BreadcrumbItem[];
  /** カスタムクラス名 */
  className?: string;
  /** 区切り文字（デフォルト: /） */
  separator?: string;
}

/**
 * パンくずリストコンポーネント
 * 現在のページ位置を階層的に表示します
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  className = '',
  separator = '/',
}) => {
  const navigate = useNavigate();

  // 最後の項目かどうかを判定
  const isLastItem = (index: number) => index === items.length - 1;

  // 項目をクリックしたときの処理
  const handleItemClick = (item: BreadcrumbItem, index: number) => {
    if (isLastItem(index)) return; // 最後の項目はクリック不可

    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  // classNameを安全に結合
  const breadcrumbClassName = React.useMemo(() => {
    const classes = ['breadcrumb'];
    if (className.trim()) {
      classes.push(className.trim());
    }
    return classes.join(' ');
  }, [className]);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      className={breadcrumbClassName}
      aria-label="パンくずリスト"
      role="navigation"
    >
      <ol className="breadcrumb-list" itemScope itemType="https://schema.org/BreadcrumbList">
        {items.map((item, index) => {
          const isLast = isLastItem(index);
          // useMemoはループ内で使用できないため、通常の変数として計算
          const classes = ['breadcrumb-item'];
          if (isLast) {
            classes.push('breadcrumb-item-current');
          }
          const itemClassName = classes.join(' ');

          return (
            <li
              key={index}
              className={itemClassName}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {isLast ? (
                <span
                  className="breadcrumb-link breadcrumb-link-current"
                  aria-current="page"
                  itemProp="name"
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="breadcrumb-link"
                  onClick={() => handleItemClick(item, index)}
                  aria-label={`${item.label}に移動`}
                  itemProp="name"
                >
                  {item.label}
                </button>
              )}
              <meta itemProp="position" content={String(index + 1)} />
              {!isLast && (
                <span
                  className="breadcrumb-separator"
                  aria-hidden="true"
                >
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

