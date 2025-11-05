// Input - Inputコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Input } from '../../src/components/forms/Input';

describe('Input.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('ラベルと入力フィールドを表示する', () => {
      render(<Input label="テストラベル" />);
      expect(screen.getByLabelText('テストラベル')).toBeInTheDocument();
    });

    it('ラベルなしでレンダリングできる', () => {
      render(<Input placeholder="入力してください" />);
      expect(screen.getByPlaceholderText('入力してください')).toBeInTheDocument();
    });

    it('プレースホルダーを表示する', () => {
      render(<Input placeholder="プレースホルダー" />);
      expect(screen.getByPlaceholderText('プレースホルダー')).toBeInTheDocument();
    });
  });

  describe('入力の動作', () => {
    it('テキスト入力が動作する', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'テスト');

      expect(handleChange).toHaveBeenCalled();
    });

    it('入力値が正しく反映される', async () => {
      const user = userEvent.setup();
      render(<Input defaultValue="初期値" />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('初期値');

      await user.clear(input);
      await user.type(input, '新しい値');

      expect(input.value).toBe('新しい値');
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーメッセージを表示する', () => {
      render(<Input label="テスト入力" error="エラーメッセージ" />);
      expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    });

    it('エラー時はaria-invalidが設定される', () => {
      render(<Input error="エラー" id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('エラー時はヘルプテキストを表示しない', () => {
      render(<Input error="エラー" helpText="ヘルプ" />);
      expect(screen.getByText('エラー')).toBeInTheDocument();
      expect(screen.queryByText('ヘルプ')).not.toBeInTheDocument();
    });
  });

  describe('ヘルプテキスト', () => {
    it('ヘルプテキストを表示する', () => {
      render(<Input helpText="ヘルプテキスト" />);
      expect(screen.getByText('ヘルプテキスト')).toBeInTheDocument();
    });
  });

  describe('無効化状態', () => {
    it('disabled状態でレンダリングできる', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('readOnly状態でレンダリングできる', () => {
      render(<Input readOnly />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('必須マーカー', () => {
    it('必須マーカーを表示する', () => {
      render(<Input label="ラベル" required />);
      const label = screen.getByText('ラベル');
      expect(label.querySelector('.form-input-required')).toBeInTheDocument();
    });

    it('必須時はaria-requiredが設定される', () => {
      render(<Input required />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('サイズ', () => {
    it('smallサイズでレンダリングできる', () => {
      render(<Input size="small" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('form-input-small');
    });

    it('largeサイズでレンダリングできる', () => {
      render(<Input size="large" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('form-input-large');
    });
  });

  describe('フル幅', () => {
    it('fullWidthでレンダリングできる', () => {
      const { container } = render(<Input fullWidth />);
      const wrapper = container.querySelector('.form-input-wrapper-full-width');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('成功状態', () => {
    it('success状態でレンダリングできる', () => {
      render(<Input success />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('form-input-success');
    });
  });

  describe('アクセシビリティ', () => {
    it('aria-describedby属性が設定される（エラー時）', () => {
      render(<Input error="エラー" id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
    });

    it('aria-describedby属性が設定される（ヘルプテキストがある場合）', () => {
      render(<Input helpText="ヘルプ" id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'test-input-help');
    });
  });
});

