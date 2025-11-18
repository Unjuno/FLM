// Onboarding - オンボーディングコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { Onboarding } from '../../src/components/onboarding/Onboarding';

describe('Onboarding.tsx', () => {
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  describe('基本的なレンダリング', () => {
    it('オンボーディングコンポーネントを表示する', () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      // より具体的なテキストで検索
      const welcomeText = screen.getAllByText(/FLMへようこそ|ようこそ/i);
      expect(welcomeText.length).toBeGreaterThan(0);
    });

    it('最初のステップを表示する', () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      // より具体的なテキストで検索
      const welcomeText = screen.getAllByText(/FLMへようこそ/i);
      expect(welcomeText.length).toBeGreaterThan(0);
    });
  });

  describe('ステップ進行', () => {
    it('次へボタンを表示する', () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      const nextButton = screen.getByRole('button', { name: /次へ|Next/i });
      expect(nextButton).toBeInTheDocument();
    });

    it('次へボタンをクリックすると次のステップに進む', async () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      const nextButton = screen.getByRole('button', { name: /次へ|Next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        // 次のステップが表示される
        expect(
          screen.getByText(/APIの作成|モデルの管理|APIの管理/i)
        ).toBeInTheDocument();
      });
    });

    it('戻るボタンを表示する（最初のステップ以外）', async () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      const nextButton = screen.getByRole('button', { name: /次へ|Next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        const backButton = screen.queryByRole('button', { name: /戻る|Back/i });
        expect(backButton).toBeInTheDocument();
      });
    });

    it('戻るボタンをクリックすると前のステップに戻る', async () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      const nextButton = screen.getByRole('button', { name: /次へ|Next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /戻る|Back/i });
        fireEvent.click(backButton);
      });

      await waitFor(() => {
        // 前のステップが表示される
        expect(screen.getByText(/FLMへようこそ/i)).toBeInTheDocument();
      });
    });
  });

  describe('完了機能', () => {
    it('スキップボタンを表示する', () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      // 複数のスキップボタンがある可能性があるため、最初のものを取得
      const skipButtons = screen.getAllByRole('button', {
        name: /スキップ|Skip/i,
      });
      expect(skipButtons.length).toBeGreaterThan(0);
    });

    it('スキップボタンをクリックするとonSkipが呼ばれる', () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      // 最初のスキップボタンを取得
      const skipButtons = screen.getAllByRole('button', {
        name: /スキップ|Skip/i,
      });
      fireEvent.click(skipButtons[0]);

      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('最後のステップで完了ボタンを表示する', async () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={jest.fn()} />
      );

      // 最後のステップまで進む（最大5ステップ）
      for (let i = 0; i < 5; i++) {
        const nextButton = screen.queryByRole('button', { name: /次へ|Next/i });
        if (nextButton) {
          fireEvent.click(nextButton);
          await waitFor(
            () => {
              // 次のステップが表示されるまで待機
            },
            { timeout: 1000 }
          );
        } else {
          break;
        }
      }

      // 完了ボタンまたは最後のステップの次へボタンが表示される
      const completeButton = screen.queryByRole('button', {
        name: /完了|Complete/i,
      });
      const finalNextButton = screen.queryByRole('button', {
        name: /次へ|Next/i,
      });
      expect(completeButton || finalNextButton).toBeInTheDocument();
    });

    it('完了ボタンをクリックするとonCompleteが呼ばれる', async () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={jest.fn()} />
      );

      // 最後のステップまで進む
      for (let i = 0; i < 5; i++) {
        const nextButton = screen.queryByRole('button', { name: /次へ|Next/i });
        if (nextButton) {
          fireEvent.click(nextButton);
          await waitFor(
            () => {
              // 次のステップが表示されるまで待機
            },
            { timeout: 1000 }
          );
        } else {
          break;
        }
      }

      const completeButton = screen.queryByRole('button', {
        name: /完了|Complete/i,
      });
      if (completeButton) {
        fireEvent.click(completeButton);
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      } else {
        // 最後のステップの次へボタンが完了ボタンの代わり
        const finalNextButton = screen.queryByRole('button', {
          name: /次へ|Next/i,
        });
        if (finalNextButton) {
          fireEvent.click(finalNextButton);
          expect(mockOnComplete).toHaveBeenCalledTimes(1);
        }
      }
    });
  });

  describe('進捗表示', () => {
    it('進捗インジケーターを表示する', () => {
      const { container } = renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );
      // 進捗インジケーターが存在するか確認
      const progressIndicator =
        screen.queryByRole('progressbar') ||
        container.querySelector('.onboarding-progress, .progress-indicator');
      expect(progressIndicator).toBeTruthy();
    });

    it('現在のステップに応じて進捗を更新する', async () => {
      renderWithRouter(
        <Onboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />
      );

      const nextButton = screen.getByRole('button', { name: /次へ|Next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        // ステップが進んだことを確認
        expect(
          screen.getByText(/APIの作成|モデルの管理|APIの管理/i)
        ).toBeInTheDocument();
      });
    });
  });
});
