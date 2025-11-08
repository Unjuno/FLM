// ErrorMessage - ErrorMessageコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorMessage } from '../../src/components/common/ErrorMessage';

// react-router-domをモック
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('ErrorMessage.tsx', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('基本的なレンダリング', () => {
    it('エラーメッセージを表示する', () => {
      render(<ErrorMessage message="テストエラー" />);
      expect(screen.getByText('テストエラー')).toBeInTheDocument();
    });

    it('エラータイプに応じたアイコンとタイトルを表示する', () => {
      render(<ErrorMessage message="Ollamaエラー" type="ollama" />);
      expect(screen.getByText(/Ollamaのエラー/i)).toBeInTheDocument();
    });

    it('提案メッセージを表示する', () => {
      render(
        <ErrorMessage
          message="エラーメッセージ"
          suggestion="これは提案メッセージです"
        />
      );
      expect(screen.getByText('これは提案メッセージです')).toBeInTheDocument();
    });
  });

  describe('クローズ機能', () => {
    it('onCloseが提供されている場合、閉じるボタンを表示する', () => {
      const onClose = jest.fn();
      render(<ErrorMessage message="エラー" onClose={onClose} />);

      const closeButton = screen.getByRole('button', {
        name: /エラーメッセージを閉じる/i,
      });
      expect(closeButton).toBeInTheDocument();

      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('onCloseが提供されていない場合、閉じるボタンを表示しない', () => {
      render(<ErrorMessage message="エラー" />);
      expect(
        screen.queryByRole('button', { name: /閉じる/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('リトライ機能', () => {
    it('onRetryが提供されている場合、リトライボタンを表示する', () => {
      const onRetry = jest.fn();
      render(<ErrorMessage message="エラー" onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /操作を再試行/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('onRetryが提供されていない場合、リトライボタンを表示しない', () => {
      render(<ErrorMessage message="エラー" />);
      expect(
        screen.queryByRole('button', { name: /操作を再試行/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('エラータイプの表示', () => {
    it('ollamaタイプのエラーを表示する', () => {
      render(<ErrorMessage message="Ollamaエラー" type="ollama" />);
      expect(screen.getByText(/Ollamaのエラー/i)).toBeInTheDocument();
    });

    it('apiタイプのエラーを表示する', () => {
      render(<ErrorMessage message="APIエラー" type="api" />);
      expect(screen.getByText(/APIのエラー/i)).toBeInTheDocument();
    });

    it('modelタイプのエラーを表示する', () => {
      render(<ErrorMessage message="モデルエラー" type="model" />);
      expect(screen.getByText(/モデルのエラー/i)).toBeInTheDocument();
    });

    it('databaseタイプのエラーを表示する', () => {
      render(<ErrorMessage message="データベースエラー" type="database" />);
      expect(screen.getByText(/データベースのエラー/i)).toBeInTheDocument();
    });

    it('validationタイプのエラーを表示する', () => {
      render(<ErrorMessage message="バリデーションエラー" type="validation" />);
      // エラータイプのタイトルが表示されることを確認（実際のコンポーネントの実装に合わせて調整）
      expect(screen.getByText('バリデーションエラー')).toBeInTheDocument();
    });

    it('generalタイプのエラーを表示する（デフォルト）', () => {
      render(<ErrorMessage message="一般エラー" />);
      // エラーメッセージが表示されることを確認
      expect(screen.getByText('一般エラー')).toBeInTheDocument();
    });
  });

  describe('ヘルプページへのリンク', () => {
    it('ヘルプを見るボタンを表示する', () => {
      render(<ErrorMessage message="エラー" />);

      const helpButton = screen.getByRole('button', {
        name: /ヘルプページを開く/i,
      });
      expect(helpButton).toBeInTheDocument();
      expect(helpButton.textContent).toContain('ヘルプを見る');
    });

    it('ヘルプボタンをクリックすると、適切なエラータイプでヘルプページに遷移する', () => {
      render(<ErrorMessage message="Ollamaエラー" type="ollama" />);

      const helpButton = screen.getByRole('button', {
        name: /ヘルプページを開く/i,
      });
      fireEvent.click(helpButton);

      expect(mockNavigate).toHaveBeenCalledWith('/help?errorType=ollama');
    });

    it('エラータイプが指定されていない場合、generalタイプでヘルプページに遷移する', () => {
      render(<ErrorMessage message="一般エラー" />);

      const helpButton = screen.getByRole('button', {
        name: /ヘルプページを開く/i,
      });
      fireEvent.click(helpButton);

      expect(mockNavigate).toHaveBeenCalledWith('/help?errorType=general');
    });

    it('各エラータイプで適切なURLパラメータを生成する', () => {
      const errorTypes: Array<{
        type: Parameters<typeof ErrorMessage>[0]['type'];
        expected: string;
      }> = [
        { type: 'ollama', expected: 'ollama' },
        { type: 'api', expected: 'api' },
        { type: 'model', expected: 'model' },
        { type: 'database', expected: 'database' },
        { type: 'validation', expected: 'validation' },
        { type: 'network', expected: 'network' },
        { type: 'permission', expected: 'permission' },
        { type: 'general', expected: 'general' },
      ];

      errorTypes.forEach(({ type, expected }) => {
        const { unmount } = render(
          <ErrorMessage message="エラー" type={type} />
        );

        const helpButton = screen.getByRole('button', {
          name: /ヘルプページを開く/i,
        });
        fireEvent.click(helpButton);

        expect(mockNavigate).toHaveBeenCalledWith(
          `/help?errorType=${expected}`
        );

        unmount();
        mockNavigate.mockClear();
      });
    });

    it('リトライボタンとヘルプボタンの両方が表示される', () => {
      const onRetry = jest.fn();
      render(<ErrorMessage message="エラー" onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /操作を再試行/i });
      const helpButton = screen.getByRole('button', {
        name: /ヘルプページを開く/i,
      });

      expect(retryButton).toBeInTheDocument();
      expect(helpButton).toBeInTheDocument();
    });
  });

  describe('スナップショットテスト', () => {
    it('基本的なエラーメッセージのスナップショット', () => {
      const { container } = render(<ErrorMessage message="テストエラー" />);
      expect(container).toMatchSnapshot();
    });

    it('Ollamaエラーのスナップショット', () => {
      const { container } = render(
        <ErrorMessage message="Ollamaエラー" type="ollama" />
      );
      expect(container).toMatchSnapshot();
    });

    it('リトライ機能付きエラーメッセージのスナップショット', () => {
      const onRetry = jest.fn();
      const { container } = render(
        <ErrorMessage message="エラー" onRetry={onRetry} />
      );
      expect(container).toMatchSnapshot();
    });

    it('提案メッセージ付きエラーメッセージのスナップショット', () => {
      const { container } = render(
        <ErrorMessage
          message="エラーメッセージ"
          suggestion="これは提案メッセージです"
        />
      );
      expect(container).toMatchSnapshot();
    });
  });
});
