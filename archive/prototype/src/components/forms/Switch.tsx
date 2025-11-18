// Switch - 統一されたスイッチコンポーネント

import React, { forwardRef, useMemo } from 'react';
import './Switch.css';

/**
 * Switchコンポーネントのプロパティ
 */
export interface SwitchProps
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
}

/**
 * Switchコンポーネント
 * 統一されたトグルスイッチコンポーネント
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      error,
      helpText,
      size = 'medium',
      fullWidth = false,
      required,
      disabled,
      checked,
      defaultChecked,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    // IDの生成
    const switchId = useMemo(() => {
      return id || `switch-${Math.random().toString(36).substring(2, 9)}`;
    }, [id]);

    // エラーID
    const errorId = useMemo(() => `${switchId}-error`, [switchId]);

    // ヘルプID
    const helpId = useMemo(() => `${switchId}-help`, [switchId]);

    // className を安全に結合
    const switchClassName = useMemo(() => {
      const classes: string[] = ['form-switch', `form-switch-${size}`];
      if (error) classes.push('form-switch-error');
      if (disabled) classes.push('form-switch-disabled');
      if (checked) classes.push('form-switch-checked');
      const trimmedClassName = className.trim();
      if (trimmedClassName) classes.push(trimmedClassName);
      return classes.join(' ');
    }, [size, error, disabled, checked, className]);

    const wrapperClassName = useMemo(() => {
      const classes: string[] = ['form-switch-wrapper'];
      if (fullWidth) classes.push('form-switch-wrapper-full-width');
      return classes.join(' ');
    }, [fullWidth]);

    return (
      <div className={wrapperClassName}>
        <div className="form-switch-container">
          <label htmlFor={switchId} className="form-switch-label-wrapper">
            <input
              ref={ref}
              type="checkbox"
              id={switchId}
              className="form-switch-input"
              disabled={disabled}
              {...(checked !== undefined
                ? { checked }
                : defaultChecked !== undefined
                  ? { defaultChecked }
                  : {})}
              role="switch"
              {...((checked !== undefined ? checked : defaultChecked) && {
                'aria-checked': true,
              })}
              {...(error && { 'aria-invalid': true })}
              {...(error && { 'aria-describedby': errorId })}
              {...(!error && helpText && { 'aria-describedby': helpId })}
              {...(required && { 'aria-required': true })}
              {...props}
            />
            <span className={switchClassName}>
              <span className="form-switch-thumb"></span>
            </span>
            {label && (
              <span className="form-switch-label">
                {label}
                {required && (
                  <span className="form-switch-required" aria-label="必須">
                    *
                  </span>
                )}
              </span>
            )}
          </label>
        </div>
        {error && (
          <div id={errorId} className="form-switch-error-message" role="alert">
            {error}
          </div>
        )}
        {!error && helpText && (
          <div id={helpId} className="form-switch-help-text">
            {helpText}
          </div>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
