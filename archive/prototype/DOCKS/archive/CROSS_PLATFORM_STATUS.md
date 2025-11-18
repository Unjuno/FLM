# FLM - クロスプラットフォーム対応状況

**確認日**: 2024年  
**目的**: Linux/macOS対応状況の確認と必要な対応の整理

---

## 📊 現在の対応状況

### ✅ 対応済み（コードレベル）

| 項目 | Windows | macOS | Linux |
|------|---------|-------|-------|
| **仕様書記載** | ✅ | ✅ | ✅ |
| **プラットフォーム分岐コード** | ✅ | ✅ | ✅ |
| **データベースパス** | ✅ | ✅ | ✅ |
| **Ollama検出** | ✅ | ✅ | ✅ |
| **Ollamaダウンロード** | ✅ | ✅ | ✅ |
| **プロセス管理** | ✅ | ✅ | ✅ |

### ⚠️ 未対応（設定レベル）

| 項目 | Windows | macOS | Linux |
|------|---------|-------|-------|
| **ビルド設定** | ✅ | ❌ | ❌ |
| **CI/CDビルド** | ✅ | ❌ | ❌ |
| **インストーラー生成** | ✅ | ❌ | ❌ |

---

## 🔍 詳細確認結果

### 1. 仕様書の記載

**SPECIFICATION.md** (59行目):
```
- OS: Windows 10/11, macOS 11.0+, Linux (Ubuntu 20.04+等)
```

✅ **仕様書ではLinux/macOS対応を明記**

---

### 2. コードレベルの対応

#### ✅ プラットフォーム分岐コード

**確認箇所**:
- `src-tauri/src/database/connection.rs` - データベースパス取得（15-34行目）
- `src-tauri/src/ollama.rs` - Ollama検出・ダウンロード（複数箇所）
- `src-tauri/src/utils/mod.rs` - ユーティリティ
- `src-tauri/src/database/encryption.rs` - 暗号化（プラットフォーム依存なし）

**実装例**:
```rust
#[cfg(target_os = "windows")]
{
    // Windows固有の処理
}

#[cfg(target_os = "macos")]
{
    // macOS固有の処理
}

#[cfg(target_os = "linux")]
{
    // Linux固有の処理
}
```

✅ **コードレベルでLinux/macOS対応済み**

---

### 3. データベースパスの対応

**実装状況** (connection.rs):
- ✅ **Windows**: `%LOCALAPPDATA%\FLM\flm.db`
- ✅ **macOS**: `~/Library/Application Support/FLM/flm.db`
- ✅ **Linux**: `~/.local/share/FLM/flm.db`

✅ **OS別の適切なデータディレクトリを使用**

---

### 4. Ollama検出・ダウンロードの対応

**実装状況** (ollama.rs):
- ✅ **Windows**: `where ollama` コマンド使用
- ✅ **macOS/Linux**: `which ollama` コマンド使用
- ✅ **ダウンロードURL**: プラットフォーム別アセット選択（Windows/macOS/Linux）

**実装箇所**:
- 302-322行目: プラットフォーム別アセット名の選択
  - Windows: `windows-amd64.zip`
  - macOS: `darwin-arm64` / `darwin-amd64`
  - Linux: `linux-arm64` / `linux-amd64`

✅ **Ollamaの検出・ダウンロードは全プラットフォーム対応済み**

---

### 5. Tauri設定ファイルの状況

**現在の設定** (`tauri.conf.json`):
```json
{
  "app": {
    "windows": [
      {
        "title": "FLM - Local LLM API Manager",
        ...
      }
    ]
  },
  "bundle": {
    "targets": ["msi", "nsis"],  // Windows専用
    ...
  }
}
```

❌ **現在はWindows専用の設定**

---

### 6. CI/CDビルドワークフローの状況

**現在の設定** (`.github/workflows/build.yml`):

```yaml
# macOSビルド（将来用）
build-macos:
  if: false  # 将来的に有効化

# Linuxビルド（将来用）
build-linux:
  if: false  # 将来的に有効化
```

❌ **macOS/Linuxビルドは無効化されている**

---

## 🔧 Linux/macOS対応に必要な作業

### Phase 1: Tauri設定ファイルの更新

**ファイル**: `src-tauri/tauri.conf.json`

**必要な変更**:

