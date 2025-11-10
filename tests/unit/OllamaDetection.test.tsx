// OllamaDetection - Ollama検出中のローディング画面コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OllamaDetection } from '../../src/components/common/OllamaDetection';

// useOllamaDetectionをモック
const mockUseOllamaDetection = jest.fn();
jest.mock('../../src/hooks/useOllama', () => ({
  useOllamaDetection: () => mockUseOllamaDetection(),
}));

describe('OllamaDetection.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('検出中の表示', () => {
    it('検出中の場合、ローディング画面を表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: null,
        isDetecting: true,
        error: null,
      });

      render(<OllamaDetection />);
      expect(screen.getByText('Ollamaを検出しています...')).toBeInTheDocument();
      expect(
        screen.getByText('システムをスキャン中です。しばらくお待ちください。')
      ).toBeInTheDocument();
    });

    it('検出中の場合、スピナーを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: null,
        isDetecting: true,
        error: null,
      });

      const { container } = render(<OllamaDetection />);
      expect(container.querySelector('.detection-spinner')).toBeInTheDocument();
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('エラー表示', () => {
    it('エラーが発生した場合、エラーメッセージを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: null,
        isDetecting: false,
        error: 'Ollamaが見つかりませんでした',
      });

      render(<OllamaDetection />);
      expect(
        screen.getByText('Ollamaが見つかりませんでした')
      ).toBeInTheDocument();
    });

    it('エラーアイコンを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: null,
        isDetecting: false,
        error: 'エラーメッセージ',
      });

      const { container } = render(<OllamaDetection />);
      expect(container.querySelector('.detection-error')).toBeInTheDocument();
      // 実装では「!」が表示される
      expect(screen.getByText('!')).toBeInTheDocument();
    });
  });

  describe('検出成功の表示', () => {
    it('Ollamaがインストールされている場合、成功メッセージを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: {
          installed: true,
          portable: false,
          running: true,
          version: '1.0.0',
        },
        isDetecting: false,
        error: null,
      });

      render(<OllamaDetection />);
      expect(screen.getByText('Ollamaが見つかりました')).toBeInTheDocument();
    });

    it('バージョン情報を表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: {
          installed: true,
          portable: false,
          running: true,
          version: '1.0.0',
        },
        isDetecting: false,
        error: null,
      });

      render(<OllamaDetection />);
      expect(screen.getByText(/バージョン: 1.0.0/i)).toBeInTheDocument();
    });

    it('実行中の場合、実行中メッセージを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: {
          installed: true,
          portable: false,
          running: true,
        },
        isDetecting: false,
        error: null,
      });

      render(<OllamaDetection />);
      expect(screen.getByText(/実行中: はい/i)).toBeInTheDocument();
    });

    it('成功アイコンを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: {
          installed: true,
          portable: false,
          running: false,
        },
        isDetecting: false,
        error: null,
      });

      const { container } = render(<OllamaDetection />);
      // 実装ではdetection-status-cardが表示される（running=falseの場合は🔍）
      expect(container.querySelector('.detection-status-card')).toBeInTheDocument();
      // running=falseの場合は🔍が表示される
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });
  });

  describe('見つからない場合の表示', () => {
    it('Ollamaが見つからない場合、メッセージを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: {
          installed: false,
          portable: false,
          running: false,
        },
        isDetecting: false,
        error: null,
      });

      render(<OllamaDetection />);
      expect(
        screen.getByText('Ollamaが見つかりませんでした')
      ).toBeInTheDocument();
      expect(
        screen.getByText('ダウンロードしてインストールしてください')
      ).toBeInTheDocument();
    });

    it('システムインストールガイドを表示する', () => {
      mockUseOllamaDetection.mockReturnValue({
        status: {
          installed: false,
          portable: false,
          running: false,
        },
        isDetecting: false,
        error: null,
      });

      render(<OllamaDetection />);
      expect(
        screen.getByText(/システムにインストールする場合/i)
      ).toBeInTheDocument();
    });
  });
});
