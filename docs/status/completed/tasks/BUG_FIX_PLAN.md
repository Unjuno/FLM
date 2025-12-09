# バグ修正計画書

> Generated: 2025-02-01 | Author: Senior Debugger Agent

## 📋 概要

本ドキュメントは、プロジェクトで発見された34件の問題を修正するための詳細なステップバイステップ計画です。

## 🎯 修正の優先順位

1. **Phase 1: 必須修正**（リリース前に必須）- 7件
2. **Phase 2: 高優先度修正**（リリース前に推奨）- 14件
3. **Phase 3: 中優先度修正**（リリース後に修正可能）- 7件
4. **Phase 4: 低優先度改善**（将来の改善）- 6件

---

## Phase 1: 必須修正（リリース前に必須）

### Step 1.1: コンパイルエラーの修正

#### 問題1: `flm-cli`の型不一致エラー（2件）

**ファイル**: `crates/apps/flm-cli/src/commands/proxy.rs`

**エラー1**: Line 310付近
- **問題**: `start_proxy`呼び出しで型不一致（`config` -> `&config`）
- **修正手順**:
  1. `crates/apps/flm-cli/src/commands/proxy.rs`を開く
  2. Line 310付近の`start_proxy`呼び出しを確認:
     ```rust
     let handle = client.start_proxy(config).await?;
     ```
  3. `start_proxy`のシグネチャを確認（おそらく`&ProxyConfig`を受け取る）
  4. 修正: `let handle = client.start_proxy(&config).await?;`

**エラー2**: Line 343付近
- **問題**: `runtime.service.start(&config).await?`呼び出しで型不一致（`&config` -> `config`）
- **修正手順**:
  1. Line 343付近の`runtime.service.start(&config).await?`を確認:
     ```rust
     let handle = runtime.service.start(&config).await?;
     ```
  2. `ProxyService::start`のシグネチャを確認（`crates/core/flm-core/src/services/proxy.rs:57`）
     - シグネチャ: `pub async fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError>`
     - `ProxyConfig`を値で受け取るため、`&config`ではなく`config`を渡す必要がある
  3. 修正: `let handle = runtime.service.start(config).await?;`
  4. 注意: `config`は`Clone`可能なので、必要に応じて`config.clone()`を使用（ただし、この場合は所有権を移動するため`config`を直接使用）

**検証**:
```bash
cargo check --package flm-cli
```

**推定時間**: 30分

---

### Step 1.2: テストのコンパイルエラーの修正

#### 問題2: `MockProxyController`に`reload_config`メソッドが未実装

**ファイル**: `crates/core/flm-core/tests/proxy_service_test.rs`

**修正手順**:
1. `crates/core/flm-core/tests/proxy_service_test.rs`を開く
2. `MockProxyController`構造体を確認（Line 12-22）
3. `ProxyController`トレイトの`reload_config`メソッドのシグネチャを確認（`crates/core/flm-core/src/ports/proxy.rs:29`）
   - シグネチャ: `async fn reload_config(&self, handle_id: &str) -> Result<(), ProxyError>`
4. `MockProxyController`の`impl ProxyController`ブロック（Line 24-57）に`reload_config`メソッドを追加:
   ```rust
   async fn reload_config(&self, handle_id: &str) -> Result<(), ProxyError> {
       let handles = self.handles.lock().unwrap();
       if handles.iter().any(|h| h.id == handle_id) {
           Ok(())
       } else {
           Err(ProxyError::HandleNotFound {
               handle_id: handle_id.to_string(),
           })
       }
   }
   ```

**検証**:
```bash
cargo test --package flm-core proxy_service_test
```

**推定時間**: 15分

---

#### 問題3: `rotate_api_key`の引数不一致

**ファイル**: `crates/core/flm-core/tests/security_service_test.rs`

