// Switch - Switchコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Switch } from '../../src/components/forms/Switch';

describe('Switch.tsx', () => {
  describe('基本的なレンダリング', () => {
    it('ラベルとスイッチを表示する', () => {
      render(<Switch label="テストラベル" />);
      expect(screen.getByLabelText('テストラベル')).toBeInTheDocument();
    });

    it('ラベルなしでレンダリングできる', () => {
      const { container } = render(<Switch />);
      const switchInput = container.querySelector('input[type="checkbox"]');
      expect(switchInput).toBeInTheDocument();
    });
  });

  describe('スイッチの動作', () => {
    it('スイッチをクリックできる', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      render(<Switch label="テスト" onChange={handleChange} />);

      const switchInput = screen.getByLabelText('テスト');
      await user.click(switchInput);

      expect(handleChange).toHaveBeenCalled();
    });

    it('スイッチ状態が正しく反映される', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      // 非制御コンポーネントとしてテスト
      render(<Switch label="テスト" onChange={handleChange} />);

      const switchInput = screen.getByLabelText('テスト') as HTMLInputElement;
      expect(switchInput.checked).toBe(false);

      await user.click(switchInput);
      // onChangeが呼ばれることを確認
      expect(handleChange).toHaveBeenCalled();
      // 非制御コンポーネントなので、実際のDOM値が変更される
      // ただし、Reactのレンダリングサイクルを考慮して少し待機
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(switchInput.checked).toBe(true);

      await user.click(switchInput);
      expect(handleChange).toHaveBeenCalledTimes(2);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(switchInput.checked).toBe(false);
    });

    it('デフォルトのON状態を設定できる', () => {
      // defaultCheckedを使用する場合はcheckedプロップを渡さない
      render(<Switch label="テスト" defaultChecked={true} />);
      const switchInput = screen.getByLabelText('テスト') as HTMLInputElement;
      // defaultCheckedは非制御コンポーネントとして動作
      expect(switchInput.defaultChecked).toBe(true);
      expect(switchInput.checked).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーメッセージを表示する', () => {
      render(<Switch label="テスト" error="エラーメッセージ" />);
      expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
    });
  });

  describe('無効化状態', () => {
    it('disabled状態でレンダリングできる', () => {
      render(<Switch label="テスト" disabled />);
      // Switchコンポーネントはrole="switch"を使用しているため、getByLabelTextで取得
      const switchInput = screen.getByLabelText('テスト') as HTMLInputElement;
      // disabled属性を直接確認
      expect(switchInput.disabled).toBe(true);
      expect(switchInput).toBeDisabled();
    });
  });
});

