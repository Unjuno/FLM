// Textarea - Textareaコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../../src/components/forms/Textarea';

describe('Textarea.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('ラベルとテキストエリアを表示する', () => {
      render(<Textarea label="テストラベル" />);
      expect(screen.getByLabelText('テストラベル')).toBeInTheDocument();
    });

    it('プレースホルダーを表示する', () => {
      render(<Textarea placeholder="プレースホルダー" />);
      expect(
        screen.getByPlaceholderText('プレースホルダー')
      ).toBeInTheDocument();
    });
  });

  describe('入力の動作', () => {
    it('テキスト入力が動作する', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      render(<Textarea onChange={handleChange} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'テスト');

      expect(handleChange).toHaveBeenCalled();
    });

    it('入力値が正しく反映される', async () => {
      const user = userEvent.setup();
      render(<Textarea defaultValue="初期値" />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('初期値');

      await user.clear(textarea);
      await user.type(textarea, '新しい値');

      expect(textarea.value).toBe('新しい値');
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーメッセージを表示する', () => {
      render(<Textarea label="テスト" error="エラーメッセージ" />);
      expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    });

    it('エラー時はaria-invalidが設定される', () => {
      render(<Textarea error="エラー" id="test-textarea" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('無効化状態', () => {
    it('disabled状態でレンダリングできる', () => {
      render(<Textarea disabled />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('readOnly状態でレンダリングできる', () => {
      render(<Textarea readOnly />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('readonly');
    });
  });

  describe('リサイズ', () => {
    it('デフォルトでリサイズ可能', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toHaveStyle({ resize: 'none' });
    });

    it('リサイズ不可に設定できる', () => {
      render(<Textarea resizable={false} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('form-textarea-no-resize');
    });
  });
});
