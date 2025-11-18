// LLMTestResults - LLMテスト結果表示コンポーネント

import React from 'react';
import type { LLMTestResult } from '../../utils/llmTest';
import './LLMTestRunner.css';

/**
 * LLMTestResultsのプロパティ
 */
interface LLMTestResultsProps {
  results: LLMTestResult[];
  successRate: number;
  avgResponseTime: number;
}

/**
 * LLMテスト結果表示コンポーネント
 */
export const LLMTestResults: React.FC<LLMTestResultsProps> = ({
  results,
  successRate,
  avgResponseTime,
}) => {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="test-results">
      <div className="results-summary">
        <div className="summary-item">
          <span className="summary-label">成功率:</span>
          <span className={`summary-value ${successRate === 100 ? 'success' : successRate > 0 ? 'partial' : 'error'}`}>
            {successRate.toFixed(1)}%
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">平均応答時間:</span>
          <span className="summary-value">{avgResponseTime.toFixed(0)}ms</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">テスト数:</span>
          <span className="summary-value">{results.length}</span>
        </div>
      </div>

      <div className="results-list">
        {results.map((result, index) => (
          <div
            key={index}
            className={`test-result-item ${result.success ? 'success' : 'error'}`}
          >
            <div className="result-header">
              <span className="result-status">
                {result.success ? '✅' : '❌'}
              </span>
              <span className="result-time">{result.responseTime}ms</span>
              {result.tokens && (
                <span className="result-tokens">{result.tokens} トークン</span>
              )}
            </div>
            {result.error ? (
              <div className="result-error">{result.error}</div>
            ) : (
              <div className="result-message">
                {result.message.substring(0, 200)}
                {result.message.length > 200 ? '...' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

