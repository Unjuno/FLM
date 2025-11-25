# 未実装事項レポート（2025-11-25）

> Status: Reference | Audience: All contributors | Updated: 2025-11-25

本レポートは現行のドキュメント／仕様から判明している未実装・未整備の項目をまとめたものです。優先度は `docs/status/active/NEXT_STEPS.md` を参照してください。

---

## 1. Proxy / セキュリティ領域
1. **Proxy Phase 2 実装**  
   - `flm-proxy` の認証ミドルウェア、`/v1/models` ハンドラー、`ProxyService::start/stop/status`、`flm proxy start/stop/status` コマンド、統合テストが未完。  
   - 参照: `docs/status/active/PHASE1_NEXT_STEPS.md`, `docs/status/active/PROXY_SERVICE_PHASE2_PROGRESS.md`
2. **Axum Handler/Sync ビルドエラー**  
   - `handle_models` / `handle_chat_completions` が `Handler` を満たさず、`EngineProcessController` が `Sync` でないため `AppState` へ入れられない。  
   - 参照: `docs/status/active/COMPILATION_ISSUE.md`
3. **Botnet Phase 2/3**  
   - 異常検知、リソース保護、IPベースレート制限、ハニーポット、セキュリティUI可視化・管理UIが未実装。  
   - 参照: `docs/status/completed/security/SECURITY_PHASE1_COMPLETE.md`, `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`
4. **ホワイトリスト／ログレベル／アラート機能**  
   - `SECURITY_BOTNET_PROTECTION.md` のトラブルシューティング項目（正当ユーザーホワイトリスト、ログレベル調整、アラート通知）が将来実装予定。  
5. **DB保護の推奨事項**  
   - `security.db` 600権限設定、マイグレーション失敗時の読み取り専用モード仕様、`security.db` 暗号化などが未対応。  
   - 参照: `docs/status/completed/safety/PHASE1_SAFETY_VERIFICATION.md`

## 2. CLI / Migration / Packaging
1. **Phase3 CLI コマンド未実装**  
   - `flm model-profiles`, `flm api prompts`, `flm migrate legacy` は仕様のみ。DB側の `model_profiles` / `api_prompts` テーブルも Post-MVP 計画。  
   - 参照: `docs/specs/CLI_SPEC.md`, `docs/specs/DB_SCHEMA.md`
2. **Tor/SOCKS5 egress 実装待ち**  
   - 仕様はあるが CLI/Proxy 実装、監査ログ、`ProxyHandle.egress` 表示などが未着手。  
   - 参照: `docs/specs/PROXY_SPEC.md`, `docs/planning/PLAN.md`
3. **Packaged-CA モード**  
   - ルートCA生成、サーバ証明書自動発行、OS信頼ストア登録、アンインストーラでの削除、Linux GPG署名が未実装。  
   - `rcgen` API不一致で Step1 から停滞。参照: `docs/planning/PHASE3_PACKAGING_PLAN.md`
4. **Migration ガイド／ツール**  
   - `MIGRATION_GUIDE.md` は Draft、`flm migrate legacy` CLI も未実装。  
5. **バージョン管理ツール**  
   - `scripts/tag_core_api.sh`, `scripts/align_versions.rs` が “TBD”。Core API changelog も `1.0.0 - TBD` のまま。  
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
   - `flm-engine-vllm`, `flm-engine-lmstudio`, `flm-engine-llamacpp`、`EngineService::list_models` 統合、キャッシュTTLチェックが未実装。  
   - 参照: `docs/status/active/PHASE1_NEXT_STEPS.md`
2. **Proxy拡張**  
   - `/v1/audio/*` 等の将来API、Proxy設定ホットリロードは未決事項。  
   - 参照: `docs/specs/PROXY_SPEC.md`
3. **PackagedCa / Wildcard ACME**  
   - `ProxyMode::PackagedCa`、ACMEワイルドカード対応が Phase3 予定のまま。  
   - 参照: `docs/specs/CORE_API.md`

## 5. Monitoring / Testing / Audits
1. **CI & Regression セットアップ**  
   - `ci-cli`, `ci-proxy-load`, `ci-acme-smoke`、Grafanaレポート、テスト戦略は Draft 状態。  
   - 参照: `docs/guides/TEST_STRATEGY.md`
2. **Botnet機能テスト未整備**  
   - Phase1で追加した IPブロック／侵入検知に対する単体・統合テストが未実装。  
   - 参照: `docs/status/completed/security/SECURITY_PHASE1_COMPLETE.md`
3. **監査レポート Pending**  
   - `CLI_AUDIT.md`, `SECURITY_AUDIT_PHASE1.md`, UI/Packaging 監査など多数が “Pending”。  
4. **ドキュメント改善事項**  
   - 用語集、依存関係図、ADRテンプレ、文書更新ポリシーが不足。  
   - 参照: `docs/status/completed/safety/EVALUATION_REPORT.md`

---

### 参考
- 進行状況と優先度: `docs/status/active/NEXT_STEPS.md`
- 計画全体: `docs/planning/PLAN.md`
- 仕様書一覧: `docs/specs/`
- 状態レポート: `docs/status/`
- テスト／監査ログ: `reports/`

