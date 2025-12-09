# テストカバレッジ分析

> Updated: 2025-02-01 | Status: Active

## 現在のテスト状況

### Rustテスト

**テストファイル数**: 51ファイル
**テストケース数**: 約563テスト

**成功率**: 
- flm-core: 100% ✅
- flm-cli: 96.8% (30/31) ⚠️
- flm-proxy: 71.4% (5/7) ⚠️
- flm-engine-llamacpp: 100% ✅
- flm-engine-ollama: 100% ✅
- flm-engine-vllm: 33.3% (2/6) ❌

### TypeScript/Reactテスト

**テストファイル数**: 33ファイル
**テストケース数**: 1,309ケース
**成功率**: 83.3% (1,090/1,309)

## 失敗しているテスト

### 1. flm-cli e2e_test::test_security_features_e2e
- **問題**: レート制限テストが失敗（5回目のリクエストがレート制限されている）
- **状態**: 調査中（ミドルウェア順序は修正済み）

### 2. flm-engine-vllm
- **問題**: 4テスト失敗（ヘルスチェックテストのアサーション問題）
- **状態**: 未修正

## テストすべき領域

### 🔴 高優先度（リリース前に必須）

#### 1. エラーハンドリングのテスト
- **対象**: 
  - `unwrap()`/`expect()`が使用されている箇所（約17箇所）
  - エラーケースのテスト
- **ファイル**: 
  - `crates/apps/flm-cli/src/adapters/engine_health_log.rs`
  - `crates/services/flm-proxy/src/controller.rs`
  - `crates/services/flm-proxy/src/metrics.rs`

#### 2. セキュリティ機能のテスト
- **対象**:
  - IPブロックリストの動作確認
  - 侵入検知システムのテスト
  - 異常検知システムのテスト
  - リソース保護のテスト
- **ファイル**:
  - `crates/services/flm-proxy/tests/security_test.rs`
  - `crates/services/flm-proxy/tests/botnet_security_test.rs`

#### 3. エッジケースのテスト
- **対象**:
  - 境界値テスト（rate limit boundary conditions）
  - 同時リクエストのテスト
  - タイムアウトのテスト
- **ファイル**:
  - `crates/services/flm-proxy/tests/integration_test.rs`

#### 4. flm-engine-vllmのテスト修正
- **問題**: ヘルスチェックテストのアサーションが失敗
- **状態**: 未修正

### 🟠 中優先度（リリース前に推奨）

#### 5. パフォーマンステスト
- **対象**:
  - レート制限のパフォーマンス
  - 同時接続数のテスト
  - メモリ使用量のテスト
- **ファイル**:
  - `crates/services/flm-proxy/tests/performance_test.rs`

#### 6. 統合テストの拡張
- **対象**:
  - エンジン検出からモデルリスト取得までのフロー
  - プロキシ起動からチャット送信までのフロー
  - セキュリティ機能の統合テスト
- **ファイル**:
  - `crates/apps/flm-cli/tests/e2e_test.rs`
  - `crates/services/flm-proxy/tests/integration_test.rs`

#### 7. データベース操作のテスト
- **対象**:
  - マイグレーションのテスト
  - トランザクションのテスト
  - エラーハンドリングのテスト
- **ファイル**:
  - `crates/apps/flm-cli/src/db/migration.rs`

#### 8. 証明書管理のテスト
- **対象**:
  - 証明書生成のテスト
  - 証明書検証のテスト
  - ACME統合のテスト
- **ファイル**:
  - `crates/core/flm-core/src/services/certificate.rs`

### 🟡 低優先度（リリース後に実装可能）

#### 9. E2Eテストの追加
- **対象**:
  - 実際のTauriアプリケーションでの動作確認
  - UI操作の自動化テスト
- **ツール**: PlaywrightまたはCypress

#### 10. アクセシビリティテスト
- **対象**:
  - ARIA属性の確認
  - キーボードナビゲーションのテスト
  - スクリーンリーダーのテスト
- **ツール**: axe-core、Pa11y

#### 11. 負荷テスト
- **対象**:
  - 高負荷時の動作確認
  - メモリリークの検出
  - CPU使用率の確認

## 推奨されるテスト実装順序

1. **flm-engine-vllmのテスト修正**（高優先度）
2. **e2e_testのレート制限テスト修正**（高優先度）
3. **セキュリティ機能のテスト拡張**（高優先度）
4. **エラーハンドリングのテスト追加**（高優先度）
5. **パフォーマンステストの実行**（中優先度）
6. **統合テストの拡張**（中優先度）

## 参考

- `docs/status/active/TEST_SUMMARY.md` - テストサマリー
- `docs/status/completed/tests/` - 完了したテストレポート
- `reports/` - テスト実行レポート

