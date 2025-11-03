// HelpTooltip - ヘルプツールチップコンポーネント

import React, { useState } from 'react';
import './HelpTooltip.css';

/**
 * ヘルプツールチップコンポーネントのプロパティ
 */
interface HelpTooltipProps {
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
}

/**
 * ヘルプツールチップコンポーネント
 * 非開発者向けのガイダンス表示を提供します
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  title,
  position = 'top',
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="help-tooltip-container">
      <button
        className="help-tooltip-trigger"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="ヘルプを表示"
      >
        {children || '❓'}
      </button>
      {isVisible && (
        <div className={`help-tooltip help-tooltip-${position}`}>
          {title && <div className="help-tooltip-title">{title}</div>}
          <div className="help-tooltip-content">{content}</div>
        </div>
      )}
    </div>
  );
};

