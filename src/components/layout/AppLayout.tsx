// AppLayout - アプリケーションレイアウトコンポーネント

import React from 'react';
import { Sidebar } from './Sidebar';
import './AppLayout.css';

/**
 * アプリケーションレイアウトコンポーネントのプロパティ
 */
export interface AppLayoutProps {
  /** 子要素 */
  children: React.ReactNode;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * アプリケーションレイアウトコンポーネント
 * サイドバーとメインコンテンツエリアを含む共通レイアウト
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`app-layout ${className}`}>
      <Sidebar />
      <div className="layout-body">
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
};
