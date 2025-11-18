// ErrorLogFilters - エラーログフィルターコンポーネント

import React from 'react';
import './ErrorLogFilters.css';

/**
 * フィルターの状態
 */
export interface ErrorLogFilters {
  error_category: string;
  api_id: string;
  start_date: string;
  end_date: string;
}

/**
 * ErrorLogFiltersのプロパティ
 */
interface ErrorLogFiltersProps {
  filters: ErrorLogFilters;
  onFiltersChange: (filters: ErrorLogFilters) => void;
  onApply: () => void;
  onClear: () => void;
}

/**
 * エラーログフィルターコンポーネント
 */
export const ErrorLogFilters: React.FC<ErrorLogFiltersProps> = ({
  filters,
  onFiltersChange,
  onApply,
  onClear,
}) => {
  const handleFilterChange = (key: keyof ErrorLogFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <section className="filters-section">
      <h2>フィルター</h2>
      <div className="filters-grid">
        <div className="filter-group">
          <label htmlFor="error-category">カテゴリ</label>
          <select
            id="error-category"
            value={filters.error_category}
            onChange={e => handleFilterChange('error_category', e.target.value)}
          >
            <option value="">すべて</option>
            <option value="general">一般</option>
            <option value="api">API</option>
            <option value="database">データベース</option>
            <option value="network">ネットワーク</option>
            <option value="ollama">Ollama</option>
            <option value="model">モデル</option>
            <option value="permission">権限</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="start-date">開始日</label>
          <input
            id="start-date"
            type="date"
            value={filters.start_date}
            onChange={e => handleFilterChange('start_date', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="end-date">終了日</label>
          <input
            id="end-date"
            type="date"
            value={filters.end_date}
            onChange={e => handleFilterChange('end_date', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <button className="apply-filters-button" onClick={onApply}>
            フィルター適用
          </button>
          <button className="clear-filters-button" onClick={onClear}>
            クリア
          </button>
        </div>
      </div>
    </section>
  );
};

