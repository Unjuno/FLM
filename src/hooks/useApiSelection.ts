// useApiSelection - API選択状態管理用カスタムフック

import { useState, useCallback } from 'react';

/**
 * API選択状態管理用カスタムフック
 * 
 * @returns 選択状態と操作関数
 */
export const useApiSelection = () => {
  const [selectedApiIds, setSelectedApiIds] = useState<Set<string>>(new Set());

  /**
   * API選択のトグル
   */
  const toggleSelection = useCallback((apiId: string) => {
    setSelectedApiIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiId)) {
        newSet.delete(apiId);
      } else {
        newSet.add(apiId);
      }
      return newSet;
    });
  }, []);

  /**
   * 全選択/全解除
   */
  const selectAll = useCallback((allApiIds: string[]) => {
    setSelectedApiIds(prev => {
      if (prev.size === allApiIds.length && allApiIds.length > 0) {
        return new Set();
      } else {
        return new Set(allApiIds);
      }
    });
  }, []);

  /**
   * 選択をクリア
   */
  const clearSelection = useCallback(() => {
    setSelectedApiIds(new Set());
  }, []);

  /**
   * 選択されたAPI IDの配列を取得
   */
  const getSelectedIds = useCallback((): string[] => {
    return Array.from(selectedApiIds);
  }, [selectedApiIds]);

  /**
   * 全選択状態かどうかを判定
   */
  const isAllSelected = useCallback((totalCount: number): boolean => {
    return selectedApiIds.size === totalCount && totalCount > 0;
  }, [selectedApiIds]);

  /**
   * 選択数を取得
   */
  const selectedCount = selectedApiIds.size;

  return {
    selectedApiIds,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
    getSelectedIds,
    isAllSelected,
  };
};

