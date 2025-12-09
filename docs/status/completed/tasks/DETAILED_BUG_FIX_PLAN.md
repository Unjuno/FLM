# 詳細バグ修正計画書（実装可能版）

> Generated: 2025-02-01 | Author: Senior Debugger Agent

## 📋 概要

本ドキュメントは、発見された34件の問題を修正するための**実装可能な詳細なステップバイステップ計画**です。各ステップは独立して実行可能で、検証方法も含まれています。

---

## 🎯 Phase 1: 必須修正（リリース前に必須）

### Step 1.1: `flm-cli`のコンパイルエラー修正

#### エラー1: Line 310 - `start_proxy`の型不一致

**現在のコード**:
```rust
// crates/apps/flm-cli/src/commands/proxy.rs:310
let handle = client.start_proxy(config).await?;
```

**問題**: `start_proxy`メソッドが`&ProxyConfig`を期待しているが、`ProxyConfig`を渡している

**修正手順**:
1. `crates/apps/flm-cli/src/commands/proxy.rs`を開く
2. Line 310を以下のように修正:
   ```rust
   let handle = client.start_proxy(&config).await?;
   ```

**検証**:
```bash
cargo check --package flm-cli
```

**期待される結果**: コンパイルエラーが解消される

---

#### エラー2: Line 343 - `runtime.service.start`の型不一致

**現在のコード**:
```rust
// crates/apps/flm-cli/src/commands/proxy.rs:343
let handle = runtime.service.start(&config).await?;
```

**問題**: `ProxyService::start`が`ProxyConfig`を値で受け取るが、`&ProxyConfig`を渡している

**修正手順**:
1. `crates/apps/flm-cli/src/commands/proxy.rs`を開く
2. Line 343を以下のように修正:
   ```rust
   let handle = runtime.service.start(config).await?;
   ```
3. **注意**: `config`はこの時点で所有権を移動するため、以降で`config`を使用する場合は`config.clone()`を事前に作成する必要がある
4. Line 338-341の`if config.mode == ProxyMode::HttpsAcme`ブロックで`config`を使用しているため、このブロックの前に`config`のクローンを作成:
   ```rust
   // Inline mode: start proxy in this process
   let (runtime, _key) =
       get_or_create_inline_runtime(config_db_path.clone(), security_db_path.clone()).await?;

   // Clone config for mode check (before ownership is moved to start())
   let config_clone = config.clone();

   // Check for existing certificate in database for ACME mode
   if config_clone.mode == ProxyMode::HttpsAcme {
       // Certificate management is handled by rustls-acme automatically
       // No need to manually check for existing certificates
   }

   let handle = runtime.service.start(config).await?;
   ```

**検証**:
```bash
cargo check --package flm-cli
cargo test --package flm-cli
```

**期待される結果**: コンパイルエラーが解消され、テストが成功する

---

### Step 1.2: テストのコンパイルエラー修正

#### エラー3: `MockProxyController`に`reload_config`メソッドが未実装

**ファイル**: `crates/core/flm-core/tests/proxy_service_test.rs`

**現在のコード**:
```rust
// crates/core/flm-core/tests/proxy_service_test.rs:24-57
#[async_trait::async_trait]
impl ProxyController for MockProxyController {
    async fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError> {
        // ... 実装 ...
    }

    async fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError> {
        // ... 実装 ...
    }

    async fn status(&self) -> Result<Vec<ProxyHandle>, ProxyError> {
        // ... 実装 ...
    }
    // reload_config メソッドが欠けている
}
```

**修正手順**:
1. `crates/core/flm-core/tests/proxy_service_test.rs`を開く
2. `status`メソッドの後（Line 57の後）に`reload_config`メソッドを追加:
   ```rust
   async fn status(&self) -> Result<Vec<ProxyHandle>, ProxyError> {
       let handles = self.handles.lock().unwrap();
       Ok(handles.clone())
   }

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
}
```

**検証**:
```bash
cargo test --package flm-core proxy_service_test
```

**期待される結果**: テストがコンパイルされ、実行される

---

#### エラー4: `rotate_api_key`の引数不一致

**ファイル**: `crates/core/flm-core/tests/security_service_test.rs`

**現在のコード**:
```rust
// crates/core/flm-core/tests/security_service_test.rs:253
let result = service.rotate_api_key("nonexistent-id").await;
```

**問題**: `rotate_api_key`は2つの引数（`id: &str`と`new_label: Option<&str>`）を必要とするが、1つしか渡していない

