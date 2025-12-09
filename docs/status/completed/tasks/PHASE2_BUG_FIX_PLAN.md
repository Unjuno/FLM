# Phase 2: 高優先度バグ修正計画

> Generated: 2025-02-01 | Author: Senior Debugger Agent

## 概要

Phase 1の必須修正が完了したため、Phase 2の高優先度修正を実施します。これらはリリース前に推奨される修正です。

## 修正項目

### 1. `unwrap()`/`expect()`の使用箇所を確認・修正

#### 1.1 `flm-cli`の`unwrap()`使用箇所（約15箇所）

**優先度**: 高（ユーザー入力に依存する箇所を優先）

**対象ファイル**:
- `crates/apps/flm-cli/src/adapters/engine_health_log.rs:210, 213` - `Option::unwrap()`の使用

**修正手順**:
1. `crates/apps/flm-cli/src/adapters/engine_health_log.rs`を開く
2. Line 210と213の`unwrap()`を適切なエラーハンドリングに置き換え:
   ```rust
   // 修正前
   if bind_engine_id {
       query_builder = query_builder.bind(engine_id.unwrap());
   }
   if bind_model_id {
       query_builder = query_builder.bind(model_id.unwrap());
   }
   
   // 修正後
   if bind_engine_id {
       if let Some(eid) = engine_id {
           query_builder = query_builder.bind(eid);
       } else {
           return Err(RepoError::ValidationError {
               reason: "engine_id is required but not provided".to_string(),
           });
       }
   }
   if bind_model_id {
       if let Some(mid) = model_id {
           query_builder = query_builder.bind(mid);
       } else {
           return Err(RepoError::ValidationError {
               reason: "model_id is required but not provided".to_string(),
           });
       }
   }
   ```

**検証**:
```bash
cargo check --package flm-cli
cargo test --package flm-cli
```

#### 1.2 `flm-proxy`の`expect()`使用箇所（2箇所）

**対象ファイル**:
- `crates/services/flm-proxy/src/controller.rs:909` - HTTPレスポンス構築時の`expect()`
- `crates/services/flm-proxy/src/metrics.rs:328` - メトリクスレスポンス構築時の`expect()`

**修正手順**:
1. `crates/services/flm-proxy/src/controller.rs`を開く
2. Line 909の`expect()`をエラーハンドリングに置き換え:
   ```rust
   // 修正前
   .expect("Failed to build redirect response: invalid header or body")
   
   // 修正後
   .map_err(|e| ProxyError::InvalidConfig {
       reason: format!("Failed to build redirect response: {}", e),
   })?
   ```

3. `crates/services/flm-proxy/src/metrics.rs`を開く
4. Line 328の`expect()`をエラーハンドリングに置き換え:
   ```rust
   // 修正前
   .expect("Failed to build metrics response: invalid header or body")
   
   // 修正後
   .map_err(|e| {
       tracing::error!("Failed to build metrics response: {}", e);
       // Return a simple error response instead of panicking
       axum::http::Response::builder()
           .status(500)
           .body(axum::body::Body::from("Internal server error"))
           .unwrap_or_else(|_| {
               // Fallback if even error response fails
               axum::http::Response::new(axum::body::Body::empty())
           })
   })
   ```

**検証**:
```bash
cargo check --package flm-proxy
cargo test --package flm-proxy
```

### 2. CI/CDパイプラインのエラー無視設定の確認

**ファイル**: `.github/workflows/build.yml`

**問題**: いくつかのステップで`continue-on-error: true`が設定されている

**修正手順**:
1. `.github/workflows/build.yml`を開く
2. 各`continue-on-error: true`を評価:
   - **必須ステップ**: `continue-on-error: true`を削除
   - **オプショナルステップ**: コメントで理由を明記

**具体的な修正**:
- Line 39: `npm ci` - 必須ステップなので`continue-on-error: true`を削除
- Line 62: `npm run build` - 必須ステップなので`continue-on-error: false`のまま（既にfalse）
- Line 68-72: `cargo check` - チェックのみなので`continue-on-error: true`は維持（コメント追加）

**検証**: CIワークフローを実行して確認

### 3. Rust Nightly Toolchainの確認

**ファイル**: `rust-toolchain.toml`

**問題**: Nightlyが指定されているが、Stable版で動作するか確認が必要

**修正手順**:
1. Stable版で動作するか確認:
   ```bash
   rustup toolchain install stable
   cargo +stable check --workspace
   ```
2. Stable版で動作する場合:
   - `rust-toolchain.toml`を更新してStable版を指定
3. Nightlyが必要な場合:
   - バージョンを固定（例: `nightly-2025-01-01`）

**検証**:
```bash
cargo check --workspace
```

### 4. 日時フォーマットのI18N対応

**ファイル**: `src/utils/formatters.ts`

**問題**: 日本語ロケール（`'ja-JP'`）がハードコードされている

**修正手順**:
1. `src/utils/formatters.ts`を開く
2. `I18nContext`からロケールを取得する関数を追加:
   ```typescript
   // I18nContextにgetLocale関数を追加（まだ存在しない場合）
   // src/contexts/I18nContext.tsx
   export const getLocale = (): string => {
     if (typeof window !== 'undefined') {
       return localStorage.getItem('locale') || 'ja';
     }
     return 'ja';
   };
   ```

3. `formatDateTime`と`formatDate`関数を修正:
   ```typescript
   import { getLocale } from '../contexts/I18nContext';
   
   export const formatDateTime = (dateString: string, locale?: string): string => {
     if (!dateString || dateString.trim() === '') {
       const currentLocale = locale || getLocale() || 'ja';
       return currentLocale === 'en' ? 'Unknown' : '不明';
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
       const currentLocale = locale || getLocale() || 'ja';
       return currentLocale === 'en' ? 'Unknown' : '不明';
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

**検証**:
```bash
npm run type-check
npm run test
```

### 5. `console.*`の使用を`logger.*`に置き換え

**対象ファイル**:
- `src/components/common/NotificationSystem.tsx:108`
- `src/pages/SetupWizard.tsx:57`
- `src/contexts/ThemeContext.tsx:51, 93`
- `src/contexts/I18nContext.tsx:116, 209`

**修正手順**:
1. 各ファイルで`console.*`の使用箇所を確認
2. `src/utils/logger.ts`から`logger`をインポート
3. `console.log` → `logger.debug`
4. `console.warn` → `logger.warn`
5. `console.error` → `logger.error`

**検証**:
```bash
npm run lint
```

## 実装順序

1. `unwrap()`/`expect()`の修正（高優先度）
2. 日時フォーマットのI18N対応
3. `console.*`の使用を`logger.*`に置き換え
4. CI/CDパイプラインのエラー無視設定の確認
5. Rust Nightly Toolchainの確認

## 検証コマンド

各修正後に以下を実行:
```bash
cargo check --workspace
cargo test --workspace
npm run type-check
npm run lint
```

