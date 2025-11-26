# 未実装事項レポート（2025-11-25）

> Status: Reference | Audience: All contributors | Updated: 2025-11-25

本レポートは現行のドキュメント／仕様から判明している未実装・未整備の項目をまとめたものです。優先度は `docs/status/active/NEXT_STEPS.md` を参照してください。

## 最新更新
- 2025-11-25: `docs/specs/CORE_API.md` に Versioning Policy 準拠の `## Changelog` セクションを追加（`1.0.0` / `1.1.0` の履歴を整備済み）。
- 2025-11-25: `docs/specs/PROXY_SPEC.md` に `## Changelog` セクションを追加し、TLS/packaged-ca ドラフト更新を記録。
- 2025-11-25: `docs/specs/ENGINE_DETECT.md` に `## Changelog` を追加し、初版 (v1.0.0) の履歴を明記。
- 2025-11-25: `scripts/align_versions.rs` を実装（Core API バージョンと CLI/Proxy クレートバージョンの突合せレポートツール）。
- 2025-11-25: マイグレーション失敗時の読み取り専用モード仕様を実装（`flm-cli` の `SqliteSecurityRepository` でマイグレーション失敗時に読み取り専用モードで再接続し、書き込み操作を `RepoError::ReadOnlyMode` で拒否）。
- 2025-11-25: Botnet機能テストを実装（`crates/flm-proxy/tests/botnet_security_test.rs` に16テスト追加）。
- 2025-11-25: `docs/status/active/UNIMPLEMENTED_ANALYSIS.md` を更新（HTTPストリーミング、リソース保護、IPベースレート制限、Engine Adapter拡張が実装済みであることを記録）。
- 2025-11-25: 用語集（`docs/guides/GLOSSARY.md`）を実装（FLMプロジェクトで使用される主要な用語をアルファベット順に整理）。
- 2025-11-25: 文書更新ポリシー（`docs/guides/DOCUMENTATION_UPDATE_POLICY.md`）を実装（ドキュメントの分類、更新手順、品質基準、レビュープロセスを定義）。
- 2025-11-25: `docs/specs/DB_SCHEMA.md` に Versioning Policy 準拠の `## Changelog` セクションを追加（初版 v1.0.0 の履歴を明記）。
- 2025-11-25: `docs/specs/CLI_SPEC.md` に Versioning Policy 準拠の `## Changelog` セクションを追加（初版 v1.0.0 の履歴を明記）。
- 2025-11-25: `docs/specs/FEATURE_SPEC.md` に Versioning Policy 準拠の `## Changelog` セクションを追加（初版 v1.0.0 の履歴を明記）。
- 2025-11-25: Axum Handler/Sync ビルドエラーを解決（`EngineService` の `Send + Sync` 対応によりコンパイル成功）。レポートを `docs/status/completed/fixes/COMPILATION_ISSUE_RESOLVED.md` に移動。
- 2025-11-25: Proxy Phase 2統合テストを実装（`crates/flm-proxy/tests/integration_test.rs` に `/v1/models` エンドポイントと `ProxyController::status` のテストを追加、14テストすべて成功）。
- 2025-11-25: `ci-cli` スクリプトを実装（`scripts/ci-cli.sh` と `scripts/ci-cli.ps1` を追加。フォーマットチェック、Clippyチェック、ユニットテスト、統合スモークテストを実行）。
- 2025-11-25: `ci-proxy-load` スクリプトを実装（`scripts/ci-proxy-load.sh` と `scripts/ci-proxy-load.ps1` を追加。k6またはwrk2を使用したプロキシ負荷テストを実行）。
- 2025-11-25: `ci-acme-smoke` スクリプトを実装（`scripts/ci-acme-smoke.sh` と `scripts/ci-acme-smoke.ps1` を追加。ACME証明書発行のスモークテストを実行。証明書発行時間（<90秒）とHTTPSエンドポイントの動作を検証）。
- 2025-11-25: 全クレートのREADME追加（`flm-proxy/README.md`, `flm-cli/README.md`, 全エンジンアダプターのREADMEを追加。各クレートの目的、機能、使用方法を文書化）。
- 2025-11-25: `flm-core/README.md` のStatusセクションを更新（Phase 1完了を反映し、実装済みサービス一覧を追加）。
- 2025-11-25: `reports/BUILD_LOG_20251125.md` を更新（今日の実装内容を記録）。

