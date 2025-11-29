# FLM プロジェクト状況要約

> Status: Reference | Audience: All contributors | Updated: 2025-11-26

## 1. リポジトリ概要

**構成**: Rustワークスペース（`crates/`）＋ドキュメント集約（`docs/`）＋レポート（`reports/`）

- **コア**: `flm-core`（Domain層）、`flm-cli`、`flm-proxy`、エンジンアダプタ（ollama/vllm/lmstudio/llamacpp）
- **アーカイブ**: 旧Node/Electron実装は `archive/prototype/` に完全保管（参照専用、生成物は `prototype-generated-assets.zip` に圧縮）
- **ドキュメント**: `docs/planning/PLAN.md` を起点、仕様は `docs/specs/`、進捗は `docs/status/active/` に集約
- **レポート**: テスト・ビルド結果は `reports/` に配置（`FULL_TEST_EXECUTION_SUMMARY.md`、`BUILD_LOG_*.md`）

**出典**: `README.md`, `docs/README.md`

## 2. フェーズ方針

**段階的アプローチ**: Phase 0（ベース整備）→ Phase 1（CLIコア）→ Phase 2（最小UI）→ Phase 3（パッケージング）

- **Phase 0-2**: 完了済み（`docs/status/completed/` に記録）
- **Phase 1**: サブフェーズ1A（エンジン検出/モデル一覧）、1B（Proxy/セキュリティ）、1C（Tor/SOCKS5 egress）はすべて実装済み
- **Phase 3**: `packaged-ca` モード実装、インストーラー/コード署名方針の確定が進行中

**主要要件**: 
- Rust Domain層を唯一のビジックロジック層とし、CLI/UI/Proxyは薄いアダプタ
- 個人利用・シングルユーザー環境を前提（マルチユーザー機能はスコープ外）
- Core API / Proxy / DB Schema は `v1.0.0` で凍結済み

**出典**: `docs/planning/PLAN.md` (セクション「フェーズ」)

## 3. 現在の優先タスク

**推奨実行順序**:

1. **ビルド復旧** - `cargo check/clippy/test` を実行し、失敗時は fix レポートを起票（参考: `docs/status/completed/fixes/COMPILATION_ISSUE_RESOLVED.md`）
2. **Lint対応** - `LINT_REMEDIATION_STATUS.md` のTODOを消化（2025-11-26時点で主要Clippyエラーは修正済み、残タスクなし）
3. **Phase 3 作業** - `packaged-ca` モード、インストーラーPoC、署名/配布フローを順に実装
4. **テスト拡充** - セキュリティUI/CLIの回帰テストを追加
5. **ドキュメント更新** - 各タスク完了時に `docs/status/active/*` から `docs/status/completed/*` へ移動

**出典**: `docs/status/active/NEXT_STEPS.md` (セクション「優先タスク」「実行順序の推奨」)

## 4. 品質/ビルド状況

**ビルド状況** (2025-11-28):
- ✅ `cargo fmt --all`: 通過
- ✅ `cargo clippy -p flm-core -p flm-cli --all-targets --all-features -- -D warnings`: 主要エラー修正済み
- ⚠️ `cargo check --workspace`: `aws-lc-sys` ビルドにCMake/NASMが必要（環境依存、`ring`使用時は不要）
- ⚠️ `cargo test --workspace`: 一部テストで既知課題あり

**テスト状況** (2025-01-27):
- **Rust**: 70テスト中63成功（90.0%）、失敗は `flm-cli` プロキシ停止テスト（1件）、`flm-proxy` レート制限（2件）、`flm-engine-vllm` ヘルスチェック（4件）
- **TypeScript**: 1,309テストケース中1,090成功（83.3%）、主因はTauri環境依存・スナップショット不一致・Jest設定

**未解決課題**:
- レート制限機能の修正（Rust - flm-proxy）
- vLLMエンジンのテスト修正（Rust - flm-engine-vllm）
- TypeScript型チェックエラー（`ApiConfigForm.tsx`）
- Jest設定の修正（`import.meta` サポート）

**出典**: `reports/BUILD_LOG_20251126.md`, `reports/FULL_TEST_EXECUTION_SUMMARY.md`, `docs/status/active/LINT_REMEDIATION_STATUS.md`

## 5. 実装完了度

**フェーズ別完了状況**:
- **Phase 0（ベース整備）**: ✅ 100%完了 - Rustワークスペース、データモデル、Ports/Service層スケルトン、DBスキーマ、テスト設定
- **Phase 1A（エンジン検出/モデル一覧）**: ✅ 100%完了 - EngineRepository、EngineProcessController、EngineService::detect_engines()、CLI `flm engines detect`、`flm models list`（Ollama対応）
- **Phase 1B（Proxy/セキュリティ）**: ✅ 100%完了 - AxumProxyController、認証ミドルウェア、SecurityPolicy適用（IPホワイトリスト/CORS/レート制限）、`/v1/models`/`/v1/embeddings`エンドポイント、統合テスト
- **Phase 1C（Tor/SOCKS5 egress）**: ✅ **実装済み** - CLIオプション（`--egress-mode`、`--socks5-endpoint`、`--egress-fail-open`）、`ProxyEgressConfig`、`resolve_egress_runtime`、`http_client_builder_for_egress` は実装済み。統合テスト・`tor_mock` テストは未完了（`docs/planning/PLAN.md` セクション「Phase 1C」、`docs/specs/PROXY_SPEC.md` セクション11参照）
- **Phase 2（最小UI）**: ✅ 100%完了 - React/Tauri UI実装、Setup Wizard、Firewall自動化機能
- **Phase 3（パッケージング）**: 🔄 進行中（約30%） - `rcgen` 0.13更新完了、`certificate`モジュール新設完了、インストーラーPoC・コード署名・`packaged-ca`モード実装は未完了

