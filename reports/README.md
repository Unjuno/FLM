# Test & Audit Reports

> Status: Reference | Audience: All contributors | Updated: 2025-11-25

## 目的
テスト／監査実行ログをリポジトリ直下に集約し、`docs/status` から常に最新結果へリンクできるようにします。  
`docs/` 配下では要約やステータスのみを記載し、実行ログの原本は本ディレクトリで一元管理します。

## 命名ルール
- `*_TEST_REPORT*.md`: 1回の実行をまとめたサマリー。`FULL_TEST_EXECUTION_REPORT.md`（詳細）と`FULL_TEST_EXECUTION_SUMMARY.md`（要約）が最新版です。
- `*-results*.txt`: テストハーネスの生ログ。`rust-test-results*.txt`, `ts-test-results*.txt`, `test-results*.txt` の3系列を保管します。
- 新規レポートを追加する際は `YYYYMMDD` などの実行 ID を名称か本文に明記し、README へ追記してください。

## 最新アーティファクト
| 種別 | ファイル | 説明 |
| ---- | -------- | ---- |
| 詳細レポート | `FULL_TEST_EXECUTION_REPORT.md` | 直近の統合テスト実行ログ（すべてのスイートを網羅） |
| 要約 | `FULL_TEST_EXECUTION_SUMMARY.md` | 上記レポートのエグゼクティブサマリー |
| 追加レポート | `ALL_TESTS_EXECUTION_REPORT.md`, `COMPLETE_TEST_EXECUTION_REPORT.md`, `COMPREHENSIVE_TEST_REPORT.md`, `FINAL_TEST_REPORT.md`, `TEST_REPORT.md` | フェーズやユースケース別の補足レポート |
| テキストログ | `*-results*.txt`, `rust-tests-complete.txt`, `ts-test-results-complete.txt` | CLI / Rust / TS 各スイートの生ログ |

## 運用手順
1. **配置**: 新しいレポートまたはログはこのディレクトリに保存し、ルート直下に置かない。
2. **リンク更新**: `README.md`（ルート）、`docs/README.md`、`docs/status/active/NEXT_STEPS.md` など、該当ドキュメントから最新レポートへのリンクを張り替える。
3. **ステータス更新**: 実行完了後に `docs/status/active` の関連レポートを `completed/` へ移動し、今回のファイル名を明記する。
4. **アーカイブ**: 古いログを圧縮／移動する場合は `reports/archive/` を作成して収納し、本 README にアーカイブ日を記録する。

## 注意事項
- ログは機密情報を含む可能性があるため、共有時は必要部分のみ抽出する。
- 自動実行スクリプトでファイル名を上書きしないよう、実行 ID or タイムスタンプを含める。
- `docs/status` から参照されていないレポートがないか、定期的に棚卸しする（`rg -l "FULL_TEST_EXECUTION_REPORT"` docs のように検索）。

