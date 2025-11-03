// useForm - フォーム状態管理とバリデーション機能を提供するフック

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Validator } from '../utils/validation';

/**
 * フォームフィールドの型定義
 */
export interface FormField<T = unknown> {
  /** フィールド名 */
  name: string;
  /** 初期値 */
  initialValue?: T;
  /** バリデーション関数 */
  validator?: Validator<T>;
  /** リアルタイムバリデーションを有効にするか */
  validateOnChange?: boolean;
  /** フォーカスアウト時にバリデーションを実行するか */
  validateOnBlur?: boolean;
}

/**
 * フォームフィールドの状態
 */
export interface FormFieldState<T = unknown> {
  /** 現在の値 */
  value: T;
  /** エラーメッセージ */
  error?: string;
  /** バリデーション済みか */
  touched: boolean;
  /** 変更済みか */
  dirty: boolean;
}

/**
 * フォームの状態
 */
export interface FormState {
  /** フォーム全体が有効か */
  isValid: boolean;
  /** フォーム全体が変更されているか */
  isDirty: boolean;
  /** フォーム全体がバリデーション済みか */
  isTouched: boolean;
  /** フォーム送信中か */
  isSubmitting: boolean;
}

/**
 * useFormフックの戻り値
 */
export interface UseFormReturn<T extends Record<string, unknown>> {
  /** フィールドの値 */
  values: { [K in keyof T]: T[K] };
  /** フィールドの状態 */
  fields: { [K in keyof T]: FormFieldState<T[K]> };
  /** フォームの状態 */
  formState: FormState;
  /** フィールドの値を設定 */
  setValue: <K extends keyof T>(name: K, value: T[K]) => void;
  /** フィールドの値を変更 */
  onChange: <K extends keyof T>(name: K) => (value: T[K]) => void;
  /** フィールドの値が変更された時に呼ばれるハンドラ */
  onBlur: <K extends keyof T>(name: K) => () => void;
  /** フィールドのエラーを設定 */
  setError: <K extends keyof T>(name: K, error?: string) => void;
  /** フォーム全体をリセット */
  reset: () => void;
  /** フォーム全体をバリデーション */
  validate: () => Promise<boolean>;
  /** フォーム全体をバリデーションして送信 */
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => () => Promise<void>;
  /** フィールドの値を一括設定 */
  setValues: (values: Partial<T>) => void;
}

/**
 * useFormフック
 * フォーム状態管理とバリデーション機能を提供
 */