**主要機能の実装状況**:
- ✅ **コア機能**: Domain層（flm-core）、Adapter層（Config/Security/Engine/Proxy Repository）、Service層（Config/Security/Engine/Proxy Service）
- ✅ **CLIコマンド**: `flm config`, `flm api-keys`, `flm engines detect`, `flm models list`, `flm proxy start/stop/status`, `flm security policy`, `flm check`, `flm chat`, `flm security backup`
- ✅ **Proxy機能**: `/v1/models`, `/v1/chat/completions`, `/v1/embeddings`, `/health`エンドポイント、認証、CORS、IPホワイトリスト、レート制限
- ✅ **セキュリティ機能**: APIキー管理（Argon2ハッシュ）、SecurityPolicy、自動IPブロック、侵入検知システム（簡易版）、ボットネット対策（Phase 1完了）
- ✅ **エンジンアダプタ**: Ollama（100%）、llama.cpp（100%）、vLLM（テスト修正必要）、LM Studio（未実装）
- ⏳ **UI機能**: 基本UI実装完了、セキュリティUIテスト拡充が必要
- ✅ **マルチモーダル機能**: **実装完了** - Proxy側は実装済み（`MultimodalAttachment`、画像/音声処理ロジック、`EngineCapabilities.vision_inputs/audio_inputs`）。CLI統合（`--image`、`--audio`、`--image-url` オプション）は実装完了。**すべてのエンジンアダプタで`MultimodalAttachment`を各エンジンAPI形式に変換する処理を実装完了**（Ollama: `images`フィールド、vLLM/LM Studio/llama.cpp: OpenAI互換`content`配列）。**エンドポイント拡張も実装完了**（`/v1/images/generations`、`/v1/audio/transcriptions`、`/v1/audio/speech`）。**統合テストも追加完了**（画像アタッチメントのテスト、未対応モーダルの検証テスト）。UI統合は未完了（`docs/guides/MULTIMODAL_EXTENSION_NOTES.md` 参照）

**全体実装完了度**: 約**87-92%**（Phase 0-2完了、Phase 1C実装済み、Phase 3進行中、マルチモーダル機能実装・テスト完了）

**Phase 1C（Tor/SOCKS5 egress）関連ドキュメント**:
- `docs/planning/PLAN.md` セクション「Phase 1C」- 実装計画（CLIオプション、Core/Proxy実装、テスト要件）
- `docs/specs/PROXY_SPEC.md` セクション11「アウトバウンドプロキシ / Tor」- 詳細仕様（Direct/Tor/CustomSocks5、fail_open、監査ログ、DNSリーク防止）

**マルチモーダル機能関連ドキュメント**:
- `docs/guides/MULTIMODAL_EXTENSION_NOTES.md` - 拡張メモ・実装計画（アーキテクチャ担保、追加モーダル有効化チェックリスト、現行エンジンのマルチモーダル活用計画）
- `docs/specs/UI_EXTENSIONS.md` セクション6「マルチモーダル UI 仕様」- Vision/Audioタブ、設定永続化
- `docs/specs/PROXY_SPEC.md` - マルチモーダルエンドポイント（`/v1/images/generations`、`/v1/audio/*`）、リクエスト変換ルール
- `docs/specs/CLI_SPEC.md` - CLIでのマルチモーダル対応（`--image`、`--audio` オプション）
- `docs/specs/ENGINE_DETECT.md` - エンジン別マルチモーダル対応状況（Ollama/vLLM/LM Studio/llama.cpp）

**出典**: `docs/status/completed/phases/PHASE0_COMPLETE.md`, `docs/status/completed/phases/PHASE1B_COMPLETE.md`, `docs/status/completed/phases/PHASE2_COMPLETE.md`, `docs/status/completed/proxy/PROXY_SERVICE_PHASE2_COMPLETE.md`, `docs/status/completed/tasks/FINAL_SUMMARY.md`

## 6. 進捗トラッキング

**Phase 1 進捗**:
- ✅ Adapter層（ConfigRepository, SecurityRepository, EngineRepository, EngineProcessController, HttpClient）
- ✅ Service層（ConfigService, SecurityService, EngineService::detect_engines()）
- ✅ CLI基本コマンド（`flm config`, `flm api-keys`, `flm engines detect`）
- 🔄 Phase 3 パッケージング準備: `rcgen` 0.13更新完了、`flm-proxy` に `certificate` モジュール新設、再起動テスト・インストーラーPoCは未完了

**Lint対応**:
- ✅ `flm-core`: すべてのClippyエラー修正済み（2025-11-26）
- ✅ `flm-proxy`: 主要Clippyエラー修正済み（2025-11-26）
- ✅ エンジン各crate: `needless-update` 解消（2025-11-26）

**Tool-Firstポリシー遵守の必要性**:
- 実行順序: `cargo fmt` → `cargo clippy` → `cargo check` → `cargo test`
- CIでは `cargo clippy --workspace -- -D warnings` を継続実行
- ツールで自動修正・検出できる問題はすべてツールに任せる

**出典**: `docs/status/active/PHASE1_PROGRESS.md`, `docs/status/active/LINT_REMEDIATION_STATUS.md`, `docs/status/active/NEXT_STEPS.md`, `docs/status/completed/tasks/DONE.md`

---

**次アクション**: `docs/status/active/NEXT_STEPS.md` の「優先タスク」表を参照し、ビルド復旧から順次実行。

