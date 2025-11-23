// ConfirmDialog - ConfirmDialogコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';

describe('ConfirmDialog.tsx', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnClose.mockClear();
  });

  describe('基本的なレンダリング', () => {
    it('ダイアログが開いている場合、表示される', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
    });

    it('ダイアログが閉じている場合、表示されない', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={false}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('デフォルトタイトルが表示される', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByRole('heading', { name: '確認' })).toBeInTheDocument();
    });

    it('カスタムタイトルが表示される', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="カスタムタイトル"
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByText('カスタムタイトル')).toBeInTheDocument();
    });
  });

  describe('ボタンの動作', () => {
    it('確認ボタンをクリックするとonConfirmが呼ばれる', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /確認/i });
      fireEvent.click(confirmButton);
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('キャンセルボタンをクリックするとonCancelが呼ばれる', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
      fireEvent.click(cancelButton);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('カスタムラベルが表示される', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          confirmLabel="削除"
          cancelLabel="やめる"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /削除/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /やめる/i })
      ).toBeInTheDocument();
    });
  });

  describe('ESCキーとオーバーレイクリック', () => {
    it('ESCキーを押すとonCloseが呼ばれる（onCloseが提供されている場合）', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('ESCキーを押すとonCancelが呼ばれる（onCloseが提供されていない場合）', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('スナップショットテスト', () => {
    it('基本的な確認ダイアログのスナップショット', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('カスタムタイトルとラベルのスナップショット', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="削除確認"
          message="この操作は取り消せません"
          confirmLabel="削除"
          cancelLabel="キャンセル"
          confirmVariant="danger"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('primaryバリアントのスナップショット', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          confirmVariant="primary"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('dangerバリアントのスナップショット', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          message="テストメッセージ"
          confirmVariant="danger"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(container).toMatchSnapshot();
    });
  });
});
