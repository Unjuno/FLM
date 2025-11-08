# Tauri v2 プロジェクト監査レポート

## 確認日時
2025年11月7日

## 確認項目

### 1. 依存関係の確認 ✅

**package.json**
- `@tauri-apps/api`: `^2` ✅
- `@tauri-apps/cli`: `^2` ✅
- `@tauri-apps/plugin-opener`: `^2` ✅

**Cargo.toml**
- `tauri`: `version = "2"` ✅
- `tauri-build`: `version = "2"` ✅
- `tauri-plugin-opener`: `"2"` ✅

**結論**: すべてTauri v2を使用しており、問題ありません。

---

### 2. tauri.conf.json の設定 ⚠️

**現在の設定:**
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "app": {
    "security": {
      "csp": null
    }
  }
}
```

**問題点:**
1. ❌ `withGlobalTauri` の設定がありません
   - Tauri v2では、`window.__TAURI__`にアクセスするには`withGlobalTauri: true`が必要です
   - ただし、`@tauri-apps/api/core`からインポートした`invoke`は`withGlobalTauri`がなくても動作します

2. ⚠️ CSPが`null`に設定されています
   - セキュリティのため、適切なCSPを設定することを推奨します

**推奨修正:**
```json
{
  "app": {
    "withGlobalTauri": true,  // 追加推奨（window.__TAURI__にアクセスする場合）
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    }
  }
}
```

---

### 3. Capabilities設定 ✅

**現在の設定:**
```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```

**確認結果:**
- ✅ `capabilities/default.json`が存在します
- ✅ `core:default`が設定されています（IPCコマンドに必要）
- ✅ `opener:default`が設定されています（プラグインに必要）

**結論**: 基本的な設定は問題ありません。ただし、プロジェクトで多くのIPCコマンドを使用しているため、すべてのコマンドが正しく動作するか確認が必要です。

---

### 4. IPCコマンドの登録 ✅

**確認結果:**
- ✅ `invoke_handler!`マクロでコマンドが正しく登録されています
- ✅ 90以上のコマンドが登録されています
- ✅ コマンドの命名規則は適切です（スネークケース）

**結論**: IPCコマンドの登録に問題はありません。

---

### 5. フロントエンドでのAPI使用 ⚠️

**現在の実装:**
```typescript
// src/utils/tauri.ts
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
```

**問題点:**
1. ⚠️ `isTauriAvailable()`のチェックが厳しすぎる可能性があります
   - `window.__TAURI__`の存在を必須としていますが、`@tauri-apps/api/core`からインポートした`invoke`は`window.__TAURI__`がなくても動作する可能性があります

2. ✅ `@tauri-apps/api/core`からのインポートは正しいです

**推奨改善:**
- `isTauriAvailable()`のチェックを緩和し、`tauriInvoke`が関数であることを確認するだけで十分かもしれません
- ただし、現在の実装でも動作するはずです（デバッグログで確認可能）

---

### 6. その他の確認事項

#### 6.1 Vite設定 ✅
- ✅ `vite.config.ts`の設定は適切です
- ✅ ポート1420が設定されています
- ✅ Tauri開発用の設定が含まれています

#### 6.2 プラグイン設定 ✅
- ✅ `tauri-plugin-opener`が正しく登録されています
- ✅ `capabilities/default.json`に`opener:default`が含まれています

---

## 発見された問題点と推奨修正

### 優先度: 高

1. **`tauri.conf.json`に`withGlobalTauri`を追加（オプション）**
   - `window.__TAURI__`にアクセスする必要がある場合のみ
   - 現在の実装では必須ではありませんが、デバッグに役立ちます

### 優先度: 中

2. **CSP設定の改善**
   - セキュリティのため、適切なCSPを設定することを推奨

3. **`isTauriAvailable()`の改善**
   - より柔軟なチェック方法を検討

### 優先度: 低

4. **デバッグログの最適化**
   - 本番環境では不要なログを削除

---

## 結論

プロジェクトは基本的にTauri v2のベストプラクティスに沿って実装されています。主な問題点は：

1. **`tauri.conf.json`に`withGlobalTauri: true`を追加することを推奨**（オプション）
2. **CSP設定を改善することを推奨**（セキュリティ向上のため）
3. **`isTauriAvailable()`のチェック方法を改善することを検討**

現在の実装でも動作するはずですが、上記の修正により、より確実に動作し、セキュリティも向上します。

---

## 次のステップ

1. `tauri.conf.json`に`withGlobalTauri: true`を追加
2. CSP設定を改善
3. アプリを再起動して、デバッグログで動作を確認
4. 問題が解決しない場合は、コンソールログを確認して詳細を調査

