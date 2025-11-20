// LLMTestConfig - LLMテスト設定コンポーネント

import React from 'react';
import './LLMTestRunner.css';

/**
 * LLMTestConfigのプロパティ
 */
interface LLMTestConfigProps {
  customMessages: string;
  onCustomMessagesChange: (messages: string) => void;
  disabled: boolean;
}

/**
 * LLMテスト設定コンポーネント
 */
export const LLMTestConfig: React.FC<LLMTestConfigProps> = ({
  customMessages,
  onCustomMessagesChange,
  disabled,
}) => {
  return (
    <div className="test-config">
      <label>
        <span>カスタムテストメッセージ（1行に1つ）:</span>
        <textarea
          className="custom-messages-input"
          value={customMessages}
          onChange={e => onCustomMessagesChange(e.target.value)}
          placeholder="デフォルトのメッセージを使用する場合は空欄のまま"
          rows={4}
          disabled={disabled}
        />
      </label>
    </div>
  );
};