**修正手順**:
1. `crates/core/flm-core/tests/security_service_test.rs`を開く
2. Line 253を以下のように修正:
   ```rust
   let result = service.rotate_api_key("nonexistent-id", None).await;
   ```

**検証**:
```bash
cargo test --package flm-core security_service_test
```

**期待される結果**: テストがコンパイルされ、実行される

---

#### エラー5: `list_audit_logs`メソッドが見つからない

**ファイル**: `crates/services/flm-proxy/tests/integration_test.rs`

**現在のコード**:
```rust
// crates/services/flm-proxy/tests/integration_test.rs:2284
let audit_logs = security_service.list_audit_logs(100, 0).await.unwrap();
```

**問題**: `SecurityService`に`list_audit_logs`メソッドが存在しない

**修正手順**:
1. `crates/services/flm-proxy/tests/integration_test.rs`を開く
2. Line 2284-2293の監査ログチェック部分をコメントアウトまたは削除:
   ```rust
   // Verify that fail_open event was logged (check audit logs)
   // Note: Audit log checking is currently not implemented in SecurityService
   // This check is skipped for now
   // let audit_logs = security_service.list_audit_logs(100, 0).await.unwrap();
   // let has_fail_open_event = audit_logs.iter().any(|log| {
   //     log.event_type.contains("egress_fail_open") || log.event_type.contains("fail_open")
   // });
   
   // Note: The audit log check may not always work depending on implementation
   // This is a best-effort check
   // if has_fail_open_event {
   //     log_test("Found egress_fail_open_triggered event in audit logs");
   // }
   ```

**検証**:
```bash
cargo test --package flm-proxy integration_test
```

**期待される結果**: テストがコンパイルされ、実行される

---

### Step 1.3: バージョン番号の統一

**現在の状態**:
- `Cargo.toml`: `version = "0.1.0"`
- `package.json`: `"version": "1.0.0"`
- `src-tauri/tauri.conf.json`: `"version": "0.1.0"`

**修正手順**:
1. `package.json`を開く
2. Line 4の`"version": "1.0.0"`を`"version": "0.1.0"`に変更:
   ```json
   {
     "name": "flm",
     "private": true,
     "version": "0.1.0",
     ...
   }
   ```

**検証**:
```bash
# PowerShell
Select-String -Path "Cargo.toml","package.json","src-tauri/tauri.conf.json" -Pattern "version"
```

**期待される結果**: すべてのファイルで`0.1.0`が表示される

---

### Step 1.4: LICENSEファイルの追加

**修正手順**:
1. ルートディレクトリに`LICENSE`ファイルを作成
2. `Cargo.toml`に記載されている`license = "MIT OR Apache-2.0"`に基づいて、MITライセンスを選択（またはApache-2.0）
3. `LICENSE`ファイルに以下の内容を追加（MITライセンスの場合）:
   ```
   MIT License

   Copyright (c) 2025 FLM Contributors

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   ```

**検証**:
```bash
Test-Path LICENSE
Get-Content LICENSE | Select-Object -First 5
```

**期待される結果**: `LICENSE`ファイルが存在し、内容が正しい

---

### Step 1.5: TypeScriptエラーの修正

**ファイル**: `src/pages/SetupWizard.tsx`

**問題**: フォーム要素にラベルがない（アクセシビリティ）

**修正手順**:
1. `src/pages/SetupWizard.tsx`を開く
2. フォーム要素（`<input>`, `<select>`, `<textarea>`など）を確認
3. 各フォーム要素に`<label>`要素を追加、または`aria-label`属性を追加

**例**:
```tsx
// 修正前
<input type="text" value={value} onChange={onChange} />

// 修正後（オプション1: label要素を使用）
<label htmlFor="input-id">Label Text</label>
<input id="input-id" type="text" value={value} onChange={onChange} />

// 修正後（オプション2: aria-labelを使用）
<input type="text" value={value} onChange={onChange} aria-label="Label Text" />
```

**検証**:
```bash
npm run lint
npm run type-check
```

**期待される結果**: Lintエラーが解消される

---

## 🎯 Phase 2: 高優先度修正（リリース前に推奨）

### Step 2.1: `unwrap()`/`expect()`の使用箇所を確認・修正

**対象**: 約17箇所（`flm-cli`: 約15箇所、`flm-proxy`: 2箇所）

**修正手順**:
1. すべての`unwrap()`/`expect()`の使用箇所を特定:
   ```bash
   # PowerShell
   Select-String -Path "crates/apps/flm-cli","crates/services/flm-proxy" -Pattern "\.unwrap\(\)|\.expect\(" -Recurse
   ```