1. **macOS設定の追加**:
```json
{
  "app": {
    "windows": [...],
    "macOSPrivateApi": true,  // macOS用
    "macOSPrivateApiPrompt": false
  },
  "bundle": {
    "targets": ["msi", "nsis", "dmg", "app"],  // macOS追加
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "11.0",
      "exceptionDomain": "",
      "signingIdentity": null,
      "providerShortName": null,
      "entitlements": null
    }
  }
}
```

2. **Linux設定の追加**:
```json
{
  "bundle": {
    "targets": ["msi", "nsis", "dmg", "app", "deb", "AppImage"],
    "linux": {
      "deb": {
        "depends": []
      },
      "appimage": {
        "bundleMediaFramework": false
      }
    }
  }
}
```

---

### Phase 2: CI/CDワークフローの有効化

**ファイル**: `.github/workflows/build.yml`

**必要な変更**:

1. **macOSビルドの有効化**:
```yaml
build-macos:
  name: Build macOS
  runs-on: macos-latest
  if: true  # false → true に変更
```

2. **Linuxビルドの有効化**:
```yaml
build-linux:
  name: Build Linux
  runs-on: ubuntu-latest
  if: true  # false → true に変更
```

3. **リリース作成ジョブの更新**:
```yaml
create-release:
  needs: [build-windows, build-macos, build-linux]  # macOS/Linux追加
  steps:
    - name: Download macOS artifacts
      uses: actions/download-artifact@v4
      with:
        name: macos-build
    
    - name: Download Linux artifacts
      uses: actions/download-artifact@v4
      with:
        name: linux-build
```

---

### Phase 3: package.jsonスクリプトの追加（オプション）

**ファイル**: `package.json`

**追加可能なスクリプト**:
```json
{
  "scripts": {
    "tauri:build:macos": "tauri build --target aarch64-apple-darwin",
    "tauri:build:linux": "tauri build --target x86_64-unknown-linux-gnu",
    "tauri:build:all": "npm run tauri:build:windows && npm run tauri:build:macos && npm run tauri:build:linux"
  }
}
```

---

## 📋 実装チェックリスト

### コードレベル（既に実装済み）✅

- [x] プラットフォーム分岐コード（Windows/macOS/Linux）
- [x] データベースパス取得（OS別）
- [x] Ollama検出（OS別コマンド）
- [x] Ollamaダウンロード（プラットフォーム別アセット）
- [x] プロセス管理（プラットフォーム非依存）
- [x] ファイルパス処理（OS別）

### 設定レベル（要実装）⚠️

- [ ] Tauri設定ファイルにmacOS設定追加
- [ ] Tauri設定ファイルにLinux設定追加
- [ ] ビルドターゲットの追加（dmg, app, deb, AppImage）
- [ ] CI/CDワークフローでmacOSビルド有効化
- [ ] CI/CDワークフローでLinuxビルド有効化
- [ ] リリース作成ジョブの更新（全プラットフォーム対応）

### テスト（推奨）🔵

- [ ] macOSでのローカルビルドテスト
- [ ] Linuxでのローカルビルドテスト
- [ ] macOSでの動作確認
- [ ] Linuxでの動作確認

---

## 🎯 対応優先順位

### 優先度: 高
1. ✅ **Tauri設定ファイルの更新** - macOS/Linux設定追加
2. ✅ **CI/CDワークフローの有効化** - macOS/Linuxビルド有効化

### 優先度: 中
3. ✅ **リリース作成ジョブの更新** - 全プラットフォーム対応

### 優先度: 低
4. 🔵 **ローカルビルドテスト** - 実機での動作確認

---

## 📝 まとめ

### 現在の状況

✅ **コードレベル**: Linux/macOS対応済み（プラットフォーム分岐実装済み）  
⚠️ **設定レベル**: Windows専用（ビルド設定・CI/CD未対応）

### 結論

**Linux/macOS対応は、コードレベルでは準備済みですが、ビルド設定とCI/CDの設定を更新する必要があります。**

Tauriはクロスプラットフォーム対応のフレームワークなので、設定を更新すればLinux/macOSでもビルド・実行可能です。

---

## 🚀 次のステップ

1. **Tauri設定ファイルの更新** (`tauri.conf.json`)
2. **CI/CDワークフローの有効化** (`.github/workflows/build.yml`)
3. **ローカルビルドテスト**（推奨）

これらの変更を実装すれば、Linux/macOSでも使用可能になります。

