// Checkbox - Checkboxコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../../src/components/forms/Checkbox';

describe('Checkbox.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('ラベルとチェックボックスを表示する', () => {
      render(<Checkbox label="テストラベル" />);
      expect(screen.getByLabelText('テストラベル')).toBeInTheDocument();
    });

    it('ラベルなしでレンダリングできる', () => {
      const { container } = render(<Checkbox />);
      const checkbox = container.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe('チェックの動作', () => {
    it('チェックボックスをクリックできる', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      render(<Checkbox label="テスト" onChange={handleChange} />);

      const checkbox = screen.getByLabelText('テスト');
      await user.click(checkbox);

      expect(handleChange).toHaveBeenCalled();
    });

    it('チェック状態が正しく反映される', async () => {
      const user = userEvent.setup();
      render(<Checkbox label="テスト" />);

      const checkbox = screen.getByLabelText('テスト') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      await user.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });

    it('デフォルトのチェック状態を設定できる', () => {
      render(<Checkbox label="テスト" defaultChecked />);
      const checkbox = screen.getByLabelText('テスト') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーメッセージを表示する', () => {
      render(<Checkbox label="テスト" error="エラーメッセージ" />);
      expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    });

    it('エラー時はaria-invalidが設定される', () => {
      render(<Checkbox error="エラー" id="test-checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('無効化状態', () => {
    it('disabled状態でレンダリングできる', () => {
      render(<Checkbox label="テスト" disabled />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });

    it('disabled時はチェックできない', async () => {
      const user = userEvent.setup();
      render(<Checkbox label="テスト" disabled />);

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      const initialChecked = checkbox.checked;

      await user.click(checkbox);
      expect(checkbox.checked).toBe(initialChecked);
    });
  });

  describe('必須マーカー', () => {
    it('必須マーカーを表示する', () => {
      render(<Checkbox label="ラベル" required />);
      const label = screen.getByText('ラベル');
      expect(label.querySelector('.form-checkbox-required')).toBeInTheDocument();
    });

    it('必須時はaria-requiredが設定される', () => {
      render(<Checkbox required />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-required', 'true');
    });
  });
});

