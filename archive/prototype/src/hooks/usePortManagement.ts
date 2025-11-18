// usePortManagement - ポート管理用カスタムフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';
import { PORT_RANGE, TIMEOUT } from '../constants/config';
import { logger } from '../utils/logger';
import { useIsMounted } from './useIsMounted';

/**
 * ポート管理フックの戻り値
 */
export interface UsePortManagementReturn {
  /** ポート番号 */
  port: number;
  /** ポート検出中かどうか */
  portDetecting: boolean;
  /** ポート検出が成功したかどうか */
  portDetected: boolean;
  /** ポートエラーメッセージ */
  portError?: string;
  /** ポートを設定 */
  setPort: (port: number) => void;
  /** 利用可能なポートを検出 */
  detectAvailablePort: () => Promise<void>;
  /** ポートを自動検出（内部使用） */
  autoDetectPort: (preferredPort?: number) => Promise<number>;
}

/**
 * ポート管理用カスタムフック
 * 
 * @param initialPort - 初期ポート番号
 * @param onPortChange - ポート変更時のコールバック
 */
export const usePortManagement = (
  initialPort: number,
  onPortChange?: (port: number) => void
): UsePortManagementReturn => {
  const [port, setPortState] = useState<number>(initialPort);
  const [portDetecting, setPortDetecting] = useState(false);
  const [portDetected, setPortDetected] = useState(false);
  const [portError, setPortError] = useState<string | undefined>(undefined);
  
  const isMounted = useIsMounted();

  // ポートを設定
  const setPort = useCallback((newPort: number) => {
    setPortState(newPort);
    setPortError(undefined);
    onPortChange?.(newPort);
  }, [onPortChange]);

  // 利用可能なポートを自動検出（内部使用）
  const autoDetectPort = useCallback(
    async (preferredPort?: number): Promise<number> => {
      try {
        const startPort = preferredPort || port || PORT_RANGE.DEFAULT;
        const result = await safeInvoke<{
          recommended_port: number;
          is_available: boolean;
          alternative_ports: number[];
        }>('find_available_port', { start_port: startPort });

        if (result && result.recommended_port) {
          const detectedPort = result.recommended_port;
          if (isMounted()) {
            setPortState(detectedPort);
            setPortError(undefined);
            onPortChange?.(detectedPort);
          }
          return detectedPort;
        }
      } catch (err) {
        logger.error('ポート自動検出エラー', err, 'usePortManagement');
      }
      // 検出に失敗した場合は、デフォルトポートまたは現在のポートを返す
      return preferredPort || port || PORT_RANGE.DEFAULT;
    },
    [port, onPortChange, isMounted]
  );

  // ポート番号を自動検出（手動ボタン用）
  const detectAvailablePort = useCallback(async () => {
    try {
      setPortDetecting(true);
      setPortDetected(false);
      setPortError(undefined);

      const startPort = port || PORT_RANGE.DEFAULT;
      const result = await safeInvoke<{
        recommended_port: number;
        is_available: boolean;
        alternative_ports: number[];
      }>('find_available_port', { start_port: startPort });

      if (result && result.recommended_port) {
        const detectedPort = result.recommended_port;
        if (isMounted()) {
          setPortState(detectedPort);
          setPortDetected(true);
          onPortChange?.(detectedPort);
          // 3秒後に成功メッセージを非表示
          setTimeout(() => {
            if (isMounted()) {
              setPortDetected(false);
            }
          }, 3000);
        }
      } else {
        // 検出に失敗した場合は、デフォルトポートを使用するか、現在のポートを維持
        if (!port) {
          if (isMounted()) {
            setPortState(PORT_RANGE.DEFAULT);
            onPortChange?.(PORT_RANGE.DEFAULT);
          }
        }
        logger.warn(
          'ポート検出で結果が取得できませんでした。デフォルトポートを使用します。',
          'usePortManagement'
        );
        setPortDetected(false);
      }
    } catch (err) {
      logger.error('ポート検出エラー', err, 'usePortManagement');
      // エラーが発生しても、デフォルトポートを使用して続行
      if (!port) {
        if (isMounted()) {
          setPortState(PORT_RANGE.DEFAULT);
          onPortChange?.(PORT_RANGE.DEFAULT);
        }
      }
      setPortDetected(false);
    } finally {
      if (isMounted()) {
        setPortDetecting(false);
      }
    }
  }, [port, onPortChange, isMounted]);

  // 初期化時にポートを自動検出
  useEffect(() => {
    const initializePort = async () => {
      try {
        // ポートが設定されていない場合、またはデフォルトポートの場合
        if (!port || port === PORT_RANGE.DEFAULT) {
          // デフォルトポートが使用可能かチェック
          const isDefaultAvailable = await safeInvoke<boolean>(
            'check_port_availability',
            { port: PORT_RANGE.DEFAULT }
          ).catch(() => {
            logger.warn(
              'ポート可用性チェックに失敗しました。自動検出を試みます。',
              'usePortManagement'
            );
            return false;
          });

          if (!isDefaultAvailable) {
            // デフォルトポートが使用中の場合は、自動的に利用可能なポートを検出
            try {
              await autoDetectPort(PORT_RANGE.DEFAULT);
            } catch (err) {
              logger.error(
                '自動ポート検出に失敗しました。デフォルトポートを使用します。',
                err,
                'usePortManagement'
              );
              // エラーが発生した場合でも、デフォルトポートを設定
              if (!port && isMounted()) {
                setPortState(PORT_RANGE.DEFAULT);
                onPortChange?.(PORT_RANGE.DEFAULT);
              }
            }
          } else if (!port && isMounted()) {
            // ポートが設定されていない場合は、デフォルトポートを使用
            setPortState(PORT_RANGE.DEFAULT);
            onPortChange?.(PORT_RANGE.DEFAULT);
          }
        }
      } catch (err) {
        logger.error('ポート初期化エラー', err, 'usePortManagement');
        // エラーが発生した場合でも、デフォルトポートを設定
        if (!port && isMounted()) {
          setPortState(PORT_RANGE.DEFAULT);
          onPortChange?.(PORT_RANGE.DEFAULT);
        }
      }
    };

    initializePort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // ポート番号が変更されたときに確認（使用中の場合は自動的に代替ポートを検出）
  // 高頻度レンダリングを防ぐため、前回のポートを保持して変更時のみチェック
  const prevPortRef = useRef<number | null>(null);
  const portCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // ポートが実際に変更された場合のみチェック（高頻度レンダリングを防ぐ）
    if (prevPortRef.current === port) {
      return;
    }
    
    prevPortRef.current = port;
    
    // 既存のタイムアウトをクリア
    if (portCheckTimeoutRef.current) {
      clearTimeout(portCheckTimeoutRef.current);
      portCheckTimeoutRef.current = null;
    }
    
    if (
      port &&
      port >= PORT_RANGE.MIN &&
      port <= PORT_RANGE.MAX
    ) {
      portCheckTimeoutRef.current = setTimeout(async () => {
        const isAvailable = await safeInvoke<boolean>(
          'check_port_availability',
          { port }
        );

        if (!isAvailable) {
          // ポートが使用中の場合は、自動的に代替ポートを検出
          try {
            const newPort = await autoDetectPort(port);
            if (newPort && newPort !== port && isMounted()) {
              // 代替ポートが見つかった場合、ユーザーに通知
              setPortError(
                `ポート ${port} は既に使用されています。自動的にポート ${newPort} に変更しました。`
              );
              // エラーメッセージを3秒後にクリア
              setTimeout(() => {
                if (isMounted()) {
                  setPortError(undefined);
                }
              }, 3000);
            } else {
              // 代替ポートが見つからない場合は、警告のみ表示（エラーではない）
              logger.warn(
                `ポート ${port} は使用中ですが、代替ポートの検出に失敗しました。API作成時に自動的に利用可能なポートが選択されます。`,
                'usePortManagement'
              );
            }
          } catch (err) {
            // 検出エラーが発生した場合は、警告のみ（API作成時に自動的に処理される）
            logger.warn(
              'ポート検出エラーが発生しましたが、API作成時に自動的に処理されます。',
              'usePortManagement',
              err
            );
          }
        } else {
          // ポートが使用可能な場合はエラーをクリア
          if (isMounted()) {
            setPortError(prevError => {
              if (prevError && prevError.includes('既に使用されています')) {
                return undefined;
              }
              return prevError;
            });
          }
        }
        portCheckTimeoutRef.current = null;
       }, TIMEOUT.PORT_CHECK_DELAY);
     }
     
     return () => {
       if (portCheckTimeoutRef.current) {
         clearTimeout(portCheckTimeoutRef.current);
         portCheckTimeoutRef.current = null;
       }
     };
   }, [port, autoDetectPort, isMounted]);

  return {
    port,
    portDetecting,
    portDetected,
    portError,
    setPort,
    detectAvailablePort,
    autoDetectPort,
  };
};

