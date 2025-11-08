// Tooltip - ツールチップコンポーネント

import React, { useState, useRef, useEffect } from 'react';
import './Tooltip.css';

/**
 * ツールチップの位置
 */
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * ツールチップコンポーネントのプロパティ
 */
interface TooltipProps {
  /** ツールチップの内容（テキスト） */
  content: string;
  /** ツールチップのタイトル（オプション） */
  title?: string;
  /** ツールチップの表示位置 */
  position?: TooltipPosition;
  /** 子要素（ツールチップを表示する対象要素） */
  children: React.ReactElement;
  /** ツールチップの遅延表示時間（ミリ秒、デフォルト: 300） */
  delay?: number;
  /** ツールチップの最大幅（ピクセル、デフォルト: 380） */
  maxWidth?: number;
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * ツールチップコンポーネント
 * 任意の要素にホバー時にツールチップを表示します
 *
 * @example
 * <Tooltip content="このボタンをクリックしてAPIを作成します">
 *   <button>作成</button>
 * </Tooltip>
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  title,
  position = 'top',
  children,
  delay = 300,
  maxWidth = 350,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition>(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ツールチップの位置を調整（画面外に出ないように）
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !containerRef.current) {
      return;
    }

    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let newPosition: TooltipPosition = position;

    // 画面外に出る場合は位置を調整
    if (position === 'top' && rect.top - tooltipRect.height < 0) {
      newPosition = 'bottom';
    } else if (
      position === 'bottom' &&
      rect.bottom + tooltipRect.height > window.innerHeight
    ) {
      newPosition = 'top';
    } else if (position === 'left' && rect.left - tooltipRect.width < 0) {
      newPosition = 'right';
    } else if (
      position === 'right' &&
      rect.right + tooltipRect.width > window.innerWidth
    ) {
      newPosition = 'left';
    }

    setTooltipPosition(newPosition);
  }, [isVisible, position]);

  // ツールチップの最大幅をCSS変数として設定
  useEffect(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.setProperty(
        '--tooltip-max-width',
        `${maxWidth}px`
      );
    }
  }, [maxWidth, isVisible]);

  const handleMouseEnter = () => {
    if (disabled) return;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const handleFocus = () => {
    if (disabled) return;
    setIsVisible(true);
  };

  const handleBlur = () => {
    setIsVisible(false);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 子要素にイベントハンドラを追加
  const existingProps = children.props as Record<string, unknown>;
  const childWithProps = React.cloneElement(children, {
    ...existingProps,
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      if (typeof existingProps.onMouseEnter === 'function') {
        (existingProps.onMouseEnter as (e: React.MouseEvent) => void)(e);
      }
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      if (typeof existingProps.onMouseLeave === 'function') {
        (existingProps.onMouseLeave as (e: React.MouseEvent) => void)(e);
      }
    },
    onFocus: (e: React.FocusEvent) => {
      handleFocus();
      if (typeof existingProps.onFocus === 'function') {
        (existingProps.onFocus as (e: React.FocusEvent) => void)(e);
      }
    },
    onBlur: (e: React.FocusEvent) => {
      handleBlur();
      if (typeof existingProps.onBlur === 'function') {
        (existingProps.onBlur as (e: React.FocusEvent) => void)(e);
      }
    },
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <div className="tooltip-container" ref={containerRef}>
      {childWithProps}
      {isVisible && !disabled && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${tooltipPosition}`}
          role="tooltip"
          aria-live="polite"
          aria-atomic="true"
        >
          {title && <div className="tooltip-title">{title}</div>}
          <div className="tooltip-content">{content}</div>
        </div>
      )}
    </div>
  );
};
