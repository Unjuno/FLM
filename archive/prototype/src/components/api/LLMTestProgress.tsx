// LLMTestProgress - LLMテスト進捗表示コンポーネント

import React from 'react';
import './LLMTestRunner.css';

/**
 * LLMTestProgressのプロパティ
 */
interface LLMTestProgressProps {
  currentTest: string;
  visible: boolean;
}

/**
 * LLMテスト進捗表示コンポーネント
 */
export const LLMTestProgress: React.FC<LLMTestProgressProps> = ({
  currentTest,
  visible,
}) => {
  if (!visible || !currentTest) {
    return null;
  }

  return (
    <div className="test-progress">
      <div className="progress-indicator"></div>
      <span>{currentTest}</span>
    </div>
  );
};
