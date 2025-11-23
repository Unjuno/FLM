// HomeSearchResults - ホーム画面の検索結果コンポーネント

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '../common/Tooltip';
import type { HomeFeature } from '../../hooks/useHomeFeatures';
import './HomeSearchResults.css';

/**
 * HomeSearchResultsのプロパティ
 */
interface HomeSearchResultsProps {
  searchQuery: string;
  filteredFeatures: HomeFeature[];
  onQuickCreate: () => void;
  isPending: boolean;
}

/**
 * ホーム画面の検索結果コンポーネント
 */
export const HomeSearchResults: React.FC<HomeSearchResultsProps> = ({
  searchQuery,
  filteredFeatures,
  onQuickCreate,
  isPending,
}) => {
  const navigate = useNavigate();

  if (!searchQuery) {
    return null;
  }

  return (
    <section className="home-section search-results">
      <h2 className="home-section-title">
        検索結果: {filteredFeatures.length}件
        {filteredFeatures.length === 0 && (
          <span className="home-search-empty">
            (該当する機能が見つかりませんでした)
          </span>
        )}
      </h2>
      {filteredFeatures.length > 0 && (
        <nav className="home-actions" aria-label="検索結果">
          {filteredFeatures.map(feature => {
            const handleClick = () => {
              if (feature.id === 'quick-create') {
                onQuickCreate();
              } else {
                navigate(feature.path);
              }
            };
            return (
              <Tooltip
                key={feature.id}
                content={feature.description}
                position="right"
              >
                <button
                  className={`home-action-button ${feature.id === 'quick-create' ? 'quick-create' : ''}`}
                  onClick={handleClick}
                  aria-label={feature.label}
                  disabled={isPending && feature.id === 'quick-create'}
                >
                  <span className="button-text">
                    <strong>{feature.label}</strong>
                    <small>{feature.description}</small>
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </nav>
      )}
    </section>
  );
};
