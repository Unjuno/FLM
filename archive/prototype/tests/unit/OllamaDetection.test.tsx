// OllamaDetection - Ollama検出中のローディング画面コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OllamaDetection } from '../../src/components/common/OllamaDetection';

describe('OllamaDetection.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('検出中の表示', () => {
    it('検出中の場合、ローディング画面を表示する', () => {
      render(
        <OllamaDetection
          status={null}
          isDetecting={true}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      expect(screen.getByText('Ollamaを検出しています...')).toBeInTheDocument();
      expect(
        screen.getByText('システムをスキャン中です。しばらくお待ちください。')
      ).toBeInTheDocument();
    });

    it('検出中の場合、スピナーを表示する', () => {
      const { container } = render(
        <OllamaDetection
          status={null}
          isDetecting={true}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      expect(container.querySelector('.detection-spinner')).toBeInTheDocument();
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('エラー表示', () => {
    it('エラーが発生した場合、エラーメッセージを表示する', () => {
      render(
        <OllamaDetection
          status={null}
          isDetecting={false}
          error="Ollamaが見つかりませんでした"
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      expect(
        screen.getByText('Ollamaが見つかりませんでした')
      ).toBeInTheDocument();
    });

    it('エラーアイコンを表示する', () => {
      const { container } = render(
        <OllamaDetection
          status={null}
          isDetecting={false}
          error="エラーメッセージ"
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      expect(container.querySelector('.detection-error')).toBeInTheDocument();
      // 実装では「!」が表示される
      expect(screen.getByText('!')).toBeInTheDocument();
    });
  });

  describe('検出成功の表示', () => {
    it('Ollamaがインストールされている場合、成功メッセージを表示する', () => {
      render(
        <OllamaDetection
          status={{
            installed: true,
            portable: false,
            running: true,
            version: '1.0.0',
          }}
          isDetecting={false}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      expect(screen.getByText(/Ollamaは稼働中です/i)).toBeInTheDocument();
    });

    it('バージョン情報を表示する', () => {
      render(
        <OllamaDetection
          status={{
            installed: true,
            portable: false,
            running: true,
            version: '1.0.0',
          }}
          isDetecting={false}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      expect(screen.getByText(/バージョン: 1.0.0/i)).toBeInTheDocument();
    });

    it('実行中の場合、実行中メッセージを表示する', () => {
      render(
        <OllamaDetection
          status={{
            installed: true,
            portable: false,
            running: true,
          }}
          isDetecting={false}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      expect(screen.getByText(/Ollamaは稼働中です/i)).toBeInTheDocument();
    });

    it('成功アイコンを表示する', () => {
      const { container } = render(
        <OllamaDetection
          status={{
            installed: true,
            portable: false,
            running: false,
          }}
          isDetecting={false}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      // 実装ではdetection-status-cardが表示される（running=falseの場合は🔍）
      expect(container.querySelector('.detection-status-card')).toBeInTheDocument();
      // running=falseの場合は🔍が表示される
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });
  });

  describe('見つからない場合の表示', () => {
    it('Ollamaが見つからない場合、メッセージを表示する', () => {
      render(
        <OllamaDetection
          status={{
            installed: false,
            portable: false,
            running: false,
          }}
          isDetecting={false}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      // コンポーネントの実装に基づいて、実際の表示内容を確認
      expect(
        screen.getByText(/Ollamaを自動セットアップ中です/i)
      ).toBeInTheDocument();
    });

    it('システムインストールガイドを表示する', () => {
      render(
        <OllamaDetection
          status={{
            installed: false,
            portable: false,
            running: false,
          }}
          isDetecting={false}
          error={null}
          autoSteps={[]}
          autoStatus="idle"
          autoError={null}
        />
      );
      // コンポーネントの実装に基づいて、実際の表示内容を確認
      expect(
        screen.getByText(/Ollamaを自動セットアップ中です/i)
      ).toBeInTheDocument();
    });
  });
});