2. 各箇所を優先順位付け:
   - **最高優先度**: ユーザー入力に依存する箇所
   - **高優先度**: ファイルI/O、ネットワークI/O
   - **中優先度**: 内部処理、テストコード

3. エラーハンドリングを追加:
   ```rust
   // 修正前
   let value = some_function().unwrap();

   // 修正後（オプション1: ?演算子を使用）
   let value = some_function()?;

   // 修正後（オプション2: match文を使用）
   let value = match some_function() {
       Ok(v) => v,
       Err(e) => return Err(ProxyError::InvalidConfig {
           reason: format!("Failed to process: {}", e),
       }),
   };

   // 修正後（オプション3: unwrap_or_elseを使用）
   let value = some_function().unwrap_or_else(|e| {
       eprintln!("Warning: Failed to process: {}", e);
       default_value
   });
   ```

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

**例**:
```yaml
# 修正前
- name: Optional step
  continue-on-error: true
  run: some_command

# 修正後（必須ステップの場合）
- name: Required step
  run: some_command

# 修正後（オプショナルステップの場合）
- name: Optional step (non-critical)
  # This step is optional and failures should not block the workflow
  continue-on-error: true
  run: some_command
```

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

### Step 2.4: 日時フォーマットのI18N対応

**ファイル**: `src/utils/formatters.ts`

**現在のコード**:
```typescript
// src/utils/formatters.ts:17
return date.toLocaleString('ja-JP', {
  // ...
});

// src/utils/formatters.ts:44
return date.toLocaleDateString('ja-JP', {
  // ...
});
```

**修正手順**:
1. `src/utils/formatters.ts`を開く
2. `formatDateTime`と`formatDate`関数を修正:
   ```typescript
   import { getLocale } from '@/contexts/I18nContext';

   export const formatDateTime = (dateString: string, locale?: string): string => {
     if (!dateString || dateString.trim() === '') {
       return locale === 'en' ? 'Unknown' : '不明';
     }

     try {
       const date = new Date(dateString);
       if (isNaN(date.getTime())) {
         return dateString;
       }

       const currentLocale = locale || getLocale() || 'ja';
       const localeMap: { [key: string]: string } = {
         'ja': 'ja-JP',
         'en': 'en-US',
       };
       const targetLocale = localeMap[currentLocale] || 'ja-JP';

       return date.toLocaleString(targetLocale, {
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
       });
     } catch {
       return dateString;
     }
   };

   export const formatDate = (dateString: string, locale?: string): string => {
     if (!dateString || dateString.trim() === '') {
       return locale === 'en' ? 'Unknown' : '不明';
     }

     try {
       const date = new Date(dateString);
       if (isNaN(date.getTime())) {
         return dateString;
       }

       const currentLocale = locale || getLocale() || 'ja';
       const localeMap: { [key: string]: string } = {
         'ja': 'ja-JP',
         'en': 'en-US',
       };
       const targetLocale = localeMap[currentLocale] || 'ja-JP';

       return date.toLocaleDateString(targetLocale, {
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
       });
     } catch {
       return dateString;
     }
   };
   ```

3. `I18nContext`に`getLocale`関数を追加（まだ存在しない場合）:
   ```typescript
   // src/contexts/I18nContext.tsx
   export const getLocale = (): string => {
     if (typeof window !== 'undefined') {
       return localStorage.getItem('locale') || 'ja';
     }
     return 'ja';
   };
   ```

**検証**:
```bash
npm run type-check
npm run test
```

**推定時間**: 1-2時間

---

## 📊 実装チェックリスト

### Phase 1: 必須修正
- [ ] Step 1.1: `flm-cli`のコンパイルエラー修正（2件）
- [ ] Step 1.2: テストのコンパイルエラー修正（3件）
- [ ] Step 1.3: バージョン番号の統一
- [ ] Step 1.4: LICENSEファイルの追加
- [ ] Step 1.5: TypeScriptエラーの修正

### Phase 2: 高優先度修正
- [ ] Step 2.1: `unwrap()`/`expect()`の使用箇所を確認・修正
- [ ] Step 2.2: CI/CDパイプラインのエラー無視設定の確認
- [ ] Step 2.3: Rust Nightly Toolchainの確認
- [ ] Step 2.4: 日時フォーマットのI18N対応

---

## 🔍 検証コマンド

各Phase完了後に以下を実行:

```bash
# コンパイルチェック
cargo check --workspace

# テスト実行
cargo test --workspace

# TypeScript型チェック
npm run type-check

# Lintチェック
npm run lint
cargo clippy --workspace -- -D warnings
```

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

