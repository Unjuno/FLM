# 追加で発見された問題

> Generated: 2025-02-01 | Analyst: Project Progress Analyst Agent

## 🔴 コンパイルエラー（即座に修正が必要）

### 1. `flm-cli` の型不一致エラー（2件）

**ファイル**: `crates/apps/flm-cli/src/commands/proxy.rs`

**エラー1** (Line 310):
```rust
let handle = client.start_proxy(config).await?;
// エラー: expected `&ProxyConfig`, found `ProxyConfig`
```
**修正**: `&config` に変更する必要があります。

**エラー2** (Line 343):
```rust
let handle = runtime.service.start(&config).await?;
// エラー: expected `ProxyConfig`, found `&ProxyConfig`
```
**修正**: `config` に変更する必要があります（ただし、所有権の問題がある可能性）。

**影響**: `flm proxy start` コマンドがコンパイルできません。

### 2. テストのコンパイルエラー

#### 2.1 `proxy_service_test.rs` - `reload_config` 未実装

**ファイル**: `crates/core/flm-core/tests/proxy_service_test.rs:25`

**問題**: `MockProxyController` に `reload_config` メソッドが実装されていません。

**修正**: `ProxyController` trait の `reload_config` メソッドを実装する必要があります。

#### 2.2 `security_service_test.rs` - `rotate_api_key` の引数不一致

**ファイル**: `crates/core/flm-core/tests/security_service_test.rs:253`

**問題**: `rotate_api_key` メソッドが1引数で呼び出されていますが、実装では2引数（`id`と`new_label`）が必要です。

**修正**: テストを修正して `new_label` パラメータを追加するか、`None` を明示的に渡す必要があります。

#### 2.3 `integration_test.rs` - `list_audit_logs` メソッドが見つからない

**ファイル**: `crates/services/flm-proxy/tests/integration_test.rs:2284`

**問題**: `SecurityService` に `list_audit_logs` メソッドが存在しません。

**修正**: 
- `SecurityService` に `list_audit_logs` メソッドを追加するか、
- テストを修正して別の方法で監査ログを取得するか、
- テストを削除またはコメントアウトする必要があります。

## ⚠️ Lint警告（修正推奨）

### 1. 未使用インポート（`flm-cli`）

**ファイル**: `crates/apps/flm-cli/src/commands/proxy.rs`

以下のインポートが未使用です：
- `CliUserError` (Line 7)
- `load_existing_client` (Line 10)
- `ProxyError` (Line 15)
- `SecurityService` (Line 17)
- `local_ip_address::local_ip` (Line 19)

**修正**: 未使用のインポートを削除してください。

### 2. 未使用変数・関数

- `crates/services/flm-proxy/rustls-acme/src/acme.rs:340`: 未使用変数 `other`
- `crates/services/flm-proxy/tests/middleware_test.rs:14`: 未使用関数 `create_test_state`
- `crates/services/flm-proxy/tests/tor_mock.rs`: 未使用インポート、未使用変数
- `crates/core/flm-core/src/domain/proxy.rs:256`: 不要な `mut`
- `crates/services/flm-proxy/src/certificate.rs:111`: 未使用関数 `load_packaged_root_ca`
- `crates/services/flm-proxy/src/metrics.rs:313`: 未使用関数 `create_metrics_router`

**修正**: 未使用のコードを削除するか、`#[allow(dead_code)]` を追加してください。

## ⚠️ TypeScriptエラー

### 1. フォーム要素のラベル不足

**ファイル**: `src/pages/SetupWizard.tsx:1`

**問題**: フォーム要素にラベル（`title`属性または`placeholder`属性）がありません。

**影響**: アクセシビリティの問題（WCAG準拠）。

**修正**: フォーム要素に適切なラベルを追加してください。

## 📊 問題の優先度分類

### 最高優先度（リリース前に必須）
1. ✅ `flm-cli` の型不一致エラー（2件） - **コンパイルエラー**
2. ✅ テストのコンパイルエラー（3件） - **テストが実行できない**

### 高優先度（リリース前に推奨）
3. ⚠️ TypeScriptエラー（フォーム要素のラベル不足） - **アクセシビリティ**

### 中優先度（リリース後に修正可能）
4. ⚠️ Lint警告（未使用インポート、未使用変数） - **コード品質**

## 🔧 推奨アクション

### 即座に対応すべき項目

1. **`flm-cli` の型不一致エラーを修正**
   - `crates/apps/flm-cli/src/commands/proxy.rs:310` を `&config` に変更
   - `crates/apps/flm-cli/src/commands/proxy.rs:343` を `config` に変更（所有権の問題を確認）

2. **テストのコンパイルエラーを修正**
   - `MockProxyController` に `reload_config` メソッドを実装
   - `security_service_test.rs` の `rotate_api_key` 呼び出しを修正
   - `integration_test.rs` の `list_audit_logs` 呼び出しを修正または削除

3. **TypeScriptエラーを修正**
   - `SetupWizard.tsx` のフォーム要素にラベルを追加

### リリース後に修正可能な項目

4. **Lint警告を修正**
   - 未使用のインポート、変数、関数を削除
   - または `#[allow(dead_code)]` を追加

## 📝 補足情報

これらの問題は、プロジェクトの進捗分析時に発見されました。特にコンパイルエラーは、リリース前に必ず修正する必要があります。

**確認方法**:
```bash
# Rustコンパイルチェック
cargo check --workspace

# TypeScript型チェック
npm run type-check

# Lintチェック
cargo clippy --workspace -- -D warnings
npm run lint
```

---

**発見日時**: 2025-02-01  
**分析者**: Project Progress Analyst Agent

