# 静的解析計画書（Static Analysis Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: 静的解析（Static Analysis）
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

静的解析は、コードの構文・スタイル・バグを検出するテストです。コードを実行せずに、コードの品質や潜在的な問題を特定し、開発初期から品質向上を図ります。

### 1.2 対象範囲

- TypeScript/JavaScriptコードの解析
- Rustコードの解析
- コードスタイルのチェック
- 潜在的なバグの検出
- セキュリティ脆弱性の検出
- コード複雑度の測定
- コードカバレッジの測定

### 1.3 テストツール

- **TypeScript/JavaScript**: ESLint、TypeScript Compiler、SonarQube
- **Rust**: Clippy、rustfmt、cargo audit
- **現状**: TypeScript Compiler、基本的なコード品質チェック

---

## 2. 既存の実装状況

### 2.1 既存の静的解析ファイル

以下の静的解析関連ファイルが既に存在しています：

- `tests/code-quality/lint-check.ts` - コード品質チェックのガイドライン

---

## 3. テスト対象とテスト項目

### 3.1 TypeScript/JavaScriptコードの解析

#### 3.1.1 型チェック

**対象**: すべてのTypeScriptファイル

**テスト項目**:
- 型エラーの検出
- 型安全性の確認
- 未使用変数の検出

**実行方法**:
```bash
# TypeScript型チェック
npm run build

# または
npx tsc --noEmit
```

**既存設定**: `tsconfig.json`

#### 3.1.2 リントチェック

**対象**: すべてのTypeScript/JavaScriptファイル

**テスト項目**:
- コードスタイルのチェック
- 潜在的なバグの検出
- ベストプラクティスの遵守

**推奨ツール**: ESLint

**設定例**:
```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

**実行方法**:
```bash
# ESLintのインストール
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# ESLintの実行
npx eslint src/
```

#### 3.1.3 コードフォーマット

**対象**: すべてのTypeScript/JavaScriptファイル

**テスト項目**:
- コードフォーマットの統一
- インデントの統一
- セミコロンの使用

**推奨ツール**: Prettier

**設定例**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

**実行方法**:
```bash
# Prettierのインストール
npm install --save-dev prettier

# Prettierの実行
npx prettier --check src/
```

### 3.2 Rustコードの解析

#### 3.2.1 Clippy（リントチェック）

**対象**: すべてのRustファイル（`src-tauri/src/`）

**テスト項目**:
- コードスタイルのチェック
- 潜在的なバグの検出
- パフォーマンスの問題の検出

**実行方法**:
```bash
cd src-tauri
cargo clippy
```

**既存設定**: `src-tauri/Cargo.toml`

#### 3.2.2 rustfmt（コードフォーマット）

**対象**: すべてのRustファイル

**テスト項目**:
- コードフォーマットの統一

**実行方法**:
```bash
cd src-tauri
cargo fmt --check
```

**既存設定**: `src-tauri/rustfmt.toml`（存在する場合）

#### 3.2.3 型チェック

**対象**: すべてのRustファイル

**テスト項目**:
- コンパイルエラーの検出

**実行方法**:
```bash
cd src-tauri
cargo check
```

### 3.3 セキュリティ脆弱性の検出

#### 3.3.1 依存関係の脆弱性スキャン

**対象**: `package.json`、`Cargo.toml`

**テスト項目**:
- 既知の脆弱性の検出
- セキュリティパッチの確認

**実行方法**:
```bash
# npm の脆弱性スキャン
npm audit

# Rust の脆弱性スキャン
cd src-tauri
cargo audit
```

#### 3.3.2 セキュリティコードの静的解析

**推奨ツール**: SonarQube、Snyk

**テスト項目**:
- SQLインジェクションの検出
- XSSの検出
- 認証・認可の問題の検出

### 3.4 コード複雑度の測定

**対象**: すべてのコードファイル

**テスト項目**:
- 循環的複雑度の測定
- 認知複雑度の測定
- 関数の長さの測定

**推奨ツール**: SonarQube、ESLint（complexity ルール）

### 3.5 コードカバレッジの測定

**対象**: すべてのコードファイル

**テスト項目**:
- 行カバレッジ
- 分岐カバレッジ
- 関数カバレッジ

**実行方法**:
```bash
npm run test:coverage
```

---

## 4. テスト実装方針

### 4.1 コード品質チェックの自動化

#### 4.1.1 package.jsonへのスクリプト追加

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --check src/",
    "format:fix": "prettier --write src/",
    "type-check": "tsc --noEmit",
    "quality-check": "npm run lint && npm run type-check && npm run format",
    "rust:clippy": "cd src-tauri && cargo clippy",
    "rust:fmt": "cd src-tauri && cargo fmt --check",
    "rust:check": "cd src-tauri && cargo check",
    "security:audit": "npm audit && cd src-tauri && cargo audit"
  }
}
```

