// LLMTestRunner - LLM実行テストランナーコンポーネント

import React, { useState, useCallback } from 'react';
import { testLLMExecution, testLLMByApiId, type LLMTestResult } from '../../utils/llmTest';
import { logger } from '../../utils/logger';
import './LLMTestRunner.css';

/**
 * LLMテストランナーのプロパティ
 */
interface LLMTestRunnerProps {
  apiId?: string;
  endpoint?: string;
  apiKey?: string;
  modelName?: string;
  onTestComplete?: (results: LLMTestResult[]) => void;
}

/**
 * デフォルトのテストメッセージ
 */
const DEFAULT_TEST_MESSAGES = [
  'こんにちは',
  'PythonでHello Worldを書いて',
  '1+1は？',
  '日本の首都はどこですか？',
];

/**
 * LLM実行テストランナーコンポーネント
 * LLM APIの動作を自動的にテストします
 */
export const LLMTestRunner: React.FC<LLMTestRunnerProps> = ({
  apiId,
  endpoint,
  apiKey,
  modelName,
  onTestComplete,
}) => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<LLMTestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [customMessages, setCustomMessages] = useState<string>('');

  // テスト実行
  const runTests = useCallback(async () => {
    if (testing) return;

    setTesting(true);
    setResults([]);
    setCurrentTest('');

    try {
      const testMessages = customMessages.trim()
        ? customMessages.split('\n').filter(m => m.trim())
        : DEFAULT_TEST_MESSAGES;

      const testResults: LLMTestResult[] = [];

      for (let i = 0; i < testMessages.length; i++) {
        const message = testMessages[i].trim();
        if (!message) continue;

        setCurrentTest(`テスト ${i + 1}/${testMessages.length}: "${message.substring(0, 30)}..."`);

        let result: LLMTestResult;

        if (apiId) {
          // API IDからテスト
          result = await testLLMByApiId(apiId, message);
        } else if (endpoint && modelName) {
          // エンドポイントとモデル名からテスト
          result = await testLLMExecution({
            endpoint,
            apiKey,
            modelName,
            message,
          });
        } else {
          result = {
            success: false,
            responseTime: 0,
            message: '',
            error: 'テストに必要な情報が不足しています（apiId または endpoint + modelName）',
          };
        }

        testResults.push(result);
        setResults([...testResults]);

        // 次のテストまで待機
        if (i < testMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setCurrentTest('');
      if (onTestComplete) {
        onTestComplete(testResults);
      }

      // 結果をログに記録
      const successCount = testResults.filter(r => r.success).length;
      const totalCount = testResults.length;
      logger.info(
        `LLMテスト完了: ${successCount}/${totalCount} 成功`,
        'LLMTestRunner'
      );
    } catch (err) {
      logger.error('LLMテスト実行エラー', err instanceof Error ? err : new Error(String(err)), 'LLMTestRunner');
      setCurrentTest('');
    } finally {
      setTesting(false);
    }
  }, [apiId, endpoint, apiKey, modelName, customMessages, testing, onTestComplete]);

  // 成功率を計算
  const successRate = results.length > 0
    ? (results.filter(r => r.success).length / results.length) * 100
    : 0;

  // 平均応答時間を計算
  const avgResponseTime = results.length > 0
    ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
    : 0;

  return (
    <div className="llm-test-runner">
      <div className="test-runner-header">
        <h3>LLM実行テスト</h3>
        <button
          className="test-button"
          onClick={runTests}
          disabled={testing || (!apiId && (!endpoint || !modelName))}
        >
          {testing ? 'テスト実行中...' : 'テスト実行'}
        </button>
      </div>

      {testing && currentTest && (
        <div className="test-progress">
          <div className="progress-indicator"></div>
          <span>{currentTest}</span>
        </div>
      )}

      <div className="test-config">
        <label>
          <span>カスタムテストメッセージ（1行に1つ）:</span>
          <textarea
            className="custom-messages-input"
            value={customMessages}
            onChange={e => setCustomMessages(e.target.value)}
            placeholder="デフォルトのメッセージを使用する場合は空欄のまま"
            rows={4}
            disabled={testing}
          />
        </label>
      </div>

      {results.length > 0 && (
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
      )}
    </div>
  );
};