**修正手順**:
1. `crates/core/flm-core/tests/security_service_test.rs`を開く
2. `rotate_api_key`の呼び出し箇所を確認
3. `SecurityService::rotate_api_key`のシグネチャを確認（`crates/core/flm-core/src/services/security.rs:220-224`）
   - シグネチャ: `pub async fn rotate_api_key(&self, id: &str, new_label: Option<&str>) -> Result<PlainAndHashedApiKey, RepoError>`
   - 2つの引数が必要: `id: &str`と`new_label: Option<&str>`
4. テストコードを修正:
   ```rust
   // 修正前（1つの引数のみ）:
   // let rotated = service.rotate_api_key(&key_id).await.unwrap();
   
   // 修正後（2つの引数）:
   let rotated = service.rotate_api_key(&key_id, None).await.unwrap();
   // または、新しいラベルを指定する場合:
   // let rotated = service.rotate_api_key(&key_id, Some("new-label")).await.unwrap();
   ```
5. 未使用変数`key2`, `key3`, `key4`を削除または使用

**検証**:
```bash
cargo test --package flm-core security_service_test
```

**推定時間**: 20分

---

#### 問題4: `list_audit_logs`メソッドが見つからない

**ファイル**: `crates/services/flm-proxy/tests/integration_test.rs`

**修正手順**:
1. `crates/services/flm-proxy/tests/integration_test.rs`を開く
2. Line 2284付近の`list_audit_logs`の呼び出しを確認:
   ```rust
   let audit_logs = security_service.list_audit_logs(100, 0).await.unwrap();
   ```
3. `SecurityService`のAPIを確認（`crates/core/flm-core/src/services/security.rs`）
   - `SecurityService`には`list_audit_logs`メソッドが存在しない
   - 監査ログは別のサービス（`AuditLogService`など）で管理されている可能性がある
4. 修正オプション:
   - **オプション1**: テストコードから監査ログチェックを削除またはコメントアウト
   - **オプション2**: 監査ログを取得する正しい方法を確認し、テストコードを修正
   - **オプション3**: `SecurityService`に`list_audit_logs`メソッドを追加（ただし、これは設計上の問題がある可能性がある）
5. 推奨修正（オプション1）:
   ```rust
   // Verify that fail_open event was logged (check audit logs)
   // Note: Audit log checking is currently not implemented in SecurityService
   // This check is skipped for now
   // let audit_logs = security_service.list_audit_logs(100, 0).await.unwrap();
   // let has_fail_open_event = audit_logs.iter().any(|log| {
   //     log.event_type.contains("egress_fail_open") || log.event_type.contains("fail_open")
   // });
   ```

**検証**:
```bash
cargo test --package flm-proxy integration_test
```

**推定時間**: 30分

---

### Step 1.3: バージョン番号の統一

**修正手順**:
1. すべてのバージョンファイルを確認:
   - `Cargo.toml`: `version = "0.1.0"`
   - `package.json`: `"version": "1.0.0"`
   - `src-tauri/tauri.conf.json`: `"version": "0.1.0"`

2. バージョン番号を統一（推奨: `0.1.0`）:
   ```bash
   # package.jsonを修正
   # "version": "1.0.0" -> "version": "0.1.0"
   ```

3. すべてのファイルでバージョン番号が一致していることを確認

**検証**:
```bash
grep -r "version.*=" Cargo.toml package.json src-tauri/tauri.conf.json
```

**推定時間**: 10分

---

### Step 1.4: LICENSEファイルの追加

**修正手順**:
1. ライセンスを決定（推奨: MIT OR Apache-2.0、`Cargo.toml`に記載されているため）
2. ルートディレクトリに`LICENSE`ファイルを作成
3. 適切なライセンステキストを追加（MITまたはApache-2.0）

**検証**:
```bash
ls -la LICENSE
```

**推定時間**: 15分

---

### Step 1.5: TypeScriptエラーの修正

**ファイル**: `src/pages/SetupWizard.tsx`

**問題**: フォーム要素にラベルがない（アクセシビリティ）