export function useForm<T extends Record<string, unknown>>(
  fields: FormField[]
): UseFormReturn<T> {
  // フィールドマップを作成
  const fieldMap = useMemo(() => {
    const map = new Map<string, FormField>();
    fields.forEach((field) => {
      map.set(field.name, field);
    });
    return map;
  }, [fields]);

  // 初期値の作成
  const initialValues = useMemo(() => {
    const values: Partial<T> = {};
    const fieldStates: Partial<Record<keyof T, FormFieldState>> = {};
    
    fields.forEach((field) => {
      const fieldName = field.name as keyof T;
      const initialValue = (field.initialValue ?? '') as T[keyof T];
      values[fieldName] = initialValue;
      fieldStates[fieldName] = {
        value: initialValue,
        error: undefined,
        touched: false,
        dirty: false,
      } as FormFieldState<T[keyof T]>;
    });

    return { 
      values: values as T, 
      fieldStates: fieldStates as { [K in keyof T]: FormFieldState<T[K]> }
    };
  }, [fields]);

  // 状態管理
  const [values, setValuesState] = useState<T>(initialValues.values);
  const [fieldStates, setFieldStates] = useState<{ [K in keyof T]: FormFieldState<T[K]> }>(
    initialValues.fieldStates
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 最新の値を保持するref（クロージャ問題を回避）
  const valuesRef = useRef<T>(values);
  const fieldStatesRef = useRef<{ [K in keyof T]: FormFieldState<T[K]> }>(fieldStates);

  // refを最新の状態に更新
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    fieldStatesRef.current = fieldStates;
  }, [fieldStates]);

  // フィールドの値を設定
  const setValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [name]: value }));
    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        value: value as T[K],
        dirty: true,
      } as FormFieldState<T[K]>,
    }));

    // リアルタイムバリデーション
    const field = fieldMap.get(name as string);
    if (field?.validator && field.validateOnChange) {
      Promise.resolve(field.validator(value)).then((result) => {
        setFieldStates((prev) => ({
          ...prev,
          [name]: {
            ...prev[name],
            error: result.isValid ? undefined : result.error,
            touched: true,
          } as FormFieldState<T[K]>,
        }));
      });
    }
  }, [fieldMap]);

  // フィールドの値が変更された時に呼ばれるハンドラ
  const onChange = useCallback(
    <K extends keyof T>(name: K) => (value: T[K]) => {
      setValue(name, value);
    },
    [setValue]
  );

  // フィールドのフォーカスが外れた時に呼ばれるハンドラ
  const onBlur = useCallback(
    <K extends keyof T>(name: K) => async () => {
      const field = fieldMap.get(name as string);
      if (field?.validator && field.validateOnBlur !== false) {
        // 最新の値を取得（refを使用してクロージャ問題を回避）
        const currentValue = valuesRef.current[name];
        const result = await Promise.resolve(field.validator(currentValue));
        setFieldStates((prev) => {
          const updated = {
            ...prev,
            [name]: {
              ...prev[name],
              error: result.isValid ? undefined : result.error,
              touched: true,
            } as FormFieldState<T[typeof name]>,
          };
          return updated;
        });
      } else {
        setFieldStates((prev) => ({
          ...prev,
          [name]: {
            ...prev[name],
            touched: true,
          } as FormFieldState<T[typeof name]>,
        }));
      }
    },
    [fieldMap]
  );

  // フィールドのエラーを設定
  const setError = useCallback(<K extends keyof T>(name: K, error?: string) => {
    setFieldStates((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        error,
        touched: true,
      } as FormFieldState<T[K]>,
    }));
  }, []);

  // フォーム全体をリセット
  const reset = useCallback(() => {
    setValuesState(initialValues.values);
    setFieldStates(initialValues.fieldStates);
    setIsSubmitting(false);
  }, [initialValues]);

  // フィールドの値を一括設定
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
    Object.keys(newValues).forEach((name) => {
      const fieldName = name as keyof T;
      setFieldStates((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          value: newValues[fieldName]!,
          dirty: true,
        } as FormFieldState<T[typeof fieldName]>,
      }));
    });
  }, []);

  // フォーム全体をバリデーション
  const validate = useCallback(async (): Promise<boolean> => {
    let isValid = true;
    const currentValues = valuesRef.current;
    const newFieldStates = { ...fieldStatesRef.current };

    for (const field of fields) {
      const fieldName = field.name as keyof T;
      const value = currentValues[fieldName];
      
      if (field.validator) {
        const result = await field.validator(value);
        if (!result.isValid) {
          isValid = false;
          newFieldStates[fieldName] = {
            ...newFieldStates[fieldName],
            error: result.error,
            touched: true,
          } as FormFieldState<T[typeof fieldName]>;
        } else {
          newFieldStates[fieldName] = {
            ...newFieldStates[fieldName],
            error: undefined,
            touched: true,
          } as FormFieldState<T[typeof fieldName]>;
        }
      }
    }

    setFieldStates(newFieldStates);
    return isValid;
  }, [fields]);

  // フォーム送信ハンドラ
  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) => async () => {
      setIsSubmitting(true);
      const isValid = await validate();
      
      if (isValid) {
        try {
          // 最新の値を取得（refを使用）
          await onSubmit(valuesRef.current);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('フォーム送信中にエラーが発生しました:', error);
          }
        }
      }
      
      setIsSubmitting(false);
    },
    [validate]
  );

  // フォームの状態を計算
  const formState = useMemo((): FormState => {
    const errors = Object.values(fieldStates).some((field) => !!field.error);
    const isDirty = Object.values(fieldStates).some((field) => field.dirty);
    const isTouched = Object.values(fieldStates).some((field) => field.touched);

    return {
      isValid: !errors,
      isDirty,
      isTouched,
      isSubmitting,
    };
  }, [fieldStates, isSubmitting]);

  return {
    values,
    fields: fieldStates,
    formState,
    setValue,
    onChange,
    onBlur,
    setError,
    reset,
    validate,
    handleSubmit,
    setValues,
  };
}
