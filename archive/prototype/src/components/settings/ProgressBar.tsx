/**
 * プログレスバーコンポーネント
 */

import React, { useEffect, useRef } from 'react';

/**
 * プログレスバーのプロパティ
 */
interface ProgressBarProps {
  progress: number;
  message?: string;
  className?: string;
}

/**
 * プログレスバーコンポーネント（インラインスタイルなし）
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  message,
  className = 'settings-update-progress',
}) => {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress]);

  return (
    <div className={className} ref={progressRef}>
      <div className="settings-progress-bar">
        <div className="settings-progress-fill" />
      </div>
      <span className="settings-progress-text">
        {message || `${Math.round(progress)}%`}
      </span>
    </div>
  );
};

/**
 * エンジン更新プログレスバーコンポーネント（インラインスタイルなし）
 */
export const EngineProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  message,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress]);

  return (
    <div className="settings-engine-update-progress" ref={progressRef}>
      <div className="settings-progress-bar">
        <div className="settings-progress-fill" />
      </div>
      <div className="settings-progress-text">
        {message || `${Math.round(progress)}%`}
      </div>
    </div>
  );
};
