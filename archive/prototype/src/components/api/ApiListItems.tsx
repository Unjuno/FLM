// ApiListItems - API一覧の仮想スクロール表示コンポーネント

import React, { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ApiListControls } from './ApiListControls';
import { ApiCard } from './ApiCard';
import type { ApiInfoExtended } from '../../hooks/useApiList';
import type { ApiOperationProgress } from '../../hooks/useApiOperations';

interface ApiListItemsProps {
  apis: ApiInfoExtended[];
  selectedApiIds: Set<string>;
  operatingApiIds: Set<string>;
  apiOperationProgress: Map<string, ApiOperationProgress>;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onToggleSelection: (apiId: string) => void;
  onToggleStatus: (
    apiId: string,
    currentStatus: ApiInfoExtended['status']
  ) => Promise<void> | void;
  onDelete: (apiId: string, apiName: string, modelName?: string) => void;
  getStatusText: (status: ApiInfoExtended['status']) => string;
}

/**
 * API一覧を仮想スクロールで表示するコンポーネント（内部実装）
 */
const ApiListItemsComponent: React.FC<ApiListItemsProps> = ({
  apis,
  selectedApiIds,
  operatingApiIds,
  apiOperationProgress,
  isAllSelected,
  onSelectAll,
  onToggleSelection,
  onToggleStatus,
  onDelete,
  getStatusText,
}) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const shouldUseVirtualScroll = useMemo(
    () => apis.length >= 100,
    [apis.length]
  );

  const rowVirtualizer = useVirtualizer({
    count: apis.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 3,
    enabled: shouldUseVirtualScroll,
  });

  // 仮想スクロール用のスタイル設定（メモ化）
  const containerStyle = useMemo(
    () =>
      ({
        '--virtual-height': shouldUseVirtualScroll ? '600px' : 'auto',
        '--virtual-overflow': shouldUseVirtualScroll ? 'auto' : 'visible',
      }) as React.CSSProperties,
    [shouldUseVirtualScroll]
  );

  // 仮想スクロールアイテムのスタイル設定関数（メモ化）
  const getVirtualItemStyle = useCallback(
    (start: number) =>
      ({
        '--virtual-top': '0',
        '--virtual-left': '0',
        '--virtual-width': '100%',
        '--virtual-transform': `translateY(${start}px)`,
      }) as React.CSSProperties,
    []
  );

  // 親要素のref設定（メモ化）
  const setParentRef = useCallback(
    (el: HTMLDivElement | null) => {
      parentRef.current = el;
      if (el) {
        Object.entries(containerStyle).forEach(([key, value]) => {
          el.style.setProperty(key, String(value));
        });
      }
    },
    [containerStyle]
  );

  return (
    <div
      className="api-list virtual-scroll-container"
      ref={setParentRef}
      data-selected-count={selectedApiIds.size}
      data-operating-count={operatingApiIds.size}
      data-progress-count={apiOperationProgress.size}
    >
      <ApiListControls
        selectedCount={selectedApiIds.size}
        totalCount={apis.length}
        isAllSelected={isAllSelected}
        onSelectAll={onSelectAll}
      />
      <div
        ref={el => {
          if (el && shouldUseVirtualScroll) {
            el.style.setProperty(
              '--virtual-height',
              `${rowVirtualizer.getTotalSize()}px`
            );
            el.style.setProperty('--virtual-position', 'relative');
          }
        }}
        className={shouldUseVirtualScroll ? 'virtual-scroll-container' : ''}
      >
        {shouldUseVirtualScroll
          ? rowVirtualizer.getVirtualItems().map(virtualRow => {
              const api = apis[virtualRow.index];
              const itemStyle = getVirtualItemStyle(virtualRow.start);
              return (
                <div
                  key={api.id}
                  className="virtual-scroll-item"
                  style={itemStyle}
                >
                  <ApiCard
                    api={api}
                    isSelected={selectedApiIds.has(api.id)}
                    isOperating={operatingApiIds.has(api.id)}
                    progress={apiOperationProgress.get(api.id)}
                    onToggleSelection={onToggleSelection}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                    getStatusText={getStatusText}
                  />
                </div>
              );
            })
          : apis.map(api => (
              <ApiCard
                key={api.id}
                api={api}
                isSelected={selectedApiIds.has(api.id)}
                isOperating={operatingApiIds.has(api.id)}
                progress={apiOperationProgress.get(api.id)}
                onToggleSelection={onToggleSelection}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
                getStatusText={getStatusText}
              />
            ))}
      </div>
    </div>
  );
};

/**
 * ApiListItemsをメモ化してパフォーマンスを最適化
 * apis, selectedApiIds, operatingApiIds, apiOperationProgressが変更された場合のみ再レンダリング
 */
export const ApiListItems = React.memo(
  ApiListItemsComponent,
  (prevProps, nextProps) => {
    // apisの長さとIDが同じかチェック
    if (prevProps.apis.length !== nextProps.apis.length) {
      return false;
    }

    const apisChanged = prevProps.apis.some(
      (api, index) =>
        api.id !== nextProps.apis[index]?.id ||
        api.status !== nextProps.apis[index]?.status
    );

    if (apisChanged) {
      return false;
    }

    // 選択状態の変更をチェック
    if (prevProps.selectedApiIds.size !== nextProps.selectedApiIds.size) {
      return false;
    }

    // 操作中のAPIの変更をチェック
    if (prevProps.operatingApiIds.size !== nextProps.operatingApiIds.size) {
      return false;
    }

    // 進捗情報の変更をチェック
    if (
      prevProps.apiOperationProgress.size !==
      nextProps.apiOperationProgress.size
    ) {
      return false;
    }

    // 全選択状態の変更をチェック
    if (prevProps.isAllSelected !== nextProps.isAllSelected) {
      return false;
    }

    return true;
  }
);
