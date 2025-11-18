// useLLMTestRunner - LLMテスト実行ロジックを提供するカスタムフック

import { useState, useCallback } from 'react';
import { testLLMExecution, testLLMByApiId, type LLMTestResult } from '../utils/llmTest';
import { logger } from '../utils/logger';
import { useErrorHandler } from './useErrorHandler';

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
 * useLLMTestRunnerのオプション
 */
export interface UseLLMTestRunnerOptions {
  apiId?: string;
  endpoint?: string;
  apiKey?: string;
  modelName?: string;
  customMessages?: string;
  onTestComplete?: (results: LLMTestResult[]) => void;
}

/**
 * LLMテスト実行ロジックを提供するカスタムフック
 */
export function useLLMTestRunner(options: UseLLMTestRunnerOptions) {
  const {
    apiId,
    endpoint,
    apiKey,
    modelName,
    customMessages = '',
    onTestComplete,
  } = options;

  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<LLMTestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');
  const { handleError } = useErrorHandler({ componentName: 'LLMTestRunner' });

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
      handleError(err, 'LLMテスト実行エラー');
      setCurrentTest('');
    } finally {
      setTesting(false);
    }
  }, [apiId, endpoint, apiKey, modelName, customMessages, testing, onTestComplete, handleError]);

  // 成功率を計算
  const successRate = results.length > 0
    ? (results.filter(r => r.success).length / results.length) * 100
    : 0;

  // 平均応答時間を計算
  const avgResponseTime = results.length > 0
    ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
    : 0;

  return {
    testing,
    results,
    currentTest,
    successRate,
    avgResponseTime,
    runTests,
    canRun: !!(apiId || (endpoint && modelName)),
  };
}