#### 4.1.2 CI/CDへの統合

```yaml
# .github/workflows/quality-check.yml
name: Quality Check

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Install dependencies
        run: npm install
      
      - name: TypeScript type check
        run: npm run type-check
      
      - name: ESLint
        run: npm run lint
      
      - name: Prettier
        run: npm run format
      
      - name: Rust Clippy
        run: npm run rust:clippy
      
      - name: Rust fmt
        run: npm run rust:fmt
      
      - name: Security audit
        run: npm run security:audit
```

### 4.2 コード品質基準の設定

#### 4.2.1 コードカバレッジの目標

- **目標カバレッジ**: 80%以上
- **必須カバレッジ**: ユーティリティ関数、バリデーション関数は100%

#### 4.2.2 コード複雑度の基準

- **循環的複雑度**: 10以下
- **関数の長さ**: 50行以下
- **ファイルの長さ**: 500行以下

---

## 5. テスト実行方法

### 5.1 すべての静的解析を実行

```bash
# コード品質チェック（既存）
npm run quality-check

# または個別に実行
npm run lint
npm run type-check
npm run format
```

### 5.2 Rustコードの静的解析

```bash
# Clippy（リントチェック）
cd src-tauri && cargo clippy

# rustfmt（コードフォーマット）
cd src-tauri && cargo fmt --check

# 型チェック
cd src-tauri && cargo check
```

### 5.3 セキュリティ脆弱性のスキャン

```bash
# npm の脆弱性スキャン
npm audit

# Rust の脆弱性スキャン
cd src-tauri && cargo audit
```

### 5.4 SonarQubeを使用する場合

```bash
# SonarQubeのインストール
npm install --save-dev sonarqube-scanner

# SonarQubeの実行
npm run sonar
```

---

## 6. テスト実装優先順位

### 優先度: 高

1. **TypeScript型チェック**
   - 型安全性の確保
   - 既に実装済み（`npm run build`）

2. **ESLintの設定**
   - コードスタイルの統一
   - 潜在的なバグの検出
   - 要実装

3. **Rust Clippy**
   - Rustコードの品質確保
   - 要実装

### 優先度: 中

4. **Prettierの設定**
   - コードフォーマットの統一
   - 要実装

5. **rustfmtの設定**
   - Rustコードのフォーマット統一
   - 要実装

### 優先度: 低

6. **SonarQubeの統合**
   - 包括的なコード品質分析
   - オプション

---

## 7. コード品質基準

### 7.1 コードスタイル基準

- **インデント**: 2スペース
- **行の長さ**: 80文字（推奨）、120文字（最大）
- **セミコロン**: 使用する
- **引用符**: シングルクォート（JavaScript/TypeScript）

### 7.2 コード品質基準

- **未使用変数**: エラー
- **未使用インポート**: 警告
- **console.log**: 警告（本番コードでは削除）
- **any型**: 警告（可能な限り型を指定）

---

## 8. CI/CDへの統合

### 8.1 自動実行

- プルリクエスト作成時に自動実行
- マージ前に必須チェック

### 8.2 コード品質レポート

- コード品質レポートの生成
- カバレッジレポートの共有
- 脆弱性レポートの共有

---

## 9. トラブルシューティング

### 9.1 よくある問題

**問題**: ESLintの警告が多すぎる
- **解決策**: 段階的にルールを有効化、既存コードへの適用を段階的に実施

**問題**: PrettierとESLintの競合
- **解決策**: `eslint-config-prettier`を使用して競合を解決

**問題**: Clippyの警告が多すぎる
- **解決策**: 段階的に警告を修正、`#[allow(clippy::xxx)]`で一時的に無効化

---

## 10. 参考資料

- 既存のコード品質チェックファイル（`tests/code-quality/lint-check.ts`）
- [ESLint公式ドキュメント](https://eslint.org/docs/latest/)
- [Prettier公式ドキュメント](https://prettier.io/docs/en/)
- [Rust Clippy公式ドキュメント](https://rust-lang.github.io/rust-clippy/)
- [SonarQube公式ドキュメント](https://docs.sonarqube.org/)

