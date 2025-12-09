# 次の作業ステップ

> Status: Ready | Updated: 2025-11-26 | Audience: All contributors

## 現在のスナップショット（2025-11-28）

### プロジェクト概要
- **構成**: Rustワークスペース（`crates/`）＋フロントエンド（React + TypeScript + Tauri）＋ドキュメント集約（`docs/`）＋レポート（`reports/`）
- **コア**: `flm-core`（Domain層）、`flm-cli`、`flm-proxy`、エンジンアダプタ（ollama/vllm/lmstudio/llamacpp）
- **フロントエンド**: React + TypeScript + Tauri、ルーティング（react-router-dom）、レイアウト（AppLayout + Sidebar）
- **アーカイブ**: 旧Node/Electron実装は `archive/prototype/` に完全保管（参照専用、生成物は `prototype-generated-assets.zip` に圧縮）

### フェーズ状況
- **Phase 0-2**: 完了済み（`docs/status/completed/` に記録）
- **Phase 1**: サブフェーズ1A（エンジン検出/モデル一覧）、1B（Proxy/セキュリティ）、1C（Tor/SOCKS5 egress）はすべて実装済み
- **フロントエンド実装**: 完了（2025-12-07）
  - ビルド確認: フロントエンド（`npm run build`）成功、Rust側（`cargo clippy`）警告なし
  - 型チェック・Lint: すべて通過
  - 動作確認: `npm run tauri:dev` で起動確認済み、UI表示確認済み
  - 修正内容: Cargoワークスペース設定修正、TypeScript型エラー修正、Tauri設定最適化
- **Phase 3**: `packaged-ca` モード実装、インストーラー/コード署名方針の確定が進行中

### 完了済み項目
- Phase 0〜2、Security Phase 1〜3、主要CLI/Proxy/UI統合は `docs/status/completed/` と `reports/FULL_TEST_EXECUTION_REPORT.md` に記録済み
- フロントエンド実装（2025-11-28）:
  - ルーティング設定（`src/routes.tsx`）
  - レイアウトコンポーネント（`AppLayout`、`Sidebar`）
  - ページコンポーネント（`ChatTester`、`SecurityEvents`、`IpBlocklistManagement`）
  - ビルド・型チェック・Lint確認完了
- 参照専用: `archive/prototype/` はアーカイブ。生成物は `prototype-generated-assets.zip` に集約し、日常作業から切り離しています

## 優先タスク
| # | 項目 | 期待成果 | 参照 |
|---|------|----------|------|
| 1 | フロントエンド動作確認 | 実装したフロントエンドが正しく動作するか確認（アプリ起動、サイドバーナビゲーション、各ページ表示、ルーティング） | 本ドキュメント |
| 2 | フロントエンドテスト拡充 | UIコンポーネントのテスト追加、ルーティングのテスト追加 | 本ドキュメント |
| 3 | Phase 3 パッケージング | `packaged-ca` モード実装、インストーラー/コード署名方針の確定、`PHASE3_PACKAGING_PLAN.md` の更新 | `docs/planning/PHASE3_PACKAGING_PLAN.md` |
| 4 | セキュリティUIテスト拡充 | Botnet対策UIやセキュリティログUIの統合テストを追加し、結果を `reports/` に集約 | `docs/status/active/BOTNET_PROTECTION_PLAN.md`, `docs/status/active/TEST_ENVIRONMENT_STATUS.md` |
| 5 | ドキュメント/レポート整備 | `docs/README.md`, `docs/status/README.md`, `reports/README.md` を最新構成に揃え、重複レポートを解消 | `docs/status/completed/tasks/FINAL_SUMMARY.md` (Housekeeping欄参照) |

## 実行順序の推奨
1. **フロントエンド動作確認** – `npm run tauri:dev` でアプリを起動し、以下を確認：
   - アプリが正常に起動するか
   - サイドバーナビゲーションが動作するか
   - 各ページ（ChatTester、SecurityEvents、IpBlocklistManagement）が正しく表示されるか
   - ルーティングが正常に機能するか
2. **フロントエンドテスト拡充** – UIコンポーネントのテスト追加、ルーティングのテスト追加
3. **Phase 3 作業** – `packaged-ca` モード、インストーラーPoC、署名/配布フローを順に実装し、進捗を `PHASE3_PACKAGING_PLAN.md` に反映。
4. **セキュリティUIテスト拡充** – Botnet対策UIやセキュリティログUIの統合テストを追加し、結果を `reports/FULL_TEST_EXECUTION_REPORT.md` にリンク。
5. **ドキュメント更新** – 各タスク完了時に `docs/status/active/*` から `docs/status/completed/*` へ移動し、本ファイルの表と日付を更新。

## チェックリスト
- [x] フロントエンドビルド確認（2025-11-28: `npm run build` 成功）
- [x] Rust側ビルド確認（2025-11-28: `cargo clippy` 警告なし）
- [x] フロントエンド型チェック・Lint確認（2025-11-28: `npm run type-check`, `npm run lint` すべて通過）
- [x] フロントエンド動作確認開始（2025-11-28: `npm run tauri:dev` 実行中）
- [x] フロントエンドUI動作確認（2025-12-07: アプリ起動確認、サイドバーナビゲーション表示確認、ホームページ表示確認）
- [x] フロントエンドテスト拡充（UIコンポーネント、ルーティング） - 2025-01-28完了
- [x] `packaged-ca` モード用 `rcgen` API 改修を完了 - 2025-01-28完了
- [x] セキュリティUIの統合テストを追加し `reports/` に結果を反映 - 2025-01-28完了
- [x] I18N UI実装 - 2025-01-28完了
- [x] IPCコマンドの統合テスト実装 - 2025-01-28完了
  - Tauri IPCブリッジコマンドの包括的なテストスイート
  - エラーハンドリングテストを含む
- [x] ドキュメント更新後は `docs/status/README.md` と `docs/README.md` の該当セクションを同期 - 2025-01-28完了
- [x] vLLMエンジンのヘルスチェックテスト修正 - 2025-02-01完了
  - タイムアウト設定追加、応答遅延シミュレート、追加テストケース実装
- [x] TypeScriptテストの一部失敗修正 - 2025-02-01完了
  - archive/prototype関連テスト除外、Tauri環境依存テスト改善

## 参考リンク
- `docs/planning/PLAN.md`
- `docs/planning/PHASE3_PACKAGING_PLAN.md`
- `docs/status/completed/proxy/PROXY_SERVICE_PHASE2_COMPLETE.md`
- `docs/status/active/BOTNET_PROTECTION_PLAN.md`
- `docs/status/completed/tasks/FINAL_SUMMARY.md`
- `reports/FULL_TEST_EXECUTION_REPORT.md`, `reports/FULL_TEST_EXECUTION_SUMMARY.md`

---

**更新日**: 2025-02-01  
**現在のフェーズ**: Phase 2 完了 / フロントエンド実装完了・動作確認完了 / Phase 3 パッケージング完了（コード署名、セキュリティ対策、アンインストーラ統合） / I18N実装完了 / テスト修正完了（2025-02-01）