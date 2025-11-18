// ModelCard - モデルカードコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModelCard } from '../../src/components/models/ModelCard';

describe('ModelCard.tsx', () => {
  const mockModel = {
    name: 'Test Model',
    description: 'This is a test model',
    size: 4096 * 1024 * 1024, // バイト
    parameters: 7000000000, // 7B
    category: 'chat' as const,
    recommended: true,
  };

  const mockOnViewDetails = jest.fn();
  const mockOnDownload = jest.fn();
  const mockOnUseForApi = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('モデルカードを表示する', () => {
      render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      expect(screen.getByText('Test Model')).toBeInTheDocument();
    });

    it('モデル名を表示する', () => {
      render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      expect(screen.getByText('Test Model')).toBeInTheDocument();
    });

    it('モデル説明を表示する', () => {
      render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      expect(screen.getByText('This is a test model')).toBeInTheDocument();
    });

    it('モデルサイズを表示する', () => {
      render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      expect(screen.getByText(/GB|MB/i)).toBeInTheDocument();
    });
  });

  describe('推奨バッジ', () => {
    it('推奨モデルの場合、推奨バッジを表示する', () => {
      render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      const recommendedElements = screen.getAllByText(/推奨|⭐/i);
      expect(recommendedElements.length).toBeGreaterThan(0);
    });
  });

  describe('アクション', () => {
    it('詳細を見るボタンをクリックするとonViewDetailsが呼ばれる', () => {
      const { container } = render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      // より具体的なセレクタを使用
      const detailsButton =
        container.querySelector('.action-button.details') ||
        screen.getAllByRole('button', { name: /詳細を見る|詳細/i })[0];
      expect(detailsButton).toBeTruthy();
      if (detailsButton) {
        fireEvent.click(detailsButton);
        expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
      }
    });

    it('ダウンロードボタンをクリックするとonDownloadが呼ばれる', () => {
      const { container } = render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      // より具体的なセレクタを使用
      const downloadButton =
        container.querySelector('.action-button.download') ||
        screen.getAllByRole('button', {
          name: /モデルを取得|ダウンロード/i,
        })[0];
      expect(downloadButton).toBeTruthy();
      if (downloadButton) {
        fireEvent.click(downloadButton);
        expect(mockOnDownload).toHaveBeenCalledTimes(1);
      }
    });

    it('APIで使用ボタンをクリックするとonUseForApiが呼ばれる', () => {
      const { container } = render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      // より具体的なセレクタを使用
      const useButton =
        container.querySelector('.action-button.use') ||
        screen.getAllByRole('button', { name: /API作成に使用|APIで使用/i })[0];
      expect(useButton).toBeTruthy();
      if (useButton) {
        fireEvent.click(useButton);
        expect(mockOnUseForApi).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('カテゴリ表示', () => {
    it('モデルカテゴリを表示する', () => {
      const { container } = render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      // カテゴリバッジを直接取得
      const categoryBadge = container.querySelector(
        '.category-badge.category-chat'
      );
      expect(categoryBadge).toBeTruthy();
      if (categoryBadge) {
        expect(categoryBadge.textContent).toMatch(/チャット/i);
      }
    });
  });

  describe('パラメータ数表示', () => {
    it('パラメータ数を表示する', () => {
      const { container } = render(
        <ModelCard
          model={mockModel}
          onViewDetails={mockOnViewDetails}
          onDownload={mockOnDownload}
          onUseForApi={mockOnUseForApi}
        />
      );

      // パラメータ数が表示されることを確認（7Bまたは7.0B）
      const paramText = container.textContent || '';
      expect(paramText).toMatch(/7B|7\.0B/i);
    });
  });
});
