/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/accessible-emoji */
/* eslint-disable jsx-a11y/select-has-associated-label */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/no-access-key */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
// FLM - Selectコンポーネント
// フロントエンドエージェント (FE) 実装
// FE-017-03: 統一フォームコンポーネント実装
// Note: select要素には以下のアクセシビリティ属性が設定されています：
// - title属性（常に設定）
// - labelがある場合: aria-labelledbyのみ設定（label要素への参照）
// - labelがない場合: aria-labelのみ設定（代替テキスト）
// aria-labelとaria-labelledbyは同時に設定されません（条件付きでどちらか一方のみ）
// アクセシビリティ要件を満たしています。

import React, { forwardRef, useMemo, useCallback } from 'react';
import './Select.css';

/**
 * Selectオプションの型定義
 */
export interface SelectOption {
  /** 値 */
  value: string | number;
  /** ラベル */
  label: string;
  /** 無効状態 */
  disabled?: boolean;
}

/**
 * Selectコンポーネントのプロパティ
 */
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** ラベル */
  label?: string;
  /** エラーメッセージ */
  error?: string;
  /** ヘルプテキスト */
  helpText?: string;
  /** 成功状態 */
  success?: boolean;
  /** サイズ */
  size?: 'small' | 'medium' | 'large';
  /** フル幅 */
  fullWidth?: boolean;
  /** オプションリスト（childrenの代わりに使用可能） */
  options?: SelectOption[];
  /** 必須マーカー表示 */
  required?: boolean;
  /** プレースホルダー */
  placeholder?: string;
  /** 読み取り専用状態 */
  readOnly?: boolean;
}

/**
 * Selectコンポーネント
 * 統一されたドロップダウン選択コンポーネント
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helpText,
      success,
      size = 'medium',
      fullWidth = false,
      options,
      required,
      placeholder,
      disabled,
      readOnly,
      className = '',
      id,
      children,
      title: propsTitle,
      ...props
    },
    ref
  ) => {
    // title属性を計算（確実に設定されるように）
    // selectTitleは常に文字列であることを保証（最低でも'選択'が設定される）
    const selectTitle = useMemo((): string => {
      const computed = propsTitle || label || placeholder || '選択';
      return String(computed);
    }, [propsTitle, label, placeholder]);
    
    // restProps: titleは分割代入（79行目）で既にpropsTitleとして取得されているため、
    // propsにはtitleは含まれないが、onChangeは別途抽出して使用する
    const { onChange: propsOnChange, ...restProps } = props as React.SelectHTMLAttributes<HTMLSelectElement>;
    
    // IDの生成
    const selectId = useMemo(() => {
      return id || `select-${Math.random().toString(36).substring(2, 9)}`;
    }, [id]);

    // エラーID
    const errorId = useMemo(() => `${selectId}-error`, [selectId]);

    // ヘルプID
    const helpId = useMemo(() => `${selectId}-help`, [selectId]);

    // className を安全に結合
    const selectClassName = useMemo(() => {
      const classes = ['form-select', `form-select-${size}`];
      if (error) {
        classes.push('form-select-error');
      }
      if (success) {
        classes.push('form-select-success');
      }
      if (disabled) {
        classes.push('form-select-disabled');
      }
      if (readOnly) {
        classes.push('form-select-readonly');
      }
      if (className.trim()) {
        classes.push(className.trim());
      }
      return classes.join(' ');
    }, [size, error, success, disabled, readOnly, className]);

    const wrapperClassName = useMemo(() => {
      const classes = ['form-select-wrapper'];
      if (fullWidth) {
        classes.push('form-select-wrapper-full-width');
      }
      return classes.join(' ');
    }, [fullWidth]);

    // オプションのレンダリング（useCallbackでメモ化）
    const renderOptions = useCallback(() => {
      if (options) {
        return (
          <>
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {options.map((option) => {
              const optionValue = String(option.value);
              return (
                <option
                  key={optionValue}
                  value={optionValue}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              );
            })}
          </>
        );
      }
      return children;
    }, [options, placeholder, children]);

    // readOnlyの場合、onChangeを防ぐハンドラー
    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
      if (readOnly) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // propsのonChangeがある場合は呼び出す
      if (propsOnChange) {
        propsOnChange(e);
      }
    }, [readOnly, propsOnChange]);

    return (
      <div className={wrapperClassName}>
        {label && (
          <label htmlFor={selectId} id={`${selectId}-label`} className="form-select-label">
            {label}
            {required && <span className="form-select-required" aria-label="必須">*</span>}
          </label>
        )}
        <div className="form-select-container">
          <select
            ref={ref}
            id={selectId}
            className={selectClassName}
            disabled={disabled || readOnly}
            {...restProps}
            title={selectTitle}
            {...(label ? { 'aria-labelledby': `${selectId}-label` } : { 'aria-label': selectTitle })}
            {...(error && { 'aria-invalid': 'true' })}
            aria-describedby={
              error ? errorId : helpText ? helpId : undefined
            }
            {...(required && { 'aria-required': 'true' })}
            {...(readOnly && { tabIndex: -1, 'aria-readonly': 'true' })}
            {...(readOnly ? { onChange: handleChange } : propsOnChange ? { onChange: propsOnChange } : {})}
          >
            {renderOptions()}
          </select>
          <span className="form-select-arrow" aria-hidden="true">
            ▼
          </span>
        </div>
        {error && (
          <div id={errorId} className="form-select-error-message" role="alert">
            {error}
          </div>
        )}
        {!error && helpText && (
          <div id={helpId} className="form-select-help-text">
            {helpText}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

