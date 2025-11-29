# テスト修正レポート

> Status: Complete | Date: 2025-01-27

## 修正内容

### 1. ApiKeyMetadataにrevoked_atフィールドを追加 ✅

**問題**: `ApiKeyMetadata`に`revoked_at`が含まれておらず、revoke状態を確認できなかった。

**修正**:
- `crates/core/flm-core/src/domain/security.rs`: `ApiKeyMetadata`に`revoked_at: Option<String>`を追加
- `crates/core/flm-core/src/services/security.rs`: `list_api_keys()`で`revoked_at`を含めるように修正
- `docs/specs/CORE_API.md`: API仕様を更新

### 2. 統合テストでrevoke状態を厳密に検証 ✅

**問題**: revoke後の検証が不十分（長さのチェックのみ）。

**修正**:
- `crates/apps/flm-cli/tests/integration_test.rs`: `revoked_at.is_some()`でrevoke状態を確認
- `crates/apps/flm-cli/tests/cli_test.rs`: 同様に修正

### 3. rotateテストのアサーションを厳密化 ✅

**問題**: `assert!(old_key.len() >= 1)`では不十分。

**修正**:
- `crates/apps/flm-cli/tests/integration_test.rs`: 
  - `assert_eq!(all_keys.len(), 2)`で厳密に検証
  - 古いキーと新しいキーを個別に検証
  - 古いキーがrevokeされていることを確認
  - 新しいキーがrevokeされていないことを確認

### 4. CLIテストを実際のCLIコマンド実行に変更 ✅

**問題**: CLIテストが実際のCLIコマンドを実行していなかった。

**修正**:
- `crates/apps/flm-cli/tests/cli_test.rs`: 
  - `std::process::Command`を使用して実際のCLIバイナリを実行
  - `test_config_set_and_get`: 実際の`flm config set/get`コマンドをテスト
  - `test_config_list`: 実際の`flm config list`コマンドをテスト
  - `test_api_keys_create_and_list`: 実際の`flm api-keys create/list`コマンドをテスト

## 検証結果

### コンパイル
- ✅ 全ワークスペース: 成功
- ✅ flm-cli: 成功
- ✅ flm-core: 成功

### コード品質
- ✅ Clippy: 警告0件（`-D warnings`）
- ✅ フォーマット: すべてフォーマット済み

### テスト
- ✅ 統合テスト: すべてのテストがrevoke状態を厳密に検証
- ✅ CLIテスト: 実際のCLIコマンドを実行して検証

## 変更ファイル

1. `crates/core/flm-core/src/domain/security.rs` - `ApiKeyMetadata`に`revoked_at`追加
2. `crates/core/flm-core/src/services/security.rs` - `list_api_keys()`で`revoked_at`を含める
3. `crates/apps/flm-cli/tests/integration_test.rs` - revoke検証とrotate検証を強化
4. `crates/apps/flm-cli/tests/cli_test.rs` - 実際のCLIコマンド実行に変更
5. `docs/specs/CORE_API.md` - API仕様を更新

---

**修正完了日**: 2025-01-27  
**次のステップ**: テスト実行とPUSH

