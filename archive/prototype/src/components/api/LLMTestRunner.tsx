// SPDX-License-Identifier: MIT
// LLMTestRunner - LLM実行テストランナーコンポーネント

import React, { useState } from 'react';
import { useLLMTestRunner } from '../../hooks/useLLMTestRunner';
import type { LLMTestResult } from '../../utils/llmTest';
import { LLMTestResults } from './LLMTestResults';
import { LLMTestConfig } from './LLMTestConfig';
import { LLMTestProgress } from './LLMTestProgress';
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
  const [customMessages, setCustomMessages] = useState<string>('');

  // テスト実行ロジック
  const {
    testing,
    results,
    currentTest,
    successRate,
    avgResponseTime,
    runTests,
    canRun,
  } = useLLMTestRunner({
    apiId,
    endpoint,
    apiKey,
    modelName,
    customMessages,
    onTestComplete,
  });

  return (
    <div className="llm-test-runner">
      <div className="test-runner-header">
        <h3>LLM実行テスト</h3>
        <button
          className="test-button"
          onClick={runTests}
          disabled={testing || !canRun}
        >
          {testing ? 'テスト実行中...' : 'テスト実行'}
        </button>
      </div>

      <LLMTestProgress currentTest={currentTest} visible={testing} />

      <LLMTestConfig
        customMessages={customMessages}
        onCustomMessagesChange={setCustomMessages}
        disabled={testing}
      />

      <LLMTestResults
        results={results}
        successRate={successRate}
        avgResponseTime={avgResponseTime}
      />
    </div>
  );
};

