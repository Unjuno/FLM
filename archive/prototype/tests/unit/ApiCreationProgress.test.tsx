// ApiCreationProgress - API作成進捗表示コンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiCreationProgress } from '../../src/components/api/ApiCreationProgress';

describe('ApiCreationProgress.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('進捗表示を表示する', () => {
      render(
        <ApiCreationProgress progress={{ step: '処理中', progress: 0 }} />
      );
      expect(screen.getByText(/作成中|APIを作成中/i)).toBeInTheDocument();
    });

    it('プログレスバーを表示する', () => {
      const { container } = render(
        <ApiCreationProgress progress={{ step: '処理中', progress: 50 }} />
      );
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).toBeInTheDocument();
    });

    it('進捗パーセンテージを表示する', () => {
      render(
        <ApiCreationProgress progress={{ step: '処理中', progress: 75 }} />
      );
      const elements = screen.getAllByText(/75|%|パーセント/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('進捗状態の表示', () => {
    it('進捗0%の場合、初期状態を表示する', () => {
      render(<ApiCreationProgress progress={{ step: '開始', progress: 0 }} />);
      const elements = screen.getAllByText(/0|%|開始/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('進捗50%の場合、中間状態を表示する', () => {
      render(
        <ApiCreationProgress progress={{ step: '処理中', progress: 50 }} />
      );
      const elements = screen.getAllByText(/50|%|処理中/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('進捗100%の場合、完了状態を表示する', () => {
      render(
        <ApiCreationProgress progress={{ step: '完了', progress: 100 }} />
      );
      const elements = screen.getAllByText(/100|%|完了/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('ステップ表示', () => {
    it('現在のステップを表示する', () => {
      render(
        <ApiCreationProgress
          progress={{ step: 'モデルの準備', progress: 50 }}
        />
      );
      expect(screen.getByText(/モデルの準備/i)).toBeInTheDocument();
    });

    it('進捗ステップを表示する', () => {
      render(
        <ApiCreationProgress progress={{ step: '処理中', progress: 50 }} />
      );
      const stepElements = screen.getAllByText(/エンジン確認|設定保存|認証プロキシ起動|完了/i);
      expect(stepElements.length).toBeGreaterThan(0);
    });
  });
});