---

## 1. Proxy / セキュリティ領域
1. **Proxy Phase 2 実装**  
   - ✅ 2025-11-25 に実装完了: `flm-proxy` の認証ミドルウェア、`/v1/models` ハンドラー、`ProxyService::start/stop/status`、`flm proxy start/stop/status` コマンド、統合テストを実装（14テスト、すべて成功）。  
   - 参照: `docs/status/active/PROXY_SERVICE_PHASE2_PROGRESS.md`
2. **Axum Handler/Sync ビルドエラー**  
   - ✅ 2025-11-25 に解決: `EngineService` が保持する `EngineProcessController` / `HttpClient` / `EngineRepository` を `Box<dyn ... + Send + Sync>` へ拡張し、`State<AppState>` が `Send + Sync` を満たすように調整。`cargo check` でコンパイル成功を確認。  
   - 参照: `docs/status/completed/fixes/COMPILATION_ISSUE_RESOLVED.md`
3. **Botnet Phase 2/3**  
   - 異常検知、リソース保護、IPベースレート制限、ハニーポット、セキュリティUI可視化・管理UIが未実装。  
   - 参照: `docs/status/completed/security/SECURITY_PHASE1_COMPLETE.md`, `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`
4. **ホワイトリスト／ログレベル／アラート機能**  
   - `SECURITY_BOTNET_PROTECTION.md` のトラブルシューティング項目（正当ユーザーホワイトリスト、ログレベル調整、アラート通知）が将来実装予定。  
5. **DB保護の推奨事項**  
   - ✅ `security.db` 600権限設定は実装済み（Unix のみ、Windows は ACL デフォルトに依存）。  
   - ✅ マイグレーション失敗時の読み取り専用モード仕様は 2025-11-25 に実装（`flm-cli` の `SqliteSecurityRepository` でマイグレーション失敗時に読み取り専用モードで再接続し、書き込み操作を拒否）。  
   - `security.db` 暗号化は未対応（将来実装予定）。  
   - 参照: `docs/status/completed/safety/PHASE1_SAFETY_VERIFICATION.md`

## 2. CLI / Migration / Packaging
1. **Phase3 CLI コマンド未実装**  
   - `flm model-profiles`, `flm api prompts`, `flm migrate legacy` は仕様のみ。DB側の `model_profiles` / `api_prompts` テーブルも Post-MVP 計画。  
   - 参照: `docs/specs/CLI_SPEC.md`, `docs/specs/DB_SCHEMA.md`
2. **Packaged-CA モード**  
   - ルートCA生成、サーバ証明書自動発行、OS信頼ストア登録、アンインストーラでの削除、Linux GPG署名が未実装。  
   - `rcgen` API不一致で Step1 から停滞。参照: `docs/planning/PHASE3_PACKAGING_PLAN.md`
3. **Migration ガイド／ツール**  
   - `MIGRATION_GUIDE.md` は Draft、`flm migrate legacy` CLI も未実装。  
4. **バージョン管理ツール**  
   - ✅ `scripts/tag_core_api.sh` は 2025-11-25 に実装（`docs/specs/CORE_API.md` 同期 + `core-api-v*` タグ作成）。  
   - ✅ `scripts/align_versions.rs` は 2025-11-25 に実装（Core API バージョンと CLI/Proxy クレートバージョンの突合せレポートを出力）。  
   - 参照: `docs/guides/VERSIONING_POLICY.md`, `docs/changelog/CHANGELOG.md`

## 3. UI / UX
1. **UI Phase 2 残項目**  
   - セキュリティイベント可視化、IPブロックリスト管理、Setup Wizard Firewall自動適用 IPC、Chat Tester など未実装。  
   - 参照: `docs/specs/UI_MINIMAL.md`, `docs/status/active/NEXT_STEPS.md`
