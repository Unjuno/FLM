# FLM - WEBサイト公開とパッケージ化計画

**目的**: WEBサイトでアプリケーションパッケージをダウンロード可能にする

---

## 🎯 目標

1. **WEBサイトでの公開**: GitHub Pagesで公式サイトを公開
2. **パッケージのダウンロード提供**: ビルド済みパッケージをダウンロード可能に
3. **自動化**: CI/CDで自動ビルド・リリース・WEBサイト更新

---

## 📋 現在の状況

### ✅ 実装済み

- **WEBサイト**: `WEB/` ディレクトリにHTMLファイル実装済み
- **GitHub Pagesデプロイ**: `.github/workflows/deploy-pages.yml` 実装済み
- **ビルドワークフロー**: `.github/workflows/build.yml` 実装済み（Windows）
- **リリース作成**: タグプッシュ時に自動リリース作成

### ⚠️ 必要な追加実装

1. **ダウンロードリンクの動的生成**: GitHub Releases APIから最新版を取得
2. **OS検出機能**: ユーザーのOSに応じた適切なパッケージを推奨
3. **パッケージ情報の表示**: バージョン、ファイルサイズ、更新日時
4. **macOS/Linuxパッケージのビルド有効化**: 全プラットフォーム対応

---

## 🏗️ 実装計画

### Phase 1: ダウンロードページの機能強化

#### 1.1 GitHub Releases API統合

**ファイル**: `WEB/js/download.js` (新規作成または拡張)

**機能**:
- GitHub Releases APIから最新リリース情報を取得
- プラットフォーム別のダウンロードアセットを取得
- ダウンロードボタンの動的生成

**実装例**:
```javascript
// GitHub Releases APIから最新リリースを取得
async function fetchLatestRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest');
    const release = await response.json();
    
    // プラットフォーム別アセットを分類
    const assets = {
      windows: release.assets.find(a => a.name.endsWith('.msi') || a.name.endsWith('.exe')),
      macos: release.assets.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.app')),
      linux: release.assets.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb'))
    };
    
    return {
      version: release.tag_name,
      publishedAt: release.published_at,
      assets: assets
    };
  } catch (error) {
    console.error('リリース情報の取得に失敗しました:', error);
    return null;
  }
}

// OS検出と適切なパッケージの推奨
function detectOS() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  if (/windows/i.test(userAgent)) {
    return 'windows';
  } else if (/mac|MacIntel|MacPPC|Mac68K/i.test(userAgent)) {
    return 'macos';
  } else if (/linux/i.test(userAgent)) {
    return 'linux';
  }
  return 'unknown';
}
```

---

### Phase 2: パッケージ情報の表示

#### 2.1 バージョン情報表示

**ファイル**: `WEB/download.html`

**追加要素**:
- 最新バージョン番号の表示
- リリース日時の表示
- ファイルサイズの表示
- ダウンロード数の表示（GitHub APIから取得可能）

**実装例**:
```html
<div id="release-info">
  <h2>最新版: <span id="latest-version">読み込み中...</span></h2>
  <p>リリース日: <span id="release-date">-</span></p>
  <p>ダウンロード数: <span id="download-count">-</span></p>
</div>
```

---

### Phase 3: 全プラットフォームパッケージのビルド有効化

#### 3.1 ビルドワークフローの更新

**ファイル**: `.github/workflows/build.yml`

**変更内容**:
1. macOSビルドを有効化
2. Linuxビルドを有効化
3. リリース作成時に全プラットフォームのアセットを含める

---

### Phase 4: パッケージ情報API（オプション）

#### 4.1 パッケージ情報エンドポイント

**目的**: WEBサイトから簡単にパッケージ情報を取得

**実装方法**:
- GitHub Releases APIを直接使用（推奨・簡単）
- または、独自APIエンドポイントを作成（複雑・不要の可能性）

**推奨**: GitHub Releases APIを直接使用

---

## 📝 実装チェックリスト

### ダウンロードページ機能

- [ ] GitHub Releases API統合
- [ ] OS自動検出機能
- [ ] プラットフォーム別ダウンロードボタン
- [ ] バージョン情報の表示
- [ ] ファイルサイズの表示
- [ ] リリース日時の表示

### ビルド・リリース

- [ ] macOSビルドの有効化
- [ ] Linuxビルドの有効化
- [ ] リリース作成時の全プラットフォームアセット追加

### WEBサイト

- [ ] ダウンロードページの更新
- [ ] パッケージ情報の表示
- [ ] エラーハンドリング（リリース取得失敗時）

---

## 🔧 実装の優先順位

### 優先度: 高
1. **ダウンロードページの機能強化** - GitHub Releases API統合
2. **OS検出機能** - 適切なパッケージの推奨
3. **macOS/Linuxビルドの有効化** - 全プラットフォーム対応

### 優先度: 中
4. **パッケージ情報の表示** - バージョン、サイズ等
5. **エラーハンドリング** - リリース取得失敗時の対応

### 優先度: 低
6. **ダウンロード統計** - ダウンロード数の表示
7. **更新通知** - 新バージョン通知機能

---

## 📦 パッケージ形式

### Windows
- **MSI**: インストーラー（推奨）
- **NSIS**: インストーラー（オプション）
- **EXE**: 実行ファイル（オプション）

### macOS
- **DMG**: ディスクイメージ（推奨）
- **APP**: アプリケーションバンドル

### Linux
- **AppImage**: ポータブル実行ファイル（推奨）
- **DEB**: Debian/Ubuntu用パッケージ

---

## 🚀 実装手順

### ステップ1: ダウンロードページのJavaScript実装

1. `WEB/js/download.js` を作成・更新
2. GitHub Releases API統合
3. OS検出機能の実装
4. ダウンロードボタンの動的生成

### ステップ2: HTMLの更新

1. `WEB/download.html` にバージョン情報表示領域を追加
2. JavaScriptファイルの読み込み追加

### ステップ3: ビルドワークフローの更新

1. macOS/Linuxビルドの有効化
2. リリース作成ジョブの更新

### ステップ4: テスト

1. ローカルでの動作確認
2. GitHub Pagesデプロイ後の確認
3. ダウンロードリンクの動作確認

---

## 📋 次のステップ

実装を開始する場合は、以下の順序で進めることを推奨します：

1. **ダウンロードページのJavaScript実装**（WEB/js/download.js）
2. **HTMLの更新**（WEB/download.html）
3. **ビルドワークフローの更新**（.github/workflows/build.yml）
4. **テスト・デプロイ**

---

**作成日**: 2024年  
**ステータス**: 実装計画書（未実装）

