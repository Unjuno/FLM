// jest-axe型定義
declare module 'jest-axe' {
  export interface AxeResults {
    violations: Array<{
      id: string;
      impact: string;
      tags: string[];
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{
        html: string;
        target: string[];
        failureSummary?: string;
      }>;
    }>;
    passes: Array<unknown>;
    incomplete: Array<unknown>;
    inapplicable: Array<unknown>;
  }

  export function axe(
    container: Element | Document,
    options?: unknown
  ): Promise<AxeResults>;

  export function toHaveNoViolations(
    received: AxeResults
  ): {
    message: () => string;
    pass: boolean;
  };
}

