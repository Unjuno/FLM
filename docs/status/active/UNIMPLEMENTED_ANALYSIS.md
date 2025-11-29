# 未実装部分分析レポート

> Status: Analysis | Date: 2025-01-27

本レポートは、コードベース内の未実装部分を詳細に分析したものです。

---

## 1. コード内の未実装箇所（TODO/unimplemented!）

### 1.1 HTTPストリーミング実装

**ファイル**: `crates/services/flm-proxy/src/http_client.rs:85-134`

**状態**: ✅ 実装済み  
**実装内容**: `ReqwestHttpClient::stream()` メソッドで `reqwest::Response::bytes_stream()` を使用してストリーミングを実装。  
**影響**: HTTPストリーミング機能は使用可能。  
**優先度**: 解消済み

---

### 1.2 リソース保護（CPU/メモリ監視）

**ファイル**: `crates/services/flm-proxy/src/security/resource_protection.rs`

**状態**: ✅ 実装済み  
**実装内容**: `sysinfo` クレートを使用してCPU/メモリ使用率を監視。`get_cpu_usage()` と `get_memory_usage()` で実際のシステムリソースを取得し、閾値を超えた場合に `should_throttle()` が `true` を返す。  
**影響**: リソース保護機能は正常に動作。  
**優先度**: 解消済み

---

### 1.3 ポート可用性チェック

**ファイル**: `crates/core/flm-core/src/services/proxy.rs`

```70:101:crates/core/flm-core/src/services/proxy.rs
        Self::ensure_port_available(&config.listen_addr, config.port)?;

        if config.mode != ProxyMode::LocalHttp {
            let https_port = config.port.checked_add(1).ok_or_else(|| {
                ProxyError::InvalidConfig {
                    reason: format!(
                        "HTTPS port calculation overflowed for base port {}",
                        config.port
                    ),
                }
            })?;
            Self::ensure_port_available(&config.listen_addr, https_port)?;
        }
```

**状態**: ✅ 2025-11-25 に実装  
**更新内容**: `ProxyService::start` 前に HTTP/HTTPS ポートを `TcpListener::bind` で検証し、`PortInUse` または `InvalidConfig` を即座に返す `ensure_port_available` ヘルパーを追加。  
**影響**: ポート競合発生時に CLI が即座に失敗要因を提示できるようになった。  
**優先度**: 解消済み

---

### 1.4 テスト用Mock実装

**ファイル**: `crates/core/flm-core/src/services/engine.rs:413`

```412:414:crates/core/flm-core/src/services/engine.rs
        async fn register(&self, _engine: Arc<dyn LlmEngine>) {
            unimplemented!()
        }
```

**状態**: テスト用のため問題なし  
**影響**: なし（テストコード内のみ）

---

## 2. 主要な未実装機能（仕様ベース）

### 2.1 Proxy Phase 2 実装

**参照**: `docs/status/active/UNIMPLEMENTED_REPORT.md:10-12`

**未実装項目**:
- ✅ 認証ミドルウェアの完全実装（実装済み）
- ✅ `/v1/models` ハンドラーの統合テスト（実装済み）
- ✅ `ProxyService::start/stop/status` の統合テスト（実装済み）
- ✅ `flm proxy start/stop/status` コマンドの統合テスト（実装済み）

**現在の状態**:
- ✅ `/v1/models` ハンドラーは実装済み（`crates/services/flm-proxy/src/controller.rs:579`）
- ✅ 認証ミドルウェアは実装済み（`crates/services/flm-proxy/src/middleware.rs:644`）
- ✅ 統合テストは実装済み（`crates/services/flm-proxy/tests/integration_test.rs` に14テスト、すべて成功）

**実装日**: 2025-11-25

**優先度**: 解消済み

---

### 2.2 Botnet Phase 2/3 機能

**参照**: `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`

**未実装項目**:

#### Phase 2（高優先度）:
- [ ] **異常検知システムの完全実装**
  - 現在: 基本実装あり（`crates/services/flm-proxy/src/security/anomaly_detection.rs`）
  - 不足: 高度なパターン検出、機械学習ベースの検出
  
