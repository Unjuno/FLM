/**
 * FLM - コード品質チェック
 * 
 * フェーズ4: QAエージェント (QA) 実装
 * コード品質チェック（リント、型チェック）のガイドライン
 */

/**
 * コード品質チェックの実行方法
 * 
 * TypeScript型チェック:
 * - `npm run build` - TypeScriptコンパイルエラーのチェック
 * 
 * Rustコードチェック:
 * - `cargo clippy` - Rustリントチェック
 * - `cargo fmt --check` - Rustコードフォーマットチェック
 * 
 * JavaScript/TypeScriptリント:
 * - ESLint設定を追加する場合は `npm install --save-dev eslint`
 * 
 * このファイルは、コード品質チェックの実行方法を文書化するためのものです。
 */
export const codeQualityCheckGuidelines = {
  typescript: {
    command: 'npm run build',
    description: 'TypeScript型チェックとコンパイル',
  },
  rust: {
    clippy: {
      command: 'cd src-tauri && cargo clippy',
      description: 'Rustコードのリントチェック',
    },
    fmt: {
      command: 'cd src-tauri && cargo fmt --check',
      description: 'Rustコードのフォーマットチェック',
    },
  },
};

