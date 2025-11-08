// Radio - Radioコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Radio } from '../../src/components/forms/Radio';

describe('Radio.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('ラベルとラジオボタンを表示する', () => {
      render(<Radio name="test" label="テストラベル" />);
      expect(screen.getByLabelText('テストラベル')).toBeInTheDocument();
    });

    it('オプションリストを表示する', () => {
      render(
        <Radio
          name="test"
          options={[
            { value: '1', label: 'オプション1' },
            { value: '2', label: 'オプション2' },
          ]}
        />
      );
      expect(screen.getByLabelText('オプション1')).toBeInTheDocument();
      expect(screen.getByLabelText('オプション2')).toBeInTheDocument();
    });
  });

  describe('選択の動作', () => {
    it('ラジオボタンを選択できる', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      render(
        <Radio
          name="test"
          options={[
            { value: '1', label: 'オプション1' },
            { value: '2', label: 'オプション2' },
          ]}
          onChange={handleChange}
        />
      );

      const radio1 = screen.getByLabelText('オプション1');
      await user.click(radio1);

      expect(handleChange).toHaveBeenCalled();
    });

    it('選択状態が正しく反映される', async () => {
      const user = userEvent.setup();
      render(
        <Radio
          name="test"
          options={[
            { value: '1', label: 'オプション1' },
            { value: '2', label: 'オプション2' },
          ]}
        />
      );

      const radio1 = screen.getByLabelText('オプション1') as HTMLInputElement;
      const radio2 = screen.getByLabelText('オプション2') as HTMLInputElement;

      await user.click(radio1);
      expect(radio1.checked).toBe(true);
      expect(radio2.checked).toBe(false);

      await user.click(radio2);
      expect(radio1.checked).toBe(false);
      expect(radio2.checked).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーメッセージを表示する', () => {
      render(<Radio name="test" error="エラーメッセージ" />);
      expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    });
  });

  describe('無効化状態', () => {
    it('disabled状態でレンダリングできる', () => {
      render(<Radio name="test" label="テスト" disabled />);
      const radio = screen.getByRole('radio');
      expect(radio).toBeDisabled();
    });

    it('オプション単位で無効化できる', () => {
      render(
        <Radio
          name="test"
          options={[
            { value: '1', label: 'オプション1' },
            { value: '2', label: 'オプション2', disabled: true },
          ]}
        />
      );

      const radio1 = screen.getByLabelText('オプション1');
      const radio2 = screen.getByLabelText('オプション2');

      expect(radio1).not.toBeDisabled();
      expect(radio2).toBeDisabled();
    });
  });
});
