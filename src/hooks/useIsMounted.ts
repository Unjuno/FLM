// useIsMounted - コンポーネントのマウント状態を追跡するカスタムフック

import { useEffect, useRef } from 'react';

/**
 * コンポーネントのマウント状態を追跡するカスタムフック
 * アンマウント後の状態更新を防ぐために使用します
 * 
 * @returns マウント状態を確認する関数
 * 
 * @example
 * ```tsx
 * const isMounted = useIsMounted();
 * 
 * useEffect(() => {
 *   someAsyncOperation().then(() => {
 *     if (isMounted()) {
 *       setState(value);
 *     }
 *   });
 * }, []);
 * ```
 */
export const useIsMounted = (): (() => boolean) => {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return () => isMountedRef.current;
};

