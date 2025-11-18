// testing-library型定義の拡張
declare module '@testing-library/react' {
  export * from '@testing-library/dom';
  export function render(...args: any[]): any;
  export function renderHook(...args: any[]): any;
  export function cleanup(): void;
  export const act: any;
}

declare module '@testing-library/dom' {
  export const screen: {
    getByLabelText: (...args: any[]) => HTMLElement;
    getByPlaceholderText: (...args: any[]) => HTMLElement;
    getByText: (...args: any[]) => HTMLElement;
    getByRole: (...args: any[]) => HTMLElement;
    queryByText: (...args: any[]) => HTMLElement | null;
    [key: string]: any;
  };
}
