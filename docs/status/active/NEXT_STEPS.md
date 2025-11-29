# 次の作業ステップ

> Status: Ready | Updated: 2025-11-26 | Audience: All contributors

## 現在のスナップショット（2025-11-26）
- **完了済み**: Phase 0〜2、Security Phase 1〜3、主要CLI/Proxy/UI統合は `docs/status/completed/` と `reports/FULL_TEST_EXECUTION_REPORT.md` に記録済み。
- **参照専用**: `archive/prototype/` はアーカイブ。生成物は `prototype-generated-assets.zip` に集約し、日常作業から切り離しています。
- **アクティブファイル**: `docs/status/active/PHASE1_PROGRESS.md`, `BOTNET_PROTECTION_PLAN.md`, `PHASE1_NEXT_STEPS.md`, `LINT_REMEDIATION_STATUS.md`, `TEST_ENVIRONMENT_SETUP.md`, `TEST_ENVIRONMENT_STATUS.md`, `UNIMPLEMENTED_REPORT.md`, `UNIMPLEMENTED_ANALYSIS.md` が最新状態を追跡します。

## 優先タスク
| # | 項目 | 期待成果 | 参照 |
|---|------|----------|------|
| 1 | Proxyコンパイルエラー解消 | `flm-proxy` の `axum` ハンドラーと `EngineProcessController` の `Sync` 問題を修正し、`reports/` に新しいビルドログを追加 | `docs/status/completed/fixes/COMPILATION_ISSUE_RESOLVED.md` |
| 2 | Lint/Clippy差分解消 | `LINT_REMEDIATION_STATUS.md` にあるスタイル/Clippy修正を消化し、CIツールをグリーンに戻す | `docs/status/active/LINT_REMEDIATION_STATUS.md` |
| 3 | Phase 3 パッケージング | `packaged-ca` モード実装、インストーラー/コード署名方針の確定、`PHASE3_PACKAGING_PLAN.md` の更新 | `docs/planning/PHASE3_PACKAGING_PLAN.md`, `docs/status/active/PHASE1_PROGRESS.md` |
| 4 | セキュリティUIテスト拡充 | Botnet対策UIやセキュリティログUIの統合テストを追加し、結果を `reports/` に集約 | `docs/status/active/BOTNET_PROTECTION_PLAN.md`, `docs/status/active/TEST_ENVIRONMENT_STATUS.md` |
| 5 | ドキュメント/レポート整備 | `docs/DOCUMENTATION_STRUCTURE.md`, `docs/status/README.md`, `reports/README.md` を最新構成に揃え、重複レポートを解消 | `docs/status/completed/tasks/FINAL_SUMMARY.md` (Housekeeping欄参照) |

## 実行順序の推奨
1. **ビルド復旧** – `cargo check`, `cargo clippy`, `cargo test` を実行し、失敗時は新しい fix レポートを起票（参考: `docs/status/completed/fixes/COMPILATION_ISSUE_RESOLVED.md`）。成功ログは `reports/` へ。
2. **Lint対応** – `LINT_REMEDIATION_STATUS.md` のTODOを順次消化し、完了後に `reports/` に結果を添付。
3. **Phase 3 作業** – `packaged-ca` モード、インストーラーPoC、署名/配布フローを順に実装し、進捗を `PHASE3_PACKAGING_PLAN.md` に反映。
4. **テスト拡充** – セキュリティUI/CLIの回帰テストを追加し、結果を `reports/FULL_TEST_EXECUTION_REPORT.md` にリンク。
5. **ドキュメント更新** – 各タスク完了時に `docs/status/active/*` から `docs/status/completed/*` へ移動し、本ファイルの表と日付を更新。

## チェックリスト
- [ ] Proxyビルドエラーの再発防止策を実装し、レポートを `reports/` に追加（2025-11-26: `reports/BUILD_LOG_20251126B.md` に Tool-First 成果を記録。fmt/clippy/check は通過、`cargo test` は `flm-engine-ollama` 既知課題で停止）
- [ ] Lint/Clippy差分ゼロを確認（`cargo fmt --check`, `cargo clippy` で検証）
- [ ] `packaged-ca` モード用 `rcgen` API 改修を完了
- [ ] セキュリティUIの統合テストを追加し `reports/` に結果を反映
- [ ] ドキュメント更新後は `docs/status/README.md` と `docs/DOCUMENTATION_STRUCTURE.md` の該当セクションを同期

## 参考リンク
- `docs/planning/PLAN.md`
- `docs/planning/PHASE3_PACKAGING_PLAN.md`
- `docs/status/active/PHASE1_PROGRESS.md`
- `docs/status/completed/proxy/PROXY_SERVICE_PHASE2_COMPLETE.md`
- `docs/status/active/BOTNET_PROTECTION_PLAN.md`
- `docs/status/completed/tasks/FINAL_SUMMARY.md`
- `reports/FULL_TEST_EXECUTION_REPORT.md`, `reports/FULL_TEST_EXECUTION_SUMMARY.md`

---

**更新日**: 2025-11-26  
**現在のフェーズ**: Phase 2 完了 / Phase 3 パッケージング準備中 / ビルド & ドキュメント整備タスク進行中