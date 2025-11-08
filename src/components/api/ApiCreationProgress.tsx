// ApiCreationProgress - API作成進行中コンポーネント

import React from 'react';
import { ProgressDisplay, ProgressInfo } from '../common/ProgressDisplay';

/**
 * API作成進行中コンポーネント
 */
interface ApiCreationProgressProps {
  progress: ProgressInfo;
  onCancel?: () => void;
}

export const ApiCreationProgress: React.FC<ApiCreationProgressProps> = ({
  progress,
  onCancel,
}) => {
  // デフォルトのステップ情報を生成
  const steps = progress.steps || [
    {
      label: 'エンジン確認',
      completed: progress.progress >= 20,
      active: progress.progress >= 0 && progress.progress < 20,
    },
    {
      label: '設定保存',
      completed: progress.progress >= 40,
      active: progress.progress >= 20 && progress.progress < 40,
    },
    {
      label: '認証プロキシ起動',
      completed: progress.progress >= 60,
      active: progress.progress >= 40 && progress.progress < 60,
    },
    {
      label: '完了',
      completed: progress.progress >= 100,
      active: progress.progress >= 60 && progress.progress < 100,
    },
  ];

  return (
    <ProgressDisplay
      progress={{
        ...progress,
        steps,
      }}
      onCancel={onCancel}
      title="APIを作成中..."
      className="api-creation-progress"
    />
  );
};