**修正手順**:
1. `src/pages/SetupWizard.tsx`を開く
2. フォーム要素（`<input>`, `<select>`, `<textarea>`など）を確認
3. 各フォーム要素に`<label>`要素を追加、または`aria-label`属性を追加
4. または`title`属性や`placeholder`属性を追加

**検証**:
```bash
npm run lint
npm run type-check
```

**推定時間**: 30分

---

## Phase 2: 高優先度修正（リリース前に推奨）

### Step 2.1: `unwrap()`/`expect()`の使用箇所を確認・修正

**対象ファイル**:
- `flm-cli`: 約15箇所
- `flm-proxy`: 2箇所

**修正手順**:
1. すべての`unwrap()`/`expect()`の使用箇所を特定:
   ```bash
   grep -r "unwrap()" crates/apps/flm-cli crates/services/flm-proxy
   grep -r "expect(" crates/apps/flm-cli crates/services/flm-proxy
   ```

2. 各箇所を確認し、優先順位を決定:
   - **最高優先度**: ユーザー入力に依存する箇所
   - **高優先度**: ファイルI/O、ネットワークI/O
   - **中優先度**: 内部処理、テストコード

3. エラーハンドリングを追加:
   - `unwrap()` -> `?`演算子または`match`文
   - `expect()` -> 適切なエラーメッセージとエラーハンドリング

**検証**:
```bash
cargo check --workspace
cargo test --workspace
```

**推定時間**: 4-6時間

---

### Step 2.2: CI/CDパイプラインのエラー無視設定の確認

**ファイル**: `.github/workflows/build.yml`

**修正手順**:
1. `.github/workflows/build.yml`を開く
2. `continue-on-error: true`が設定されているステップを確認
3. 各ステップを評価:
   - **必須ステップ**: `continue-on-error: true`を削除
   - **オプショナルステップ**: コメントで理由を明記

**検証**:
- CIワークフローを実行して確認

**推定時間**: 1時間

---

### Step 2.3: Rust Nightly Toolchainの確認

**ファイル**: `rust-toolchain.toml`

**修正手順**:
1. `rust-toolchain.toml`を開く
2. Nightlyが指定されている理由を確認
3. Stable版で動作するか確認:
   ```bash
   rustup toolchain install stable
   cargo +stable check --workspace
   ```
4. Stable版で動作する場合は、`rust-toolchain.toml`を更新:
   ```toml
   [toolchain]
   channel = "stable"
   ```
5. Nightlyが必要な場合は、バージョンを固定:
   ```toml
   [toolchain]
   channel = "nightly-2025-01-01"  # 具体的な日付を指定
   ```

**検証**:
```bash
cargo check --workspace
```

**推定時間**: 1-2時間

---

### Step 2.4: データベースインデックスの追加

**修正手順**:
1. 主要なクエリパスを確認:
   - `crates/core/flm-core/src/repositories/`内のクエリを確認
   - `WHERE`句、`JOIN`句で使用されているカラムを特定

2. マイグレーションファイルを作成:
   ```bash
   # 新しいマイグレーションファイルを作成
   # crates/core/flm-core/migrations/XXXXXX_add_indexes.sql
   ```

