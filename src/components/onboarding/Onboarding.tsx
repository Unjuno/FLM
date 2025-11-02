// FLM - オンボーディングコンポーネント
// フロントエンドエージェント (FE) 実装
// FE-009-03: オンボーディング・チュートリアル機能実装

import React, { useState, useEffect } from 'react';
import './Onboarding.css';

/**
 * オンボーディングステップの情報
 */
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  highlight?: {
    selector: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  };
}

/**
 * オンボーディングコンポーネントのプロパティ
 */
interface OnboardingProps {
  /** オンボーディングを閉じるコールバック */
  onComplete: () => void;
  /** オンボーディングをスキップするコールバック */
  onSkip: () => void;
}

/**
 * オンボーディングステップの定義
 */
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'FLMへようこそ！',
    description: 'FLMは、ローカルLLMのAPIを簡単に作成・管理できるツールです。技術知識がなくても、コードを書かずにAPIを作成できます。',
    icon: '👋',
  },
  {
    id: 'create-api',
    title: 'APIの作成',
    description: '「新しいAPIを作成」ボタンをクリックして、OllamaモデルからAPIを作成します。ステップバイステップで簡単に作成できます。',
    icon: '✨',
    highlight: {
      selector: '.home-action-button.primary',
      position: 'right',
    },
  },
  {
    id: 'manage-models',
    title: 'モデルの管理',
    description: '「モデル管理」から利用可能なOllamaモデルを検索・ダウンロードできます。用途に応じて適切なモデルを選択してください。',
    icon: '🤖',
    highlight: {
      selector: '.home-action-button:nth-child(3)',
      position: 'right',
    },
  },
  {
    id: 'api-list',
    title: 'APIの管理',
    description: '「API一覧」から作成済みのAPIを表示・管理できます。起動・停止・削除などの操作ができます。',
    icon: '📋',
    highlight: {
      selector: '.home-action-button:nth-child(2)',
      position: 'right',
    },
  },
  {
    id: 'logs',
    title: 'ログと監視',
    description: '「APIログ」と「パフォーマンス監視」で、APIのリクエストログとパフォーマンスメトリクスを確認できます。',
    icon: '📊',
    highlight: {
      selector: '.home-action-button:nth-child(5)',
      position: 'right',
    },
  },
  {
    id: 'help',
    title: 'ヘルプとサポート',
    description: '「ヘルプ」ページから、よくある質問、使い方ガイド、トラブルシューティング情報を確認できます。',
    icon: '❓',
  },
];

/**
 * オンボーディングコンポーネント
 * 初回ユーザー向けのチュートリアルを提供します
 */
export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // 現在のステップ情報
  const step = ONBOARDING_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  // 次のステップへ進む
  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  // 前のステップに戻る
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // オンボーディングを完了
  const handleComplete = () => {
    setIsVisible(false);
    onComplete();
  };

  // オンボーディングをスキップ
  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  // ハイライト要素の位置を計算
  useEffect(() => {
    if (step.highlight) {
      const element = document.querySelector(step.highlight.selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        const highlight = document.querySelector('.onboarding-highlight');
        if (highlight) {
          (highlight as HTMLElement).style.width = `${rect.width + 20}px`;
          (highlight as HTMLElement).style.height = `${rect.height + 20}px`;
          (highlight as HTMLElement).style.top = `${rect.top - 10 + window.scrollY}px`;
          (highlight as HTMLElement).style.left = `${rect.left - 10 + window.scrollX}px`;
        }
      }
    }
  }, [currentStep, step]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="onboarding-overlay">
      {/* ハイライトエリア（背景を暗くする） */}
      <div className="onboarding-backdrop" />
      
      {/* ハイライト要素（注目させる要素を囲む） */}
      {step.highlight && (
        <div className="onboarding-highlight" />
      )}

      {/* オンボーディングカード */}
      <div className={`onboarding-card ${step.highlight ? `onboarding-${step.highlight.position}` : 'onboarding-center'}`}>
        <div className="onboarding-header">
          <div className="onboarding-icon">{step.icon}</div>
          <button
            className="onboarding-close"
            onClick={handleSkip}
            aria-label="スキップ"
          >
            ✕
          </button>
        </div>

        <div className="onboarding-content">
          <h2 className="onboarding-title">{step.title}</h2>
          <p className="onboarding-description">{step.description}</p>

          {/* プログレスインジケーター */}
          <div className="onboarding-progress">
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                className={`onboarding-progress-dot ${
                  index === currentStep ? 'active' : ''
                } ${index < currentStep ? 'completed' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="onboarding-actions">
          <button
            className="onboarding-button secondary"
            onClick={handleSkip}
          >
            スキップ
          </button>
          <div className="onboarding-nav-buttons">
            {!isFirstStep && (
              <button
                className="onboarding-button secondary"
                onClick={handlePrevious}
              >
                戻る
              </button>
            )}
            <button
              className="onboarding-button primary"
              onClick={handleNext}
            >
              {isLastStep ? '完了' : '次へ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * オンボーディング表示の制御用フック
 * localStorageを使用して初回起動を判定
 */
export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // localStorageからオンボーディング完了フラグを確認
    const onboardingCompleted = localStorage.getItem('flm_onboarding_completed');
    
    if (!onboardingCompleted) {
      // 初回起動の場合はオンボーディングを表示
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('flm_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('flm_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const handleShowOnboarding = () => {
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    handleOnboardingComplete,
    handleOnboardingSkip,
    handleShowOnboarding,
  };
};

