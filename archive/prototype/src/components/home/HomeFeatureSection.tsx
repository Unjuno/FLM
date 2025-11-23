// HomeFeatureSection - ホーム画面の機能セクションコンポーネント

import React from 'react';
import { Tooltip } from '../common/Tooltip';
import type { HomeFeature } from '../../hooks/useHomeFeatures';
import './HomeFeatureSection.css';

/**
 * HomeFeatureSectionのプロパティ
 */
interface HomeFeatureSectionProps {
  title: string;
  features: HomeFeature[];
  isExpanded: boolean;
  onToggle: () => void;
  onFeatureClick: (feature: HomeFeature) => void;
  isPending: boolean;
}

/**
 * ホーム画面の機能セクションコンポーネント
 */
export const HomeFeatureSection: React.FC<HomeFeatureSectionProps> = ({
  title,
  features,
  isExpanded,
  onToggle,
  onFeatureClick,
  isPending,
}) => {
  return (
    <section className="home-section">
      <button className="home-section-header" onClick={onToggle}>
        <h2 className="home-section-title">{title}</h2>
        <span className="home-section-toggle">{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <nav className="home-actions" aria-label={title}>
          {features.map(feature => (
            <Tooltip
              key={feature.id}
              content={feature.description}
              position="right"
            >
              <button
                className={`home-action-button ${feature.id === 'quick-create' ? 'quick-create' : ''}`}
                onClick={() => onFeatureClick(feature)}
                aria-label={feature.label}
                disabled={isPending && feature.id === 'quick-create'}
              >
                <span className="button-text">
                  <strong>{feature.label}</strong>
                  <small>{feature.description}</small>
                </span>
              </button>
            </Tooltip>
          ))}
        </nav>
      )}
    </section>
  );
};
