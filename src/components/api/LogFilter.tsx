// FLM - ログフィルタコンポーネント
// フロントエンドエージェント (FE) 実装
// F006: ログ表示機能 - ログフィルタコンポーネント

import React, { useState, useEffect } from 'react';
import './LogFilter.css';

/**
 * フィルタ状態
 */
export interface LogFilterState {
  startDate: string;
  endDate: string;
  statusCodes: number[];
  pathFilter: string;
  errorsOnly: boolean;
}

/**
 * ログフィルタコンポーネントのプロパティ
 */
interface LogFilterProps {
  onFilterChange: (filter: LogFilterState) => void;
  initialFilter?: Partial<LogFilterState>;
}

/**
 * ステータスコードオプション
 */
const STATUS_CODE_OPTIONS = [
  { value: 200, label: '200 (OK)' },
  { value: 201, label: '201 (Created)' },
  { value: 400, label: '400 (Bad Request)' },
  { value: 401, label: '401 (Unauthorized)' },
  { value: 403, label: '403 (Forbidden)' },
  { value: 404, label: '404 (Not Found)' },
  { value: 500, label: '500 (Internal Server Error)' },
  { value: 502, label: '502 (Bad Gateway)' },
  { value: 503, label: '503 (Service Unavailable)' },
];

/**
 * ログフィルタコンポーネント
 * ログをフィルタリングするためのUIを提供します
 */
export const LogFilter: React.FC<LogFilterProps> = ({
  onFilterChange,
  initialFilter,
}) => {
  const [startDate, setStartDate] = useState<string>(initialFilter?.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialFilter?.endDate || '');
  const [statusCodes, setStatusCodes] = useState<number[]>(initialFilter?.statusCodes || []);
  const [pathFilter, setPathFilter] = useState<string>(initialFilter?.pathFilter || '');
  const [errorsOnly, setErrorsOnly] = useState<boolean>(initialFilter?.errorsOnly || false);

  // フィルタ変更時に親コンポーネントに通知
  useEffect(() => {
    const filter: LogFilterState = {
      startDate,
      endDate,
      statusCodes,
      pathFilter,
      errorsOnly,
    };
    onFilterChange(filter);
  }, [startDate, endDate, statusCodes, pathFilter, errorsOnly, onFilterChange]);

  // ステータスコードの選択/解除
  const handleStatusCodeToggle = (code: number) => {
    setStatusCodes(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  // フィルタリセット
  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setStatusCodes([]);
    setPathFilter('');
    setErrorsOnly(false);
  };

  // 日時の最大値設定（終了日時が開始日時より前にならないように）
  const getMaxStartDate = () => endDate || undefined;
  const getMinEndDate = () => startDate || undefined;

  return (
    <div className="log-filter">
      <div className="filter-header">
        <h3 className="filter-title">フィルタ</h3>
        <button className="filter-reset-button" onClick={handleReset}>
          🔄 リセット
        </button>
      </div>

      <div className="filter-content">
        {/* 日時範囲選択 */}
        <div className="filter-section">
          <label className="filter-label">日時範囲</label>
          <div className="date-range-inputs">
            <div className="date-input-group">
              <label htmlFor="start-date" className="date-label">
                開始日時:
              </label>
              <input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={getMaxStartDate()}
                className="date-input"
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="end-date" className="date-label">
                終了日時:
              </label>
              <input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={getMinEndDate()}
                className="date-input"
              />
            </div>
          </div>
        </div>

        {/* ステータスコードフィルタ */}
        <div className="filter-section">
          <label className="filter-label">ステータスコード</label>
          <div className="status-codes-grid">
            {STATUS_CODE_OPTIONS.map((option) => (
              <label key={option.value} className="status-code-checkbox">
                <input
                  type="checkbox"
                  checked={statusCodes.includes(option.value)}
                  onChange={() => handleStatusCodeToggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* パス検索 */}
        <div className="filter-section">
          <label htmlFor="path-filter" className="filter-label">
            パス検索
          </label>
          <input
            id="path-filter"
            type="text"
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            placeholder="/api/chat/completions"
            className="path-filter-input"
          />
        </div>

        {/* エラーのみ表示 */}
        <div className="filter-section">
          <label className="error-only-toggle">
            <input
              type="checkbox"
              checked={errorsOnly}
              onChange={(e) => setErrorsOnly(e.target.checked)}
            />
            <span>エラーのみ表示（ステータスコード 400以上）</span>
          </label>
        </div>
      </div>
    </div>
  );
};