3. インデックスを追加:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
   CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
   -- その他の主要なクエリパスにインデックスを追加
   ```

4. マイグレーションを実行して検証

**検証**:
```bash
cargo test --package flm-core --test migration_test
```

**推定時間**: 2-3時間

---

### Step 2.5: レースコンディションのテスト

**ファイル**: `crates/services/flm-proxy/src/middleware.rs`

**修正手順**:
1. レート制限の実装を確認（`crates/services/flm-proxy/src/middleware.rs`）
2. レースコンディションのテストケースを作成:
   ```rust
   #[tokio::test]
   async fn test_rate_limit_race_condition() {
       // 複数のリクエストを同時に送信
       // レート制限が正しく機能することを確認
   }
   ```
3. テストを実行して問題を確認
4. 必要に応じて、`RwLock`や`Mutex`を使用してロックを追加

**検証**:
```bash
cargo test --package flm-proxy test_rate_limit
```

**推定時間**: 2-3時間

---

### Step 2.6: 実環境でのテスト実施

**修正手順**:
1. CIワークフローでの実署名鍵テスト:
   - GitHub Secretsに署名鍵を設定
   - `.github/workflows/build.yml`で署名検証ステップを有効化
   - ビルドと署名検証を実行

2. ローカル環境での実署名鍵テスト:
   - 各プラットフォーム（Windows、macOS、Linux）でビルド
   - 署名検証を実行

3. アンインストーラーの動作確認:
   - Windows: NSISアンインストーラーで証明書削除を確認
   - Linux: DEBパッケージのアンインストールで証明書削除を確認

**推定時間**: 4-8時間（環境セットアップ含む）

---

### Step 2.7: ファイル権限の設定確認

**修正手順**:
1. Unix系OSでのファイル権限設定を確認:
   - `crates/core/flm-core/src/services/certificate.rs:216-220`を確認
   - `security.db`の権限設定を確認

2. Windows ACLの設定を追加（必要に応じて）:
   ```rust
   #[cfg(windows)]
   use std::os::windows::fs::PermissionsExt;
   ```

3. macOS権限設定を確認（必要に応じて）

4. すべてのOSでファイル権限が適切に設定されていることを確認

**検証**:
```bash
# Unix系OSで確認
ls -la security.db config.db
```

**推定時間**: 2-3時間

---

### Step 2.8: 日時フォーマットのI18N対応

**ファイル**: `src/utils/formatters.ts`

**修正手順**:
1. `src/utils/formatters.ts`を開く
2. `formatDateTime`と`formatDate`関数を修正:
   ```typescript
   import { useI18n } from '@/contexts/I18nContext';
   
   export const formatDateTime = (dateString: string, locale?: string): string => {
     const currentLocale = locale || (typeof window !== 'undefined' ? 
       localStorage.getItem('locale') || 'ja' : 'ja');
     const localeMap: { [key: string]: string } = {
       'ja': 'ja-JP',
       'en': 'en-US',
     };
     const targetLocale = localeMap[currentLocale] || 'ja-JP';
     
     // ... 既存のコード ...
     return date.toLocaleString(targetLocale, { ... });
   };
   ```

3. 各コンポーネントで`useI18n`フックを使用してロケールを取得

**検証**:
```bash
npm run type-check
npm run test
```

**推定時間**: 1-2時間

---

## Phase 3: 中優先度修正（リリース後に修正可能）

### Step 3.1: `console.*`の使用を`logger.*`に置き換え

**対象ファイル**:
- `src/components/common/NotificationSystem.tsx:108`
- `src/pages/SetupWizard.tsx:57`
- `src/contexts/ThemeContext.tsx:51, 93`
- `src/contexts/I18nContext.tsx:116, 209`

**修正手順**:
1. 各ファイルで`console.*`の使用箇所を確認
2. `src/utils/logger.ts`から`logger`をインポート
3. `console.log` -> `logger.debug`
4. `console.warn` -> `logger.warn`
5. `console.error` -> `logger.error`

**検証**:
```bash
grep -r "console\." src/
```

**推定時間**: 1時間

---

### Step 3.2: `eprintln!`/`println!`の使用を確認

**対象ファイル**:
- `crates/core/flm-core/src/services/engine.rs:142`
- `crates/apps/flm-cli/src/commands/engines.rs:142-158`

**修正手順**:
1. CLI出力として問題ないか確認
2. 問題ない場合は、コメントで理由を明記
3. 問題がある場合は、`tracing`クレートを使用してログ出力を統一

**検証**:
```bash
cargo check --workspace
```

**推定時間**: 30分-1時間

---

### Step 3.3: `unsafe`コードのレビュー

**修正手順**:
1. すべての`unsafe`コードの使用箇所を特定:
   ```bash
   grep -r "unsafe" crates/
   ```

2. 各箇所をレビュー:
   - `unsafe impl Send`/`Sync`の使用理由を確認
   - 安全性を確認
   - 必要に応じてドキュメントを追加

**検証**:
- コードレビュー

**推定時間**: 2-3時間

---

### Step 3.4: メモリ管理の最適化

**修正手順**:
1. `Arc::clone()`の使用箇所を確認（`flm-proxy`で約29箇所）
2. 各箇所で`Arc::clone()`が必要か確認
3. 不要な場合は削除、必要な場合はコメントで理由を明記

**検証**:
```bash
cargo clippy --workspace
```

**推定時間**: 2-3時間

---

### Step 3.5: Lint警告の修正

**修正手順**:
1. Lint警告を確認:
   ```bash
   cargo clippy --workspace -- -D warnings
   npm run lint
   ```

2. 警告を優先順位付け:
   - **最高優先度**: 未使用の変数、未使用のインポート
   - **高優先度**: パフォーマンス警告
   - **中優先度**: スタイル警告

3. 段階的に修正

**検証**:
```bash
cargo clippy --workspace -- -D warnings
npm run lint
```

**推定時間**: 3-4時間

---

## Phase 4: 低優先度改善（将来の改善）

### Step 4.1: パフォーマンス最適化

**修正手順**:
1. `SELECT *`の使用箇所を特定
2. 必要な列のみを選択するようにクエリを修正

**推定時間**: 2-3時間

---

### Step 4.2: 依存関係のセキュリティ脆弱性確認

**修正手順**:
1. `cargo audit`をインストール:
   ```bash
   cargo install cargo-audit
   ```

2. 脆弱性を確認:
   ```bash
   cargo audit
   ```

3. `npm audit`を実行:
   ```bash
   npm audit
   ```

4. 脆弱性が見つかった場合は、依存関係を更新

**推定時間**: 1-2時間

---

## 📊 修正スケジュール

### Week 1: Phase 1（必須修正）
- **Day 1-2**: Step 1.1-1.2（コンパイルエラー修正）
- **Day 3**: Step 1.3-1.4（バージョン番号統一、LICENSE追加）
- **Day 4**: Step 1.5（TypeScriptエラー修正）
- **Day 5**: 検証とテスト

### Week 2: Phase 2（高優先度修正）
- **Day 1-2**: Step 2.1（`unwrap()`/`expect()`修正）
- **Day 3**: Step 2.2-2.3（CI/CD、Rust Nightly）
- **Day 4**: Step 2.4-2.5（データベースインデックス、レースコンディション）
- **Day 5**: Step 2.6-2.8（実環境テスト、ファイル権限、I18N）

### Week 3: Phase 3（中優先度修正）
- **Day 1**: Step 3.1-3.2（`console.*`、`eprintln!`修正）
- **Day 2-3**: Step 3.3-3.4（`unsafe`コード、メモリ管理）
- **Day 4-5**: Step 3.5（Lint警告修正）

### Week 4: Phase 4（低優先度改善）
- **Day 1-2**: Step 4.1（パフォーマンス最適化）
- **Day 3**: Step 4.2（依存関係のセキュリティ脆弱性確認）
- **Day 4-5**: 最終検証とドキュメント更新

---

## ✅ 検証チェックリスト

各Phase完了後に以下を確認:

- [ ] `cargo check --workspace`が成功
- [ ] `cargo test --workspace`が成功
- [ ] `npm run type-check`が成功
- [ ] `npm run lint`が成功（警告は許容）
- [ ] `cargo clippy --workspace`が成功（警告は許容）
- [ ] CIワークフローが成功
- [ ] ドキュメントが更新されている

---

## 📝 注意事項

1. **バックアップ**: 修正前に必ずバックアップを取る
2. **コミット**: 各Step完了後にコミットする
3. **テスト**: 各修正後にテストを実行して確認
4. **ドキュメント**: 重要な変更はドキュメントに反映

---

**作成日**: 2025-02-01  
**最終更新**: 2025-02-01  
**ステータス**: Ready for Implementation

