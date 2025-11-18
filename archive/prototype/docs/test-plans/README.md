# テスト計画書一覧

このディレクトリには、FLMプロジェクトの包括的なテスト計画書が含まれています。

## テスト計画書一覧

### 1. [単体テスト計画書](./01-unit-test-plan.md)
- 個々の関数やモジュールの動作を検証
- 自動化しやすく、CI/CDに組み込みやすい
- 使用例：Jest（TypeScript/JavaScript）、`#[test]`（Rust）

### 2. [結合テスト計画書](./02-integration-test-plan.md)
- 複数のモジュール間の連携を検証
- API連携やデータベース接続などの確認に有効
- 使用例：Jest + Tauri API

### 3. [システムテスト計画書](./03-system-test-plan.md)
- システム全体の動作確認
- UI操作やユーザーシナリオの再現が可能
- 使用例：Cypress、Playwright、Autify

### 4. [回帰テスト計画書](./04-regression-test-plan.md)
- 修正による既存機能への影響を検証
- 自動化により頻繁な再テストが可能
- 使用例：Jest、MagicPod、TestComplete

### 5. [E2Eテスト計画書](./05-e2e-test-plan.md)
- ユーザー視点での操作フローを検証
- ブラウザ操作やモバイル操作の自動化
- 使用例：Jest、Selenium、Appium、BrowserStack

### 6. [UIテスト計画書](./06-ui-test-plan.md)
- ボタン・フォーム・画面遷移などの検証
- ノーコードツールでも対応可能
- 使用例：Jest + React Testing Library、Autify、Testim、Ranorex

### 7. [APIテスト計画書](./07-api-test-plan.md)
- RESTやGraphQLなどのAPIの応答と処理を検証
- 自動化により高速・高精度な検証が可能
- 使用例：Jest + fetch API、Postman、SoapUI、Katalon Studio

### 8. [パフォーマンステスト計画書](./08-performance-test-plan.md)
- 負荷・応答時間・スループットなどの検証
- 自動化により定期的な性能監視が可能
- 使用例：Jest、JMeter、Locust

### 9. [セキュリティテスト計画書](./09-security-test-plan.md)
- 脆弱性や認証・認可の検証
- 自動化ツールで定期スキャンが可能
- 使用例：Jest、SonarQube、OWASP ZAP

### 10. [静的解析計画書](./10-static-analysis-plan.md)
- コードの構文・スタイル・バグの検出
- 自動化により開発初期から品質向上
- 使用例：ESLint、TypeScript Compiler、Clippy、SonarQube

### 11. [アクセシビリティテスト計画書](./11-accessibility-test-plan.md)
- 視覚・聴覚・操作支援の対応確認
- 自動化ツールでWCAG準拠の検証が可能
- 使用例：axe-core、Pa11y、WAVE

---

## テスト計画書の使用方法

### 1. 各テスト計画書を読む

各テスト計画書には以下の情報が含まれています：
- テストの目的と対象範囲
- 既存の実装状況
- テスト項目とテストケース
- テスト実装方針
- テスト実行方法
- テスト実装優先順位
- CI/CDへの統合方法

### 2. テストを実装する

各テスト計画書に記載されている「テスト実装優先順位」に従って、段階的にテストを実装します。

### 3. テストを実行する

各テスト計画書に記載されている「テスト実行方法」に従って、テストを実行します。

### 4. テスト結果を確認する

テスト結果を確認し、問題があれば修正します。

---

## 既存のテスト実装状況

### 実装済み

- ✅ 単体テスト（`tests/unit/`）
- ✅ 結合テスト（`tests/integration/`）
- ✅ E2Eテスト（`tests/e2e/`）
- ✅ パフォーマンステスト（`tests/performance/`）
- ✅ セキュリティテスト（`tests/security/`）
- ✅ 基本的なコード品質チェック（`tests/code-quality/`）

### 要実装

- ⚠️ システムテスト（Cypress/Playwrightの統合）
- ⚠️ UIテスト（React Testing Libraryの拡充）
- ⚠️ APIテスト（Postman/Katalon Studioの統合）
- ⚠️ 静的解析（ESLint、Prettier、Clippyの設定）
- ⚠️ アクセシビリティテスト（axe-core、Pa11yの統合）

---

## テスト実行コマンド

### すべてのテストを実行

```bash
npm test
```

### 特定のテストタイプを実行

```bash
# 単体テスト
npm test -- tests/unit

# 結合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e

# パフォーマンステスト
npm run test:performance

# セキュリティテスト
npm run test:security
```

### カバレッジレポートを生成

```bash
npm run test:coverage
```

---

## テストカバレッジ目標

- **目標カバレッジ**: 80%以上
- **必須カバレッジ**: ユーティリティ関数、バリデーション関数は100%

---

## CI/CDへの統合

すべてのテスト計画書にCI/CDへの統合方法が記載されています。プルリクエスト作成時に自動的にテストが実行されるように設定することを推奨します。

---

## 参考資料

- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- [React Testing Library公式ドキュメント](https://testing-library.com/react)
- [Tauri APIドキュメント](https://tauri.app/api/)
- [WCAG 2.1公式ドキュメント](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 更新履歴

- 2024年: 初版作成

