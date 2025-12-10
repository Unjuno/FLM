# セキュリティ機能テストカバレッジ

> Updated: 2025-02-01 | Status: In Progress

## 既存のテスト

### IPブロックリスト (`botnet_security_test.rs`)
- ✅ `test_ip_blocklist_is_blocked_initially_false` - 初期状態の確認
- ✅ `test_ip_blocklist_record_failure_warning_only` - 警告のみの状態
- ✅ `test_ip_blocklist_record_failure_5_times_30min_block` - 5回失敗で30分ブロック
- ✅ `test_ip_blocklist_record_failure_10_times_24h_block` - 10回失敗で24時間ブロック
- ✅ `test_ip_blocklist_record_failure_20_times_permanent_block` - 20回失敗で永続ブロック
- ✅ `test_ip_blocklist_unblock` - ブロック解除

### 侵入検知 (`integration_test.rs`)
- ✅ `test_botnet_integration_ip_block_and_intrusion` - 統合テスト（認証失敗によるブロック）

### 異常検知 (`integration_test.rs`)
- ✅ `test_anomaly_detection_integration` - SQLインジェクション検知
- ✅ `test_anomaly_detection_statistical_analysis` - 統計的異常検知
- ✅ `test_anomaly_detection_pattern_detection` - パターン検知
- ✅ `test_anomaly_detection_repeated_404s` - 繰り返し404エラー検知

## 不足しているテスト

### IPブロックリスト
- ⏳ データベース永続化テスト（起動時の読み込み）
- ⏳ データベース同期テスト（5分ごとの同期）
- ⏳ 複数IPの同時ブロックテスト
- ⏳ ブロック期限の自動解除テスト
- ⏳ 侵入検知による自動ブロックテスト
- ⏳ 異常検知による自動ブロックテスト

### 侵入検知
- ⏳ スコアリングロジックの詳細テスト
- ⏳ ブロック閾値（100, 200）のテスト
- ⏳ 様々な侵入パターンのテスト
- ⏳ スコアの減衰テスト

### 異常検知
- ⏳ 様々な異常パターンのテスト
- ⏳ スコアリングロジックの詳細テスト
- ⏳ ブロック閾値のテスト
- ⏳ 正常なトラフィックとの区別テスト

### リソース保護
- ⏳ CPU使用率閾値テスト
- ⏳ メモリ使用率閾値テスト
- ⏳ スロットリング動作テスト
- ⏳ 正常なトラフィックへの影響テスト

## 次のステップ

1. IPブロックリストの包括的テストを追加
2. 侵入検知の詳細テストを追加
3. 異常検知の詳細テストを追加
4. リソース保護のテストを追加

