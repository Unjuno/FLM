// AppLayout - アプリケーションレイアウトコンポーネント

import React, { useState } from 'react';
import { Header, HeaderProps } from './Header';
import { Sidebar, SidebarProps } from './Sidebar';
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
  /** サイドバーを表示するか */
  showSidebar?: boolean;
  /** ヘッダーのプロパティ */
  headerProps?: HeaderProps;
  /** サイドバーのプロパティ */
  sidebarProps?: SidebarProps;
  /** フッターのプロパティ */
  footerProps?: FooterProps;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * アプリケーションレイアウトコンポーネント
 * ヘッダー、サイドバー、メインコンテンツ、フッターを統合した共通レイアウト
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  layoutType = 'default',
  showSidebar = false,
  headerProps,
  sidebarProps,
  footerProps,
  className = '',
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(sidebarProps?.defaultCollapsed || false);

  const handleSidebarCollapseChange = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    if (sidebarProps?.onCollapseChange) {
      sidebarProps.onCollapseChange(collapsed);
    }
  };

  if (layoutType === 'minimal') {
    return (
      <div className={`app-layout minimal ${className}`}>
        <main className="main-content minimal-content">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={`app-layout ${layoutType} ${showSidebar ? 'with-sidebar' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${className}`}>
      <Header {...headerProps} />
      
      <div className="layout-body">
        {showSidebar && (
          <Sidebar
            {...sidebarProps}
            defaultCollapsed={sidebarCollapsed}
            onCollapseChange={handleSidebarCollapseChange}
          />
        )}
        
        <main className={`main-content ${showSidebar ? 'with-sidebar' : ''}`}>
          {children}
        </main>
      </div>
      
      <Footer {...footerProps} />
    </div>
  );
};

