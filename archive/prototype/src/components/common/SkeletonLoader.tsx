// SkeletonLoader - スケルトンローディングコンポーネント

import React from 'react';
import './SkeletonLoader.css';

/**
 * スケルトンローディングの種類
 */
export type SkeletonType =
  | 'text'
  | 'title'
  | 'paragraph'
  | 'avatar'
  | 'button'
  | 'card'
  | 'table'
  | 'list'
  | 'api-list'
  | 'form'
  | 'custom';

/**
 * スケルトンローディングコンポーネントのプロパティ
 */
export interface SkeletonLoaderProps {
  /** スケルトンの種類 */
  type?: SkeletonType;
  /** カスタムクラス名 */
  className?: string;
  /** 繰り返し回数（list、table、paragraphなどで使用） */
  count?: number;
  /** 幅（カスタムタイプで使用） */
  width?: string | number;
  /** 高さ（カスタムタイプで使用） */
  height?: string | number;
  /** 丸み（avatarなどで使用） */
  rounded?: boolean;
  /** アニメーションを無効化 */
  noAnimation?: boolean;
}

/**
 * スケルトンローディングコンポーネント
 * データ読み込み中にコンテンツの構造を表示します
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'text',
  className = '',
  count = 1,
  width,
  height,
  rounded = false,
  noAnimation = false,
}) => {
  // classNameを安全に結合
  const skeletonClassName = React.useMemo(() => {
    const classes = ['skeleton', `skeleton-${type}`];
    if (rounded) {
      classes.push('skeleton-rounded');
    }
    if (noAnimation) {
      classes.push('skeleton-no-animation');
    }
    if (className.trim()) {
      classes.push(className.trim());
    }
    return classes.join(' ');
  }, [type, rounded, noAnimation, className]);

  // カスタムスタイル（CSS変数を使用してCSPに準拠）
  const customStyleRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (customStyleRef.current) {
      if (width) {
        const widthValue = typeof width === 'number' ? `${width}px` : width;
        customStyleRef.current.style.setProperty(
          '--skeleton-width',
          widthValue
        );
      }
      if (height) {
        const heightValue = typeof height === 'number' ? `${height}px` : height;
        customStyleRef.current.style.setProperty(
          '--skeleton-height',
          heightValue
        );
      }
    }
  }, [width, height]);

  // テキストスケルトン
  const renderText = () => (
    <div className={skeletonClassName} ref={customStyleRef} aria-hidden="true">
      <span className="skeleton-shimmer"></span>
    </div>
  );

  // タイトルスケルトン
  const renderTitle = () => (
    <div className={skeletonClassName} ref={customStyleRef} aria-hidden="true">
      <span className="skeleton-shimmer"></span>
    </div>
  );

  // 段落スケルトン
  const renderParagraph = () => (
    <div className="skeleton-paragraph-container" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={skeletonClassName}
          ref={index === 0 ? customStyleRef : undefined}
        >
          <span className="skeleton-shimmer"></span>
        </div>
      ))}
    </div>
  );

  // アバタースケルトン
  const renderAvatar = () => (
    <div className={skeletonClassName} ref={customStyleRef} aria-hidden="true">
      <span className="skeleton-shimmer"></span>
    </div>
  );

  // ボタンスケルトン
  const renderButton = () => (
    <div className={skeletonClassName} ref={customStyleRef} aria-hidden="true">
      <span className="skeleton-shimmer"></span>
    </div>
  );

  // カードスケルトン
  const renderCard = () => (
    <div className={skeletonClassName} ref={customStyleRef} aria-hidden="true">
      <div className="skeleton-card-header">
        <span className="skeleton-shimmer"></span>
      </div>
      <div className="skeleton-card-content">
        <span className="skeleton-shimmer"></span>
        <span className="skeleton-shimmer"></span>
        <span className="skeleton-shimmer"></span>
      </div>
      <div className="skeleton-card-footer">
        <span className="skeleton-shimmer"></span>
      </div>
    </div>
  );

  // テーブルスケルトン
  const renderTable = () => (
    <div className="skeleton-table-container" aria-hidden="true">
      <div className="skeleton-table-header">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton-table-header-cell">
            <span className="skeleton-shimmer"></span>
          </div>
        ))}
      </div>
      {Array.from({ length: count }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: 4 }).map((_, cellIndex) => (
            <div key={cellIndex} className="skeleton-table-cell">
              <span className="skeleton-shimmer"></span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // リストスケルトン
  const renderList = () => (
    <div className="skeleton-list-container" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-list-item">
          <div className="skeleton-list-item-avatar">
            <span className="skeleton-shimmer"></span>
          </div>
          <div className="skeleton-list-item-content">
            <div className="skeleton-list-item-title">
              <span className="skeleton-shimmer"></span>
            </div>
            <div className="skeleton-list-item-text">
              <span className="skeleton-shimmer"></span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // APIリストスケルトン
  const renderApiList = () => (
    <div className="skeleton-api-list-container" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-api-card">
          <div className="skeleton-api-card-header">
            <div className="skeleton-api-card-title">
              <span className="skeleton-shimmer"></span>
            </div>
            <div className="skeleton-api-card-status">
              <span className="skeleton-shimmer"></span>
            </div>
          </div>
          <div className="skeleton-api-card-content">
            <div className="skeleton-api-card-row">
              <span className="skeleton-shimmer"></span>
            </div>
            <div className="skeleton-api-card-row">
              <span className="skeleton-shimmer"></span>
            </div>
            <div className="skeleton-api-card-row">
              <span className="skeleton-shimmer"></span>
            </div>
          </div>
          <div className="skeleton-api-card-actions">
            <span className="skeleton-shimmer"></span>
            <span className="skeleton-shimmer"></span>
            <span className="skeleton-shimmer"></span>
          </div>
        </div>
      ))}
    </div>
  );

  // フォームスケルトン
  const renderForm = () => (
    <div className="skeleton-form-container" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-form-field">
          <div className="skeleton-form-label">
            <span className="skeleton-shimmer"></span>
          </div>
          <div className="skeleton-form-input">
            <span className="skeleton-shimmer"></span>
          </div>
        </div>
      ))}
    </div>
  );

  // カスタムスケルトン
  const renderCustom = () => (
    <div className={skeletonClassName} ref={customStyleRef} aria-hidden="true">
      <span className="skeleton-shimmer"></span>
    </div>
  );

  // 種類に応じたレンダリング
  switch (type) {
    case 'text':
      return renderText();
    case 'title':
      return renderTitle();
    case 'paragraph':
      return renderParagraph();
    case 'avatar':
      return renderAvatar();
    case 'button':
      return renderButton();
    case 'card':
      return renderCard();
    case 'table':
      return renderTable();
    case 'list':
      return renderList();
    case 'api-list':
      return renderApiList();
    case 'form':
      return renderForm();
    case 'custom':
      return renderCustom();
    default:
      return renderText();
  }
};
