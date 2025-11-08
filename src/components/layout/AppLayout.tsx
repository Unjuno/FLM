// AppLayout - アプリケーションレイアウトコンポーネント

import React from 'react';
import { Header, HeaderProps } from './Header';
import { Footer, FooterProps } from './Footer';
import './AppLayout.css';

/**
 * レイアウトタイプ
 */
export type LayoutType = 'default' | 'sidebar' | 'minimal';

/**
 * アプリケーションレイアウトコンポーネントのプロパティ
 */
export interface AppLayoutProps {
  /** 子要素 */
  children: React.ReactNode;
  /** レイアウトタイプ */
  layoutType?: LayoutType;
  /** ヘッダーのプロパティ */
  headerProps?: HeaderProps;
  /** フッターのプロパティ */
  footerProps?: FooterProps;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * アプリケーションレイアウトコンポーネント
 * ヘッダー、メインコンテンツ、フッターを統合した共通レイアウト
 * すべての機能はホーム画面からアクセスします
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  layoutType = 'default',
  headerProps,
  footerProps,
  className = '',
}) => {
  if (layoutType === 'minimal') {
    return (
      <div className={`app-layout minimal ${className}`}>
        <main className="main-content minimal-content">{children}</main>
      </div>
    );
  }

  // デフォルトのヘッダープロパティ（ロゴを含む）
  const defaultHeaderProps: HeaderProps = {
    logoUrl: '/logo.png',
    appName: 'FLM',
    ...headerProps,
  };

  return (
    <div className={`app-layout ${layoutType} ${className}`}>
      <Header {...defaultHeaderProps} />

      <div className="layout-body">
        <main className="main-content">{children}</main>
      </div>

      <Footer {...footerProps} />
    </div>
  );
};
