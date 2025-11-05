// ModelDetailModal - ModelDetailModalコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModelDetailModal } from '../../src/components/models/ModelDetailModal';

describe('ModelDetailModal.tsx', () => {
  const mockModel = {
    name: 'llama3:8b',
    description: '高性能な汎用チャットモデル',
    size: 4294967296, // 4GB
    parameters: 8000000000, // 8B
    category: 'chat' as const,
    recommended: true,
    author: 'Meta',
    license: 'MIT',
  };

  describe('基本的なレンダリング', () => {
    it('モデル情報を表示する', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      render(
        <ModelDetailModal
          model={mockModel}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      expect(screen.getByText('llama3:8b')).toBeInTheDocument();
      expect(screen.getByText('高性能な汎用チャットモデル')).toBeInTheDocument();
    });

    it('モデルのサイズを表示する', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      render(
        <ModelDetailModal
          model={mockModel}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      expect(screen.getByText(/4\.00 GB/i)).toBeInTheDocument();
    });

    it('モデルのパラメータ数を表示する', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      render(
        <ModelDetailModal
          model={mockModel}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      expect(screen.getByText(/8\.0B/i)).toBeInTheDocument();
    });
  });

  describe('閉じる機能', () => {
    it('オーバーレイをクリックするとonCloseが呼ばれる', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      const { container } = render(
        <ModelDetailModal
          model={mockModel}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      const overlay = container.querySelector('.model-detail-modal-overlay');
      expect(overlay).toBeInTheDocument();
      
      if (overlay) {
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('閉じるボタンをクリックするとonCloseが呼ばれる', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      const { container } = render(
        <ModelDetailModal
          model={mockModel}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      // 閉じるボタン（✕）を検索
      const closeButton = container.querySelector('.close-button');
      expect(closeButton).toBeInTheDocument();
      
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('ダウンロード機能', () => {
    it('ダウンロードボタンをクリックするとonDownloadが呼ばれる', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      const { container } = render(
        <ModelDetailModal
          model={mockModel}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      // ダウンロードボタンを検索（テキストで検索）
      const downloadButton = screen.getByText(/📥 ダウンロード/i);
      expect(downloadButton).toBeInTheDocument();
      
      fireEvent.click(downloadButton);
      expect(onDownload).toHaveBeenCalledTimes(1);
    });
  });

  describe('カテゴリ表示', () => {
    it('チャットカテゴリを表示する', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      render(
        <ModelDetailModal
          model={{ ...mockModel, category: 'chat' }}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      // より具体的なセレクターを使用（カテゴリラベルのみを検索）
      const categoryLabel = screen.getByText('カテゴリ:');
      expect(categoryLabel).toBeInTheDocument();
      // カテゴリ値が表示されていることを確認
      expect(screen.getByText('チャット')).toBeInTheDocument();
    });

    it('コード生成カテゴリを表示する', () => {
      const onClose = jest.fn();
      const onDownload = jest.fn();
      
      render(
        <ModelDetailModal
          model={{ ...mockModel, category: 'code' }}
          onClose={onClose}
          onDownload={onDownload}
        />
      );
      
      expect(screen.getByText(/コード生成/i)).toBeInTheDocument();
    });
  });
});

