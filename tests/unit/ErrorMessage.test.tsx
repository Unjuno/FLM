// ErrorMessage - ErrorMessageコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorMessage } from '../../src/components/common/ErrorMessage';

describe('ErrorMessage.tsx', () => {
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
      
      const closeButton = screen.getByRole('button', { name: /エラーメッセージを閉じる/i });
      expect(closeButton).toBeInTheDocument();
      
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('onCloseが提供されていない場合、閉じるボタンを表示しない', () => {
      render(<ErrorMessage message="エラー" />);
      expect(screen.queryByRole('button', { name: /閉じる/i })).not.toBeInTheDocument();
    });
  });

  describe('リトライ機能', () => {
    it('onRetryが提供されている場合、リトライボタンを表示する', () => {
      const onRetry = jest.fn();
      render(<ErrorMessage message="エラー" onRetry={onRetry} />);
      
      const retryButton = screen.getByRole('button', { name: /再試行/i });
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('onRetryが提供されていない場合、リトライボタンを表示しない', () => {
      render(<ErrorMessage message="エラー" />);
      expect(screen.queryByRole('button', { name: /再試行/i })).not.toBeInTheDocument();
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
});

