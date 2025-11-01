// FLM - 情報バナーコンポーネント
// フロントエンドエージェント (FE) 実装
// フェーズ4: UI/UX改善 - ガイダンス表示の追加・改善

import React, { useState } from 'react';
import './InfoBanner.css';

/**
 * 情報バナーの種類
 */
export type InfoBannerType = 'info' | 'tip' | 'warning' | 'success';

/**
 * 情報バナーコンポーネントのプロパティ
 */
interface InfoBannerProps {
  type?: InfoBannerType;
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

/**
 * 情報バナーコンポーネント
 * 非開発者向けのガイダンスや情報を表示します
 */
export const InfoBanner: React.FC<InfoBannerProps> = ({
  type = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const getTypeInfo = (bannerType: InfoBannerType) => {
    switch (bannerType) {
      case 'info':
        return { icon: 'ℹ️', className: 'info' };
      case 'tip':
        return { icon: '💡', className: 'tip' };
      case 'warning':
        return { icon: '⚠️', className: 'warning' };
      case 'success':
        return { icon: '✅', className: 'success' };
      default:
        return { icon: 'ℹ️', className: 'info' };
    }
  };

  const typeInfo = getTypeInfo(type);

  return (
    <div className={`info-banner info-banner-${typeInfo.className}`}>
      <div className="info-banner-content">
        <span className="info-banner-icon">{typeInfo.icon}</span>
        <div className="info-banner-text">
          {title && <div className="info-banner-title">{title}</div>}
          <div className="info-banner-message">{message}</div>
        </div>
        {dismissible && (
          <button
            className="info-banner-close"
            onClick={handleDismiss}
            aria-label="閉じる"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

