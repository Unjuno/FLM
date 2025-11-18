// ApiCreationTutorial - API作成チュートリアルコンポーネント
// オンボーディング完了後、実際にAPIを作成する手順を案内

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ApiCreationTutorial.css';

/**
 * チュートリアルステップの情報
 */
interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action?: {
    type: 'navigate' | 'highlight';
    target: string;
    route?: string;
  };
}

/**
 * API作成チュートリアルのステップ定義
 */
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'start',
    title: 'API作成チュートリアルを開始します',
    description:
      'このチュートリアルでは、5分以内で最初のAPIを作成する手順をご案内します。',
  },
  {
    id: 'step1',
    title: 'ステップ1: 「新しいAPIを作成」をクリック',
    description:
      'ホーム画面の「新しいAPIを作成」ボタンをクリックして、API作成画面に進みます。',
    action: {
      type: 'navigate',
      target: '新しいAPIを作成',
      route: '/api/create',
    },
  },
  {
    id: 'step2',
    title: 'ステップ2: モデルを選択',
    description:
      '利用可能なモデルから、用途に応じたモデルを選択します。初心者の方は推奨モデルを選択してください。',
  },
  {
    id: 'step3',
    title: 'ステップ3: API設定を入力',
    description:
      'API名（オプション）、ポート番号、認証設定を入力します。デフォルト設定で問題ありません。',
  },
  {
    id: 'step4',
    title: 'ステップ4: 「作成」ボタンをクリック',
    description:
      '設定を確認して「作成」ボタンをクリックします。API作成には数秒かかります。',
  },
  {
    id: 'complete',
    title: '完了！APIが作成されました',
    description:
      'おめでとうございます！APIが正常に作成されました。エンドポイントURLとAPIキーを確認して、APIを利用できます。',
  },
];

/**
 * API作成チュートリアルのプロパティ
 */
interface ApiCreationTutorialProps {
  /** チュートリアルを閉じるコールバック */
  onComplete: () => void;
  /** チュートリアルをスキップするコールバック */
  onSkip: () => void;
}

/**
 * API作成チュートリアルコンポーネント
 * オンボーディング完了後、実際にAPIを作成する手順を案内
 */
export const ApiCreationTutorial: React.FC<ApiCreationTutorialProps> = ({
  onComplete,
  onSkip,
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  // 次のステップへ進む
  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      // ナビゲーションが必要なステップの場合
      if (step.action?.type === 'navigate' && step.action.route) {
        navigate(step.action.route);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  // 前のステップに戻る
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // チュートリアルを完了
  const handleComplete = () => {
    setIsVisible(false);
    // チュートリアル完了フラグを保存
    localStorage.setItem('flm_api_creation_tutorial_completed', 'true');
    onComplete();
  };

  // チュートリアルをスキップ
  const handleSkip = () => {
    setIsVisible(false);
    localStorage.setItem('flm_api_creation_tutorial_completed', 'true');
    onSkip();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="api-creation-tutorial-overlay">
      <div className="api-creation-tutorial-backdrop" />

      <div className="api-creation-tutorial-card">
        <div className="api-creation-tutorial-header">
          <div className="api-creation-tutorial-icon">📚</div>
          <button
            className="api-creation-tutorial-close"
            onClick={handleSkip}
            aria-label="スキップ"
          >
            ✕
          </button>
        </div>

        <div className="api-creation-tutorial-content">
          <h2 className="api-creation-tutorial-title">{step.title}</h2>
          <p className="api-creation-tutorial-description">
            {step.description}
          </p>

          {/* プログレスインジケーター */}
          <div className="api-creation-tutorial-progress">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`api-creation-tutorial-progress-dot ${
                  index === currentStep ? 'active' : ''
                } ${index < currentStep ? 'completed' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="api-creation-tutorial-actions">
          <button
            className="api-creation-tutorial-button secondary"
            onClick={handleSkip}
          >
            スキップ
          </button>
          <div className="api-creation-tutorial-nav-buttons">
            {!isFirstStep && (
              <button
                className="api-creation-tutorial-button secondary"
                onClick={handlePrevious}
              >
                戻る
              </button>
            )}
            <button
              className="api-creation-tutorial-button primary"
              onClick={handleNext}
            >
              {isLastStep
                ? '完了'
                : step.action?.type === 'navigate'
                  ? '次へ（画面に移動）'
                  : '次へ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * API作成チュートリアル表示の制御用フック
 */
export const useApiCreationTutorial = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // オンボーディングが完了しているか確認
    const onboardingCompleted = localStorage.getItem(
      'flm_onboarding_completed'
    );
    const tutorialCompleted = localStorage.getItem(
      'flm_api_creation_tutorial_completed'
    );

    // オンボーディングは完了しているが、チュートリアルは未完了の場合
    if (onboardingCompleted && !tutorialCompleted) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialComplete = () => {
    localStorage.setItem('flm_api_creation_tutorial_completed', 'true');
    setShowTutorial(false);
  };

  const handleTutorialSkip = () => {
    localStorage.setItem('flm_api_creation_tutorial_completed', 'true');
    setShowTutorial(false);
  };

  const handleShowTutorial = () => {
    setShowTutorial(true);
  };

  return {
    showTutorial,
    handleTutorialComplete,
    handleTutorialSkip,
    handleShowTutorial,
  };
};
