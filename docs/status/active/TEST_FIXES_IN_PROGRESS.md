# テスト修正進行中

> Updated: 2025-02-01 | Status: In Progress

## 現在の状況

### 失敗しているテスト

1. **flm-cli e2e_test::test_security_features_e2e**
   - 問題: レート制限テストが失敗（6回目のリクエストが429を返すべきだが200を返す）
   - 原因: レート制限のロジックに問題がある可能性
   - 状態: 調査中

2. **flm-proxy integration_test::test_rate_limit_multiple_keys**
   - 問題: レート制限テストが失敗（6回目のリクエストが429を返すべきだが200を返す）
   - 原因: レート制限のロジックに問題がある可能性
   - 状態: 調査中

### 修正済み

- ✅ e2e_test: IPホワイトリストテスト - `trusted_proxy_ips`を設定

### 次のステップ

1. レート制限のロジックを修正
   - `check_rate_limit_with_info`関数の動作を確認
   - トークンバケットの補充ロジックを確認
   - `minute_count`のリセットロジックを確認

2. 他の失敗テストを確認
   - flm-engine-vllmのテスト
   - flm-proxyの他のレート制限テスト

## レート制限の実装詳細

### 現在のロジック

```rust
let would_exceed_minute_limit = (entry.minute_count + 1) > rpm;
let burst_limit_reached = entry.tokens_available < 1.0;
let allowed = !would_exceed_minute_limit && !burst_limit_reached;
```

### 期待される動作

- rpm=5, burst=5の場合:
  - 5回のリクエスト: すべて成功（minute_count=0..4, tokens_available=5..1）
  - 6回目のリクエスト: 失敗（minute_count=5, (5+1) > 5 = true）

### 問題の可能性

1. トークンバケットが時間経過で補充されるため、テストの間に補充が発生している
2. `minute_count`が正しく更新されていない
3. レート制限チェックが実行されていない（別のミドルウェアでブロックされている）

## 参考

- `crates/services/flm-proxy/src/middleware.rs` - レート制限の実装
- `crates/services/flm-proxy/tests/integration_test.rs` - 統合テスト
- `crates/apps/flm-cli/tests/e2e_test.rs` - E2Eテスト

