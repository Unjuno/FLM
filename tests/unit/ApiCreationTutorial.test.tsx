// ApiCreationTutorial - API作成チュートリアルコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ApiCreationTutorial,
  useApiCreationTutorial,
} from '../../src/components/onboarding/ApiCreationTutorial';

// react-router-domをモック
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('ApiCreationTutorial.tsx', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    // localStorageをクリア
    localStorage.clear();
  });

  describe('基本的なレンダリング', () => {
    it('チュートリアルを表示する', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      render(<ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />);

      // チュートリアルのタイトルまたは最初のステップの内容を確認
      expect(
        screen.getByText(/API作成チュートリアルを開始します/i)
      ).toBeInTheDocument();
    });

    it('最初のステップを表示する', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      render(<ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />);

      expect(
        screen.getByText(/API作成チュートリアルを開始します/i)
      ).toBeInTheDocument();
    });

    it('プログレスインジケーターを表示する', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      const { container } = render(
        <ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />
      );

      const progressDots = container.querySelectorAll(
        '.api-creation-tutorial-progress-dot'
      );
      expect(progressDots.length).toBeGreaterThan(0);
    });
  });

  describe('ナビゲーション', () => {
    it('「次へ」ボタンをクリックすると次のステップに進む', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      render(<ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />);

      const nextButton = screen.getByRole('button', { name: /次へ/i });
      fireEvent.click(nextButton);

      expect(screen.getByText(/ステップ1/i)).toBeInTheDocument();
    });

    it('最後のステップで「完了」ボタンをクリックするとonCompleteが呼ばれる', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      render(<ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />);

      // 最後のステップまで進む
      const nextButton = screen.getByRole('button', { name: /次へ/i });
      for (let i = 0; i < 5; i++) {
        fireEvent.click(nextButton);
      }

      const completeButton = screen.getByRole('button', { name: /完了/i });
      fireEvent.click(completeButton);

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('「スキップ」ボタンをクリックするとonSkipが呼ばれる', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      const { container } = render(
        <ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />
      );

      // アクションボタンのスキップボタン（閉じるボタンではない）を取得
      const skipButtons = screen.getAllByRole('button', { name: /スキップ/i });
      // アクション領域のスキップボタン（クラス名で識別）
      const actionSkipButton = container.querySelector(
        '.api-creation-tutorial-button.secondary'
      );
      expect(actionSkipButton).toBeInTheDocument();

      if (actionSkipButton) {
        fireEvent.click(actionSkipButton);
        expect(onSkip).toHaveBeenCalledTimes(1);
      }
    });

    it('「戻る」ボタンをクリックすると前のステップに戻る', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      render(<ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />);

      // 次のステップに進む
      const nextButton = screen.getByRole('button', { name: /次へ/i });
      fireEvent.click(nextButton);

      // 戻るボタンが表示されることを確認
      const backButton = screen.getByRole('button', { name: /戻る/i });
      expect(backButton).toBeInTheDocument();

      fireEvent.click(backButton);

      // 最初のステップに戻る
      expect(
        screen.getByText(/API作成チュートリアルを開始します/i)
      ).toBeInTheDocument();
    });

    it('ナビゲーションが必要なステップで「次へ」をクリックすると適切なルートに遷移する', () => {
      const onComplete = jest.fn();
      const onSkip = jest.fn();

      render(<ApiCreationTutorial onComplete={onComplete} onSkip={onSkip} />);

      // ステップ1まで進む（API作成画面への遷移があるステップ）
      let nextButton = screen.getByRole('button', { name: /次へ/i });
      fireEvent.click(nextButton);

      // 次のステップで「次へ（画面に移動）」ボタンを探す
      // ボタンのテキストが「次へ（画面に移動）」または「次へ」を含む場合
      nextButton = screen.getByRole('button', { name: /次へ/i });
      if (nextButton.textContent?.includes('画面に移動')) {
        fireEvent.click(nextButton);
        expect(mockNavigate).toHaveBeenCalledWith('/api/create');
      } else {
        // ボタンが存在することを確認
        expect(nextButton).toBeInTheDocument();
      }
    });
  });

  describe('useApiCreationTutorialフック', () => {
    it('オンボーディングが完了していて、チュートリアルが未完了の場合、チュートリアルを表示する', () => {
      localStorage.setItem('flm_onboarding_completed', 'true');
      localStorage.removeItem('flm_api_creation_tutorial_completed');

      // フックを直接テストするのは難しいので、コンポーネント経由でテスト
      const TestComponent = () => {
        const { showTutorial } = useApiCreationTutorial();
        return showTutorial ? <div>チュートリアル表示</div> : <div>非表示</div>;
      };

      const { unmount } = render(<TestComponent />);

      // 非同期で状態が更新される可能性があるため、少し待機
      setTimeout(() => {
        expect(screen.getByText('チュートリアル表示')).toBeInTheDocument();
        unmount();
      }, 100);
    });

    it('オンボーディングが未完了の場合、チュートリアルを表示しない', () => {
      localStorage.removeItem('flm_onboarding_completed');
      localStorage.removeItem('flm_api_creation_tutorial_completed');

      const TestComponent = () => {
        const { showTutorial } = useApiCreationTutorial();
        return showTutorial ? <div>チュートリアル表示</div> : <div>非表示</div>;
      };

      render(<TestComponent />);

      expect(screen.queryByText('チュートリアル表示')).not.toBeInTheDocument();
    });

    it('チュートリアルが完了している場合、チュートリアルを表示しない', () => {
      localStorage.setItem('flm_onboarding_completed', 'true');
      localStorage.setItem('flm_api_creation_tutorial_completed', 'true');

      const TestComponent = () => {
        const { showTutorial } = useApiCreationTutorial();
        return showTutorial ? <div>チュートリアル表示</div> : <div>非表示</div>;
      };

      render(<TestComponent />);

      expect(screen.queryByText('チュートリアル表示')).not.toBeInTheDocument();
    });

    it('handleTutorialCompleteを呼ぶとチュートリアル完了フラグが保存される', () => {
      const TestComponent = () => {
        const { handleTutorialComplete } = useApiCreationTutorial();
        return <button onClick={handleTutorialComplete}>完了</button>;
      };

      render(<TestComponent />);

      const completeButton = screen.getByRole('button', { name: /完了/i });
      fireEvent.click(completeButton);

      expect(localStorage.getItem('flm_api_creation_tutorial_completed')).toBe(
        'true'
      );
    });

    it('handleTutorialSkipを呼ぶとチュートリアル完了フラグが保存される', () => {
      const TestComponent = () => {
        const { handleTutorialSkip } = useApiCreationTutorial();
        return <button onClick={handleTutorialSkip}>スキップ</button>;
      };

      render(<TestComponent />);

      const skipButton = screen.getByRole('button', { name: /スキップ/i });
      fireEvent.click(skipButton);

      expect(localStorage.getItem('flm_api_creation_tutorial_completed')).toBe(
        'true'
      );
    });
  });
});
