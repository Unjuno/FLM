// Select - Selectコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Select } from '../../src/components/forms/Select';
import type { SelectOption } from '../../src/components/forms/Select';

describe('Select.tsx', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      root.unmount();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // ヘルパー関数: レンダリング完了を待つ
  const waitForRender = async (ms: number = 50): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  describe('基本的なレンダリング', () => {
    it('ラベルとオプションを表示する', async () => {
      const options: SelectOption[] = [
        { value: '1', label: 'オプション1' },
        { value: '2', label: 'オプション2' },
      ];

      root.render(<Select label="テストラベル" options={options} />);
      await waitForRender();

      const label = container.querySelector('label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toContain('テストラベル');

      const select = container.querySelector('select');
      expect(select).toBeTruthy();
      const option1 = Array.from(select?.querySelectorAll('option') || []).find(
        opt => opt.textContent === 'オプション1'
      );
      const option2 = Array.from(select?.querySelectorAll('option') || []).find(
        opt => opt.textContent === 'オプション2'
      );
      expect(option1).toBeTruthy();
      expect(option2).toBeTruthy();
    });

    it('ラベルなしでレンダリングできる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} />);
      await waitForRender();

      const select = container.querySelector('select');
      expect(select).toBeTruthy();
      const option = Array.from(select?.querySelectorAll('option') || []).find(
        opt => opt.textContent === 'オプション1'
      );
      expect(option).toBeTruthy();
    });

    it('プレースホルダーを表示する', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select placeholder="選択してください" options={options} />);
      await waitForRender();

      const select = container.querySelector('select');
      const placeholderOption = Array.from(
        select?.querySelectorAll('option') || []
      ).find(opt => opt.textContent === '選択してください');
      expect(placeholderOption).toBeTruthy();
    });
  });

  describe('オプションの選択', () => {
    it('オプションを選択できる', async () => {
      const options: SelectOption[] = [
        { value: '1', label: 'オプション1' },
        { value: '2', label: 'オプション2' },
      ];
      const handleChange = jest.fn();

      root.render(<Select options={options} onChange={handleChange} />);
      await waitForRender();

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select).toBeTruthy();

      select.value = '2';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(select.value).toBe('2');
    });

    it('childrenオプションも選択できる', async () => {
      const handleChange = jest.fn();
      root.render(
        <Select onChange={handleChange}>
          <option value="1">オプション1</option>
          <option value="2">オプション2</option>
        </Select>
      );
      await waitForRender();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = '1';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(select.value).toBe('1');
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーメッセージを表示する', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} error="エラーメッセージ" />);
      await waitForRender();

      const errorMessage = container.querySelector(
        '.form-select-error-message'
      );
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toBe('エラーメッセージ');

      const select = container.querySelector('select');
      expect(select?.getAttribute('aria-invalid')).toBe('true');
    });

    it('エラー時はヘルプテキストを表示しない', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(
        <Select options={options} error="エラー" helpText="ヘルプ" />
      );
      await waitForRender();

      expect(
        container.querySelector('.form-select-error-message')
      ).toBeTruthy();
      expect(container.querySelector('.form-select-help-text')).toBeFalsy();
    });
  });

  describe('ヘルプテキスト', () => {
    it('ヘルプテキストを表示する', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} helpText="ヘルプテキスト" />);
      await waitForRender();

      const helpText = container.querySelector('.form-select-help-text');
      expect(helpText).toBeTruthy();
      expect(helpText?.textContent).toBe('ヘルプテキスト');
    });
  });

  describe('無効化状態', () => {
    it('disabled状態でレンダリングできる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} disabled />);
      await waitForRender();

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select?.disabled).toBe(true);
    });

    it('readOnly状態でレンダリングできる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} readOnly />);
      await waitForRender();

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select?.disabled).toBe(true);
      expect(select?.getAttribute('aria-readonly')).toBe('true');
    });

    it('readOnly時はonChangeが無効化される', async () => {
      const options: SelectOption[] = [
        { value: '1', label: 'オプション1' },
        { value: '2', label: 'オプション2' },
      ];
      const handleChange = jest.fn();

      root.render(
        <Select options={options} readOnly value="1" onChange={handleChange} />
      );
      await waitForRender();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = '2';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      // readOnly時はonChangeが呼ばれない（または無効化される）
      expect(select.value).toBe('1');
      // handleChangeは呼ばれない（readOnly時はpreventDefaultとstopPropagationが実行される）
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('readOnlyがfalseでpropsOnChangeが存在する場合、onChangeが正常に呼ばれる', async () => {
      const options: SelectOption[] = [
        { value: '1', label: 'オプション1' },
        { value: '2', label: 'オプション2' },
      ];
      const handleChange = jest.fn();

      // valueプロップを設定しない（制御されていないコンポーネントとしてテスト）
      root.render(
        <Select options={options} readOnly={false} onChange={handleChange} />
      );
      await waitForRender();

      const select = container.querySelector('select') as HTMLSelectElement;
      // 実際のDOM要素の値を変更
      select.value = '2';
      // 変更イベントを発火
      const changeEvent = new Event('change', { bubbles: true });
      select.dispatchEvent(changeEvent);

      // readOnlyがfalseの場合、onChangeが正常に呼ばれる
      expect(handleChange).toHaveBeenCalledTimes(1);
      // Reactの合成イベントが渡されることを確認
      const callArgs = handleChange.mock
        .calls[0][0] as React.ChangeEvent<HTMLSelectElement>;
      expect(callArgs).toBeDefined();
      expect(callArgs.target).toBeDefined();
      // 実際のDOM要素の値が反映されることを確認
      expect(select.value).toBe('2');
    });
  });

  describe('必須マーカー', () => {
    it('必須マーカーを表示する', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select label="ラベル" options={options} required />);
      await waitForRender();

      const label = container.querySelector('label');
      const requiredMarker = label?.querySelector('.form-select-required');
      expect(requiredMarker).toBeTruthy();

      const select = container.querySelector('select');
      expect(select?.getAttribute('aria-required')).toBe('true');
    });
  });

  describe('サイズ', () => {
    it('smallサイズでレンダリングできる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} size="small" />);
      await waitForRender();

      const select = container.querySelector('.form-select-small');
      expect(select).toBeTruthy();
    });

    it('largeサイズでレンダリングできる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} size="large" />);
      await waitForRender();

      const select = container.querySelector('.form-select-large');
      expect(select).toBeTruthy();
    });
  });

  describe('フル幅', () => {
    it('fullWidthでレンダリングできる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} fullWidth />);
      await waitForRender();

      const wrapper = container.querySelector(
        '.form-select-wrapper-full-width'
      );
      expect(wrapper).toBeTruthy();
    });
  });

  describe('成功状態', () => {
    it('success状態でレンダリングできる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} success />);
      await waitForRender();

      const select = container.querySelector('.form-select-success');
      expect(select).toBeTruthy();
    });
  });

  describe('アクセシビリティ', () => {
    it('title属性が設定される', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select label="テストラベル" options={options} />);
      await waitForRender();

      const select = container.querySelector('select');
      expect(select?.getAttribute('title')).toBe('テストラベル');
    });

    it('aria-label属性が設定される', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select label="テストラベル" options={options} />);
      await waitForRender();

      const select = container.querySelector('select');
      expect(select?.getAttribute('aria-label')).toBe('テストラベル');
    });

    it('aria-labelledby属性が設定される（ラベルがある場合）', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(
        <Select label="テストラベル" options={options} id="test-select" />
      );
      await waitForRender();

      const select = container.querySelector('select');
      const labelId = select?.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      expect(labelId).toContain('test-select-label');
    });

    it('aria-describedby属性が設定される（エラー時）', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} error="エラー" id="test-select" />);
      await waitForRender();

      const select = container.querySelector('select');
      const describedBy = select?.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(describedBy).toContain('test-select-error');
    });

    it('aria-describedby属性が設定される（ヘルプテキストがある場合）', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(
        <Select options={options} helpText="ヘルプ" id="test-select" />
      );
      await waitForRender();

      const select = container.querySelector('select');
      const describedBy = select?.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(describedBy).toContain('test-select-help');
    });
  });

  describe('カスタムプロパティ', () => {
    it('カスタムclassNameを適用できる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} className="custom-class" />);
      await waitForRender();

      const select = container.querySelector('.custom-class');
      expect(select).toBeTruthy();
    });

    it('カスタムIDを設定できる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} id="custom-id" />);
      await waitForRender();

      const select = container.querySelector('select');
      expect(select?.getAttribute('id')).toBe('custom-id');
    });

    it('カスタムtitle属性を設定できる', async () => {
      const options: SelectOption[] = [{ value: '1', label: 'オプション1' }];
      root.render(<Select options={options} title="カスタムタイトル" />);
      await waitForRender();

      const select = container.querySelector('select');
      expect(select?.getAttribute('title')).toBe('カスタムタイトル');
    });
  });

  describe('オプションの無効化', () => {
    it('無効化されたオプションを表示できる', async () => {
      const options: SelectOption[] = [
        { value: '1', label: '有効なオプション' },
        { value: '2', label: '無効なオプション', disabled: true },
      ];

      root.render(<Select options={options} />);
      await waitForRender();

      const select = container.querySelector('select');
      const option2 = Array.from(select?.querySelectorAll('option') || []).find(
        opt => opt.textContent === '無効なオプション'
      );
      expect((option2 as HTMLOptionElement).disabled).toBe(true);
    });
  });
});
