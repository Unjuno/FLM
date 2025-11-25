// useForm - フォーム管理フックのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useForm, FormField } from '../../src/hooks/useForm';
import { validate } from '../../src/utils/validation';

// import.meta.envをモック（Jest環境用）
// @ts-expect-error
global.import = {
  meta: {
    env: {
      DEV: true,
    },
  },
};

describe('useForm.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的な動作', () => {
    it('初期値を設定できる', () => {
      const fields: FormField[] = [
        { name: 'name', initialValue: 'テスト' },
        { name: 'email', initialValue: 'test@example.com' },
      ];

      const { result } = renderHook(() => useForm(fields));

      expect(result.current.values.name).toBe('テスト');
      expect(result.current.values.email).toBe('test@example.com');
    });

    it('初期値がない場合、空文字列を設定する', () => {
      const fields: FormField[] = [{ name: 'name' }];

      const { result } = renderHook(() => useForm(fields));

      expect(result.current.values.name).toBe('');
    });

    it('フィールドの状態を初期化する', () => {
      const fields: FormField[] = [{ name: 'name', initialValue: 'テスト' }];

      const { result } = renderHook(() => useForm(fields));

      expect(result.current.fields.name.touched).toBe(false);
      expect(result.current.fields.name.dirty).toBe(false);
      expect(result.current.fields.name.error).toBeUndefined();
    });
  });

  describe('値の設定', () => {
    it('setValueで値を設定できる', () => {
      const fields: FormField[] = [{ name: 'name' }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.setValue('name', '新しい値');
      });

      expect(result.current.values.name).toBe('新しい値');
      expect(result.current.fields.name.dirty).toBe(true);
    });

    it('onChangeで値を変更できる', () => {
      const fields: FormField[] = [{ name: 'name' }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.onChange('name')('変更された値');
      });

      expect(result.current.values.name).toBe('変更された値');
    });

    it('setValuesで複数の値を一括設定できる', () => {
      const fields: FormField[] = [{ name: 'name' }, { name: 'email' }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.setValues({ name: '名前', email: 'email@example.com' });
      });

      expect(result.current.values.name).toBe('名前');
      expect(result.current.values.email).toBe('email@example.com');
    });
  });

  describe('バリデーション', () => {
    it('validateOnChangeがtrueの場合、値変更時にバリデーションを実行する', async () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [
        { name: 'name', validator, validateOnChange: true },
      ];

      const { result } = renderHook(() => useForm(fields));

      await act(async () => {
        result.current.setValue('name', '');
      });

      await waitFor(() => {
        expect(result.current.fields.name.error).toBeDefined();
      });
    });

    it('validateOnBlurがtrueの場合、フォーカスアウト時にバリデーションを実行する', async () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [
        { name: 'name', validator, validateOnBlur: true },
      ];

      const { result } = renderHook(() => useForm(fields));

      await act(async () => {
        result.current.onBlur('name')();
      });

      await waitFor(() => {
        expect(result.current.fields.name.touched).toBe(true);
        expect(result.current.fields.name.error).toBeDefined();
      });
    });

    it('validateでフォーム全体をバリデーションできる', async () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [
        { name: 'name', validator },
        { name: 'email', validator },
      ];

      const { result } = renderHook(() => useForm(fields));

      await act(async () => {
        const isValid = await result.current.validate();
        expect(isValid).toBe(false);
      });

      expect(result.current.fields.name.error).toBeDefined();
      expect(result.current.fields.email.error).toBeDefined();
    });

    it('すべてのフィールドが有効な場合、validateはtrueを返す', async () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [
        { name: 'name', validator, initialValue: 'テスト' },
      ];

      const { result } = renderHook(() => useForm(fields));

      await act(async () => {
        const isValid = await result.current.validate();
        expect(isValid).toBe(true);
      });
    });

    it('setErrorでエラーを設定できる', () => {
      const fields: FormField[] = [{ name: 'name' }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.setError('name', 'カスタムエラー');
      });

      expect(result.current.fields.name.error).toBe('カスタムエラー');
      expect(result.current.fields.name.touched).toBe(true);
    });
  });

  describe('フォーム送信', () => {
    it('handleSubmitでフォームを送信できる', async () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [
        { name: 'name', validator, initialValue: 'テスト' },
      ];

      const onSubmit = jest.fn();
      const { result } = renderHook(() => useForm(fields));

      await act(async () => {
        await result.current.handleSubmit(onSubmit)();
      });

      expect(onSubmit).toHaveBeenCalledWith({ name: 'テスト' });
      expect(result.current.formState.isSubmitting).toBe(false);
    });

    it('バリデーションエラーがある場合、送信しない', async () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [{ name: 'name', validator }];

      const onSubmit = jest.fn();
      const { result } = renderHook(() => useForm(fields));

      await act(async () => {
        await result.current.handleSubmit(onSubmit)();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('送信中はisSubmittingがtrueになる', async () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [
        { name: 'name', validator, initialValue: 'テスト' },
      ];

      const onSubmit = jest.fn(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.handleSubmit(onSubmit)();
      });

      expect(result.current.formState.isSubmitting).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.formState.isSubmitting).toBe(false);
    });
  });

  describe('フォームの状態', () => {
    it('エラーがある場合、isValidがfalseになる', () => {
      const validator = validate<string>().required().build();
      const fields: FormField[] = [{ name: 'name', validator }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.setError('name', 'エラー');
      });

      expect(result.current.formState.isValid).toBe(false);
    });

    it('値が変更されている場合、isDirtyがtrueになる', () => {
      const fields: FormField[] = [{ name: 'name' }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.setValue('name', '新しい値');
      });

      expect(result.current.formState.isDirty).toBe(true);
    });

    it('フィールドがtouchedの場合、isTouchedがtrueになる', () => {
      const fields: FormField[] = [{ name: 'name' }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.setError('name', 'エラー');
      });

      expect(result.current.formState.isTouched).toBe(true);
    });
  });

  describe('リセット機能', () => {
    it('resetでフォームをリセットできる', () => {
      const fields: FormField[] = [{ name: 'name', initialValue: '初期値' }];

      const { result } = renderHook(() => useForm(fields));

      act(() => {
        result.current.setValue('name', '変更された値');
        result.current.setError('name', 'エラー');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.values.name).toBe('初期値');
      expect(result.current.fields.name.error).toBeUndefined();
      expect(result.current.fields.name.dirty).toBe(false);
      expect(result.current.formState.isSubmitting).toBe(false);
    });
  });
});

function waitFor(callback: () => void, options?: { timeout?: number }) {
  return new Promise<void>((resolve, reject) => {
    const timeout = options?.timeout || 1000;
    const startTime = Date.now();

    const check = () => {
      try {
        callback();
        resolve();
      } catch (error) {
        if (Date.now() - startTime > timeout) {
          reject(error);
        } else {
          setTimeout(check, 10);
        }
      }
    };

    check();
  });
}