- [ ] **リソース保護の実装**
  - 現在: プレースホルダー実装（CPU/メモリ監視が常に0.0を返す）
  - 必要: `sysinfo` クレートとの統合
  
- [ ] **IPベースレート制限**
  - 現在: APIキーベースのレート制限は実装済み
  - 不足: IPアドレスベースのレート制限

#### Phase 3（中優先度）:
- [ ] **ハニーポット機能**
  - 未実装
  
- [ ] **セキュリティUI可視化**
  - 未実装
  
- [ ] **管理UI**
  - 未実装

**優先度**: 高（Phase 2）、中（Phase 3）

---

### 2.3 Packaged-CA モード

**参照**: `docs/specs/PROXY_SPEC.md:226-261`, `docs/planning/PHASE3_PACKAGING_PLAN.md`

**未実装項目**:
- [ ] ルートCA証明書の生成（ビルド時）
- [ ] サーバー証明書の自動生成（起動時）
- [ ] OS信頼ストアへの自動登録（インストール時）
- [ ] アンインストーラでの証明書削除
- [ ] Linux GPG署名

**現在の状態**:
- ✅ `ProxyMode::PackagedCa` は定義済み
- ✅ 基本的な構造は実装済み（`crates/services/flm-proxy/src/controller.rs:1422`）
- ❌ 実際の証明書生成・管理機能は未実装
- ❌ `rcgen` API不一致で Step1 から停滞

**優先度**: 中（Phase 3）

---

### 2.4 Engine Adapter 拡張

**参照**: `docs/status/active/PHASE1_NEXT_STEPS.md:55-76`

**未実装項目**:
- [x] `flm-engine-vllm` の完全実装 ✅ 実装済み
  - 基本実装完了（`crates/engines/flm-engine-vllm/src/lib.rs`）
  - `crates/apps/flm-cli/src/commands/models.rs` で登録処理も実装済み
  
- [x] `flm-engine-lmstudio` の完全実装 ✅ 実装済み
  - 基本実装完了（`crates/engines/flm-engine-lmstudio/src/lib.rs`）
  - `crates/apps/flm-cli/src/commands/models.rs` で登録処理も実装済み
  
- [x] `flm-engine-llamacpp` の実装 ✅ 実装済み
  - 基本実装完了（`crates/engines/flm-engine-llamacpp/src/lib.rs`）
  - `crates/apps/flm-cli/src/commands/models.rs` で登録処理も実装済み
  
- [x] `EngineService::list_models` の統合 ✅ 実装済み
  - 各エンジンアダプターの `list_models` が実装済み
  - `register_detected_engines()` で全エンジンタイプの登録処理が実装済み
  
- [ ] キャッシュTTLチェック
  - 未実装（将来拡張）

**優先度**: 中（主要機能は実装済み、キャッシュTTLチェックは将来拡張）

---

### 2.5 UI Phase 2 残項目

**参照**: `docs/status/active/UNIMPLEMENTED_REPORT.md:39-44`

**未実装項目**:
- [ ] セキュリティイベント可視化
- [ ] IPブロックリスト管理UI
- [ ] Setup Wizard Firewall自動適用 IPC
- [ ] Chat Tester

**優先度**: 中

---

### 2.6 I18N 実装

**参照**: `docs/specs/I18N_SPEC.md`

**未実装項目**:
- [ ] 翻訳ファイル
- [ ] 言語切替UI
- [ ] `preferred_language` 保存
- [ ] 初回自動検出

**優先度**: 低

---

### 2.7 CLI Phase3 コマンド

**参照**: `docs/specs/CLI_SPEC.md`

**実装状況**:
- [x] `flm model-profiles` コマンド ✅ 実装完了（2025-01-27）
- [x] `flm api prompts` コマンド ✅ 実装完了（2025-01-27）
- [x] `flm migrate legacy` コマンド（基本構造） ✅ 実装済み（CLI定義、コマンド実装、ドライラン機能）
- [ ] `flm migrate legacy` コマンド（完全な移行ロジック） ⏳ 開発中

**優先度**: 低（Post-MVP、ただし基本構造は実装済み）

---

## 3. テスト・監査関連の未実装

### 3.1 Botnet機能テスト

**参照**: `docs/status/completed/security/SECURITY_PHASE1_COMPLETE.md`

