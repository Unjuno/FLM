// ApiListLoading - API一覧ページのローディング状態コンポーネント

import React from 'react';
import { AppLayout } from '../layout/AppLayout';
import { Breadcrumb, BreadcrumbItem } from '../common/Breadcrumb';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { ApiListHeader } from './ApiListHeader';

/**
 * API一覧ページのローディング状態コンポーネントのプロパティ
 */
interface ApiListLoadingProps {
  breadcrumbItems: BreadcrumbItem[];
  onRefresh: () => void;
}

/**
 * API一覧ページのローディング状態コンポーネント
 */
export const ApiListLoading: React.FC<ApiListLoadingProps> = ({
  breadcrumbItems,
  onRefresh,
}) => {
  return (
    <AppLayout>
      <div className="api-list-page">
        <div className="page-container api-list-container">
          <Breadcrumb items={breadcrumbItems} />
          <ApiListHeader onRefresh={onRefresh} />
          <div className="api-list-content">
            <SkeletonLoader type="api-list" count={3} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

