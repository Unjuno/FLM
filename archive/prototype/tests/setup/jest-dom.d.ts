// jest-dom型定義の拡張
import '@testing-library/jest-dom';
import '@testing-library/react';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeDisabled(): R;
      toHaveClass(className: string): R;
      toHaveStyle(style: string | Record<string, string>): R;
      toHaveNoViolations(): Promise<R>;
    }
  }
}

// モジュールとして認識されるようにexportを追加
export {};