**未実装項目**:
- [x] IPブロック機能の単体テスト ✅ 2025-11-25 に実装
- [x] 侵入検知機能の単体テスト ✅ 2025-11-25 に実装
- [ ] 統合テスト（将来拡張）

**実装内容**:
- `crates/services/flm-proxy/tests/botnet_security_test.rs` に16個のテストケースを追加
- IPブロック機能: 初期状態、警告のみ、5回/10回/20回失敗時のブロック、解除機能のテスト
- 侵入検知機能: SQLインジェクション、パストラバーサル、不審なUser-Agent、異常なHTTPメソッド、スコア累積、ブロック判定のテスト
- すべてのテストが成功（`cargo test -p flm-proxy --test botnet_security_test`）

**優先度**: 高（単体テストは完了、統合テストは将来拡張）

---

### 3.2 CI & Regression セットアップ

**参照**: `docs/guides/TEST_STRATEGY.md`

**未実装項目**:
- [x] `ci-cli` スクリプト ✅ 2025-11-25 に実装
- [x] `ci-proxy-load` スクリプト ✅ 2025-11-25 に実装
- [ ] `ci-acme-smoke` スクリプト
- [ ] Grafanaレポート

**実装内容**:
- `scripts/ci-cli.sh` と `scripts/ci-cli.ps1`: フォーマットチェック、Clippyチェック、ユニットテスト、統合スモークテストを実行
- `scripts/ci-proxy-load.sh` と `scripts/ci-proxy-load.ps1`: k6またはwrk2を使用したプロキシ負荷テストを実行。P50/P95レイテンシとエラー率を測定

**優先度**: 中（主要スクリプトは実装済み、残りは将来拡張）

---

## 4. 優先度別まとめ

### 🔴 高優先度（セキュリティ・コア機能）

1. **リソース保護の実装**（`resource_protection.rs`）
   - `sysinfo` クレートとの統合が必要
   - Botnet Phase 2の必須機能

2. **Botnet Phase 2機能**
   - 異常検知の改善
   - IPベースレート制限
   - リソース保護の実装

3. **Proxy統合テスト**
   - `/v1/models` ハンドラーのテスト
   - `ProxyService::start/stop/status` のテスト

4. **Botnet機能テスト**
   - IPブロック機能のテスト
   - 侵入検知機能のテスト

### 🟡 中優先度（機能拡張）

1. **HTTPストリーミング実装**（`http_client.rs`）
2. **Engine Adapter拡張**（vLLM, LM Studio, llama.cpp）
3. **Packaged-CAモード**（Phase 3）
4. **UI Phase 2残項目**
5. **CI & Regression セットアップ**

### 🟢 低優先度（将来拡張）

1. **ポート可用性チェック**（`proxy.rs`）
2. **I18N実装**
3. **CLI Phase3コマンド**
4. **Botnet Phase 3機能**（ハニーポット、UI可視化）

---

## 5. 次のステップ推奨

### 即座に対応すべき項目

1. **リソース保護の実装**
   - `crates/services/flm-proxy/src/security/resource_protection.rs` を修正
   - `sysinfo` クレートを追加してCPU/メモリ監視を実装

2. **Proxy統合テスト**
   - `crates/services/flm-proxy/tests/` に統合テストを追加
   - `/v1/models` と `/v1/chat/completions` のテスト

3. **Botnet機能テスト**
   - IPブロック機能の単体テスト
   - 侵入検知機能の単体テスト

### 短期（1-2週間）

1. **HTTPストリーミング実装**
2. **異常検知の改善**
3. **IPベースレート制限**

### 中期（1-2ヶ月）

1. **Engine Adapter拡張**
2. **Packaged-CAモード**（Phase 3）
3. **UI Phase 2残項目**

---

## 参考ドキュメント

- 未実装事項レポート: `docs/status/active/UNIMPLEMENTED_REPORT.md`
- 次のステップ: `docs/status/active/NEXT_STEPS.md`
- Phase 1次のステップ: `docs/status/active/PHASE1_NEXT_STEPS.md`
- Botnet対策実装計画: `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`
- Phase 3パッケージング計画: `docs/planning/PHASE3_PACKAGING_PLAN.md`

