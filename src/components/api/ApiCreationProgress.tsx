// ApiCreationProgress - API作成進行中コンポーネント

import React, { useRef, useEffect } from 'react';
import './ApiCreationProgress.css';

/**
 * 進行状況情報
 */
interface ProgressInfo {
  step: string;
  progress: number;
}

/**
 * API作成進行中コンポーネント
 */
interface ApiCreationProgressProps {
  progress: ProgressInfo;
}

export const ApiCreationProgress: React.FC<ApiCreationProgressProps> = ({ progress }) => {
  const progressPercent = Math.round(progress.progress);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.setProperty('--progress', `${progressPercent}%`);
    }
  }, [progressPercent]);
  
  return (
    <div className="api-creation-progress">
      <div className="progress-container">
        <div className="progress-icon">
          <div className="spinner"></div>
        </div>
        <h2>APIを作成中...</h2>
        <p className="progress-step">{progress.step}</p>
        
        <div className="progress-bar-container">
          <div 
            ref={progressBarRef}
            className="progress-bar" 
            data-progress={progressPercent}
          ></div>
        </div>
        <div className="progress-percentage">{progressPercent}%</div>

        <div className="progress-steps">
          <div className={`progress-step-item ${progress.progress >= 20 ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Ollama確認</span>
          </div>
          <div className={`progress-step-item ${progress.progress >= 40 ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">認証プロキシ起動</span>
          </div>
          <div className={`progress-step-item ${progress.progress >= 60 ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">設定保存</span>
          </div>
          <div className={`progress-step-item ${progress.progress >= 100 ? 'completed' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">完了</span>
          </div>
        </div>
      </div>
    </div>
  );
};
