# テスト推奨事項

> Updated: 2025-02-01 | Status: Active

## 現在のテスト状況サマリー

### Rustテスト

| Crate | テスト数 | 成功 | 失敗 | 成功率 | 状態 |
|-------|---------|------|------|--------|------|
| flm-core | 14 | 14 | 0 | 100% | ✅ |
| flm-cli | 31 | 30 | 1 | 96.8% | ⚠️ |
| flm-proxy | 7+ | 5+ | 2+ | 71.4%+ | ⚠️ |
| flm-engine-llamacpp | 6 | 6 | 0 | 100% | ✅ |
| flm-engine-ollama | 6 | 6 | 0 | 100% | ✅ |
| flm-engine-vllm | 8 | 8 | 0 | 100% | ✅ |
| **合計** | **70+** | **69+** | **3+** | **98.6%+** | ⚠️ |

### TypeScript/Reactテスト

- **テストファイル数**: 33ファイル
- **テストケース数**: 1,309ケース
- **成功率**: 83.3% (1,090/1,309)

## 🔴 優先度: 高（リリース前に必須）

### 1. 失敗しているテストの修正

#### 1.1 flm-cli e2e_test::test_security_features_e2e
- **問題**: レート制限テストが失敗（5回目のリクエストがレート制限されている）
- **原因**: テストのタイミング問題の可能性
- **状態**: 調査中
- **推奨**: テストの待機時間を調整、またはレート制限ロジックを確認

#### 1.2 flm-proxy security_test::test_authentication_bypass_protection
- **問題**: 認証バイパス保護テストが失敗
- **状態**: 未修正
- **推奨**: 認証ミドルウェアの動作を確認

#### 1.3 flm-proxy performance_test（5テスト失敗）
- **問題**: パフォーマンステストが失敗
  - Resource protection should not throttle healthy traffic
  - High-cardinality IP traffic should remain healthy
- **状態**: 未修正
- **推奨**: リソース保護のロジックを確認

### 2. エラーハンドリングのテスト

#### 2.1 `unwrap()`/`expect()`が使用されている箇所のテスト
- **対象ファイル**:
  - `crates/apps/flm-cli/src/adapters/engine_health_log.rs`
  - `crates/services/flm-proxy/src/controller.rs`
  - `crates/services/flm-proxy/src/metrics.rs`
- **推奨**: エラーケースのテストを追加

#### 2.2 エッジケースのテスト
- **対象**:
  - 境界値テスト（rate limit boundary conditions）
  - 同時リクエストのテスト
  - タイムアウトのテスト
- **ファイル**: `crates/services/flm-proxy/tests/integration_test.rs`

### 3. セキュリティ機能のテスト拡張

#### 3.1 IPブロックリストのテスト
- **対象**: 
  - IPブロックリストの追加/削除
  - 一時ブロックの動作
  - 永続ブロックの動作
- **ファイル**: `crates/services/flm-proxy/tests/security_test.rs`

#### 3.2 侵入検知システムのテスト
- **対象**:
  - 侵入検知スコアの計算
  - ブロック閾値のテスト
  - スコアのリセット
- **ファイル**: `crates/services/flm-proxy/tests/security_test.rs`

#### 3.3 異常検知システムのテスト
- **対象**:
  - 異常パターンの検出
  - アラートの生成
- **ファイル**: `crates/services/flm-proxy/tests/security_test.rs`

## 🟠 優先度: 中（リリース前に推奨）

### 4. 統合テストの拡張

#### 4.1 エンドツーエンドフローのテスト
- **対象**:
  - エンジン検出からモデルリスト取得までのフロー
  - プロキシ起動からチャット送信までのフロー
  - セキュリティ機能の統合テスト
- **ファイル**: `crates/apps/flm-cli/tests/e2e_test.rs`

#### 4.2 データベース操作のテスト
- **対象**:
  - マイグレーションのテスト
  - トランザクションのテスト
  - エラーハンドリングのテスト
- **ファイル**: `crates/apps/flm-cli/src/db/migration.rs`

### 5. 証明書管理のテスト

#### 5.1 証明書生成のテスト
- **対象**:
  - 自己署名証明書の生成
  - ACME証明書の生成
  - 証明書の検証
- **ファイル**: `crates/core/flm-core/src/services/certificate.rs`

#### 5.2 ACME統合のテスト
- **対象**:
  - HTTP-01チャレンジのテスト
  - DNS-01チャレンジのテスト
  - 証明書の更新
- **ファイル**: `crates/services/flm-proxy/src/controller.rs`

### 6. パフォーマンステストの修正

#### 6.1 リソース保護のパフォーマンステスト
- **問題**: パフォーマンステストが失敗
- **推奨**: リソース保護のロジックを確認し、テストを修正

## 🟡 優先度: 低（リリース後に実装可能）

### 7. E2Eテストの追加

#### 7.1 実際のTauriアプリケーションでのテスト
- **対象**:
  - UI操作の自動化テスト
  - 実際のアプリケーションでの動作確認
- **ツール**: PlaywrightまたはCypress

### 8. アクセシビリティテスト

#### 8.1 ARIA属性の確認
- **対象**:
  - フォーム要素のラベル
  - ボタンのアクセシビリティ
  - ナビゲーションのアクセシビリティ
- **ツール**: axe-core、Pa11y

### 9. 負荷テスト

#### 9.1 高負荷時の動作確認
- **対象**:
  - 同時接続数のテスト
  - メモリリークの検出
  - CPU使用率の確認

## 推奨されるテスト実装順序

1. **失敗しているテストの修正**（高優先度）
   - flm-cli e2e_test::test_security_features_e2e
   - flm-proxy security_test::test_authentication_bypass_protection
   - flm-proxy performance_test

2. **セキュリティ機能のテスト拡張**（高優先度）
   - IPブロックリストのテスト
   - 侵入検知システムのテスト
   - 異常検知システムのテスト

3. **エラーハンドリングのテスト追加**（高優先度）
   - `unwrap()`/`expect()`が使用されている箇所のテスト
   - エッジケースのテスト

4. **統合テストの拡張**（中優先度）
   - エンドツーエンドフローのテスト
   - データベース操作のテスト

5. **証明書管理のテスト**（中優先度）
   - 証明書生成のテスト
   - ACME統合のテスト

## 参考

- `docs/status/active/TEST_COVERAGE_ANALYSIS.md` - テストカバレッジ分析
- `docs/status/active/TEST_FIXES_IN_PROGRESS.md` - テスト修正進行中
- `docs/status/completed/tests/` - 完了したテストレポート
- `reports/` - テスト実行レポート