2. **UI Extensions**  
   - モデル詳細設定パネル、APIプロンプト管理、モデル比較/ヘルス履歴、i18n、多言語テストなどは計画のみ。  
   - 参照: `docs/specs/UI_EXTENSIONS.md`
3. **I18N 実装**  
   - 翻訳ファイル、言語切替UI、`preferred_language` 保存、初回自動検出が TODO のまま。  
   - 参照: `docs/specs/I18N_SPEC.md`
4. **ダークモード**  
   - ブランドガイドラインでは Phase3 以降に実装予定。  
   - 参照: `docs/specs/BRAND_GUIDELINE.md`

## 4. Engine / Core
1. **Engine Adapter 拡張**  
   - ✅ `flm-engine-vllm`, `flm-engine-lmstudio`, `flm-engine-llamacpp` は実装済み（`crates/flm-cli/src/commands/models.rs` で登録処理も実装済み）。  
   - ✅ `EngineService::list_models` 統合は実装済み。  
   - ✅ キャッシュTTLチェックは実装済み（`crates/flm-cli/src/adapters/engine.rs` の `list_cached_engine_states()` でTTLを考慮）。  
   - 参照: `docs/status/active/PHASE1_NEXT_STEPS.md`
2. **Proxy拡張**  
   - `/v1/audio/*` 等の将来API、Proxy設定ホットリロードは未決事項。  
   - 参照: `docs/specs/PROXY_SPEC.md`
3. **PackagedCa / Wildcard ACME**  
   - `ProxyMode::PackagedCa`、ACMEワイルドカード対応が Phase3 予定のまま。  
   - 参照: `docs/specs/CORE_API.md`

## 5. Monitoring / Testing / Audits
1. **CI & Regression セットアップ**  
   - ✅ `ci-cli` スクリプトは 2025-11-25 に実装（`scripts/ci-cli.sh` と `scripts/ci-cli.ps1` を追加。フォーマットチェック、Clippyチェック、ユニットテスト、統合スモークテストを実行）。  
   - ✅ `ci-proxy-load` スクリプトは 2025-11-25 に実装（`scripts/ci-proxy-load.sh` と `scripts/ci-proxy-load.ps1` を追加。k6またはwrk2を使用したプロキシ負荷テストを実行。P50/P95レイテンシとエラー率を測定）。  
   - ✅ `ci-acme-smoke` スクリプトは 2025-11-25 に実装（`scripts/ci-acme-smoke.sh` と `scripts/ci-acme-smoke.ps1` を追加。ACME証明書発行のスモークテストを実行。証明書発行時間（<90秒）とHTTPSエンドポイントの動作を検証）。  
   - ⏳ Grafanaレポートは未実装。  
   - 参照: `docs/guides/TEST_STRATEGY.md`
2. **Botnet機能テスト未整備**  
   - ✅ 2025-11-25 に実装完了: `crates/flm-proxy/tests/botnet_security_test.rs` に IPブロック機能と侵入検知機能の単体テストを追加（16テスト、すべて成功）。  
   - 参照: `docs/status/completed/security/SECURITY_PHASE1_COMPLETE.md`
3. **監査レポート Pending**  
   - `CLI_AUDIT.md`, `SECURITY_AUDIT_PHASE1.md`, UI/Packaging 監査など多数が “Pending”。  
4. **ドキュメント改善事項**  
   - ✅ 用語集は 2025-11-25 に実装（`docs/guides/GLOSSARY.md` に主要用語をアルファベット順で整理）。  
   - ✅ 文書更新ポリシーは 2025-11-25 に実装（`docs/guides/DOCUMENTATION_UPDATE_POLICY.md` に更新ルールとガイドラインを定義）。  
   - ✅ 依存関係図は既に存在（`docs/planning/diagram.md`）。  
   - ✅ ADRテンプレは既に存在（`docs/templates/ADR_TEMPLATE.md`）。  
   - 参照: `docs/status/completed/safety/EVALUATION_REPORT.md`

---

### 参考
- 進行状況と優先度: `docs/status/active/NEXT_STEPS.md`
- 計画全体: `docs/planning/PLAN.md`
- 仕様書一覧: `docs/specs/`
- 状態レポート: `docs/status/`
- テスト／監査ログ: `reports/`

