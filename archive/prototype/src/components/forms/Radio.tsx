// Radio - 統一されたラジオボタンコンポーネント

import React, { forwardRef, useMemo } from 'react';
import './Radio.css';

/**
 * Radioオプションの型定義
 */
export interface RadioOption {
  /** 値 */
  value: string | number;
  /** ラベル */
  label: string;
  /** 無効状態 */
  disabled?: boolean;
}

/**
 * Radioコンポーネントのプロパティ
 */
export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** ラベル */
  label?: string;
  /** エラーメッセージ */
  error?: string;
  /** ヘルプテキスト */
  helpText?: string;
  /** サイズ */
  size?: 'small' | 'medium' | 'large';
  /** フル幅 */
  fullWidth?: boolean;
  /** 必須マーカー表示 */
  required?: boolean;
  /** オプションリスト（ラジオボタングループ用） */
  options?: RadioOption[];
  /** グループ名（複数のRadioで同じ値を指定） */
  name: string;
}

/**
 * Radioコンポーネント
 * 統一されたラジオボタンコンポーネント
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      error,
      helpText,
      size = 'medium',
      fullWidth = false,
      required,
      options,
      disabled,
      className = '',
      id,
      name,
      ...props
    },
    ref
  ) => {
    // IDの生成
    const radioId = useMemo(() => {
      return id || `radio-${Math.random().toString(36).substring(2, 9)}`;
    }, [id]);

    // エラーID
    const errorId = useMemo(() => `${radioId}-error`, [radioId]);

    // ヘルプID
    const helpId = useMemo(() => `${radioId}-help`, [radioId]);

    // className を安全に結合
    const radioClassName = useMemo(() => {
      const classes = ['form-radio', `form-radio-${size}`];
      if (error) {
        classes.push('form-radio-error');
      }
      if (disabled) {
        classes.push('form-radio-disabled');
      }
      if (className.trim()) {
        classes.push(className.trim());
      }
      return classes.join(' ');
    }, [size, error, disabled, className]);

    const wrapperClassName = useMemo(() => {
      const classes = ['form-radio-wrapper'];
      if (fullWidth) {
        classes.push('form-radio-wrapper-full-width');
      }
      return classes.join(' ');
    }, [fullWidth]);

    // 単一のRadioボタン
    if (!options) {
      return (
        <div className={wrapperClassName}>
          <div className="form-radio-container">
            <input
              ref={ref}
              type="radio"
              id={radioId}
              name={name}
              className={radioClassName}
              disabled={disabled}
              {...(error && { 'aria-invalid': 'true' })}
              aria-describedby={error ? errorId : helpText ? helpId : undefined}
              {...(required && { 'aria-required': 'true' })}
              {...props}
            />
            {label && (
              <label htmlFor={radioId} className="form-radio-label">
                {label}
                {required && (
                  <span className="form-radio-required" aria-label="必須">
                    *
                  </span>
                )}
              </label>
            )}
          </div>
          {error && (
            <div id={errorId} className="form-radio-error-message" role="alert">
              {error}
            </div>
          )}
          {!error && helpText && (
            <div id={helpId} className="form-radio-help-text">
              {helpText}
            </div>
          )}
        </div>
      );
    }

    // ラジオボタングループ
    return (
      <div className={wrapperClassName}>
        {label && (
          <div className="form-radio-group-label">
            {label}
            {required && (
              <span className="form-radio-required" aria-label="必須">
                *
              </span>
            )}
          </div>
        )}
        <div
          className="form-radio-group"
          role="radiogroup"
          aria-labelledby={label ? `${radioId}-group-label` : undefined}
        >
          {options.map((option, index) => {
            const optionId = `${radioId}-${index}`;
            return (
              <div key={option.value} className="form-radio-group-item">
                <input
                  type="radio"
                  id={optionId}
                  name={name}
                  value={option.value}
                  className={radioClassName}
                  disabled={disabled || option.disabled}
                  {...(error && { 'aria-invalid': 'true' })}
                  {...props}
                />
                <label htmlFor={optionId} className="form-radio-label">
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
        {error && (
          <div id={errorId} className="form-radio-error-message" role="alert">
            {error}
          </div>
        )}
        {!error && helpText && (
          <div id={helpId} className="form-radio-help-text">
            {helpText}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';
