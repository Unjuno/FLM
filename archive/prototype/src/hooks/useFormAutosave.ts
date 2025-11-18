// useFormAutosave - フォームオートセーブ用カスタムフック

import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { isDev } from '../utils/env';

/**
 * オートセーブ設定
 */
export interface AutosaveConfig<T> {
  /** 保存するデータ */
  data: T;
  /** 保存キーの識別子 */
  key: string;
  /** デバウンス時間（ミリ秒） */
  delay?: number;
  /** データが有効かどうかを判定する関数 */
  isValid?: (data: T) => boolean;
  /** 追加のメタデータ（復元時に使用） */
  metadata?: Record<string, unknown>;
}

/**
 * オートセーブから復元したデータ
 */
export interface AutosaveData<T> {
  data: T;
  timestamp: string;
  modelName?: string;
}

/**
 * フォームオートセーブ用カスタムフック
 * 
 * @param config - オートセーブ設定
 */
export const useFormAutosave = <T,>(config: AutosaveConfig<T>): {
  /** 保存されたデータを復元 */
  restore: () => T | null;
  /** 保存されたデータをクリア */
  clear: () => void;
} => {
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const defaultDelay = config.delay || 2000; // デフォルト2秒

  // オートセーブ機能: データが変更されたときにlocalStorageに保存
  useEffect(() => {
    // データが有効かチェック
    if (config.isValid && !config.isValid(config.data)) {
      return;
    }

    // 既存のタイマーをクリア
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    // デバウンス処理: 指定時間後に保存
    autosaveTimeoutRef.current = setTimeout(() => {
      try {
        const autosaveKey = `form_autosave_${config.key}`;
        const autosaveData: AutosaveData<T> = {
          data: config.data,
          timestamp: new Date().toISOString(),
          ...config.metadata,
        };
        localStorage.setItem(autosaveKey, JSON.stringify(autosaveData));
        if (isDev()) {
          logger.debug('フォーム設定を自動保存しました', 'useFormAutosave');
        }
      } catch (err) {
        // localStorageのエラーは無視（プライベートモードなど）
        logger.warn('オートセーブに失敗しました', 'useFormAutosave', err);
      }
    }, defaultDelay);

    // クリーンアップ
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [config.data, config.key, config.isValid, defaultDelay]);

  // 保存されたデータを復元
  const restore = (): T | null => {
    try {
      const autosaveKey = `form_autosave_${config.key}`;
      const savedData = localStorage.getItem(autosaveKey);
      if (savedData) {
        const parsed = JSON.parse(savedData) as AutosaveData<T>;
        // 24時間以内の保存データのみ復元
        const savedTime = new Date(parsed.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24 && parsed.data) {
          if (isDev()) {
            logger.debug('フォーム設定を自動復元しました', 'useFormAutosave');
          }
          // メタデータも含めて返す（型アサーションで対応）
          return { ...parsed.data, ...parsed } as T;
        } else {
          // 24時間以上経過したデータは削除
          localStorage.removeItem(autosaveKey);
        }
      }
    } catch (err) {
      // 復元エラーは無視
      logger.warn('オートセーブからの復元に失敗しました', 'useFormAutosave', err);
    }
    return null;
  };

  // 保存されたデータをクリア
  const clear = (): void => {
    try {
      const autosaveKey = `form_autosave_${config.key}`;
      localStorage.removeItem(autosaveKey);
    } catch (err) {
      logger.warn('オートセーブのクリアに失敗しました', 'useFormAutosave', err);
    }
  };

  return { restore, clear };
};

