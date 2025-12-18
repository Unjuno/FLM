# GitHub Actions Workflow コードレビュー: build.yml

## レビュー日時
2025-01-28

## 概要
`.github/workflows/build.yml` の段階的コードレビュー結果

---

## Step 1: ワークフロー構造とトリガー設定

### ✅ 良好な点
1. **トリガー設定**: `push`, `tags`, `workflow_dispatch` が適切に設定されている
2. **パス除外**: `archive/**` の変更をスキップする設定が適切
3. **タグパターン**: `v*` でバージョンタグを適切に検出

### ⚠️ 問題点

#### 1.1 トリガー設定の不整合
```yaml
on:
  push:
    branches: [ main, develop ]
    paths-ignore:
      - 'archive/**'
    tags:
      - 'v*'  # ❌ これは push.tags ではなく、on.tags として独立すべき
```

**問題**: `tags` が `push` の下にネストされているが、これは正しい構文ではない。GitHub Actionsでは `tags` は `on` の直接の子要素として定義すべき。

**修正案**:
```yaml
on:
  push:
    branches: [ main, develop ]
    paths-ignore:
      - 'archive/**'
  tags:
    - 'v*'
  workflow_dispatch:
```

#### 1.2 条件分岐の冗長性
- 197行目、511行目: `if: ${{ startsWith(github.ref, 'refs/tags/v') || github.event_name == 'push' }}`
- 652行目: `if: ${{ startsWith(github.ref, 'refs/tags/v') }}`

**問題**: `push` イベントは既にトリガー条件で指定されているため、`github.event_name == 'push'` のチェックは冗長。

**推奨**: 条件を簡素化
```yaml
if: ${{ startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch' }}
```

---

## Step 2: セキュリティ設定と権限管理

### ✅ 良好な点
1. **最小権限の原則**: `permissions: contents: write` のみ設定
2. **シークレットの条件分岐**: 署名キーの有無を環境変数で確認

### ⚠️ 問題点

#### 2.1 権限設定の粒度不足
```yaml
permissions:
  contents: write  # ❌ すべてのジョブに適用される
```

**問題**: 
- `create-release` ジョブのみが `contents: write` を必要とする
- ビルドジョブ（`build-windows`, `build-macos`, `build-linux`）は `contents: read` で十分

**推奨**: ジョブレベルで権限を個別に設定
```yaml
permissions:
  contents: read  # デフォルトは読み取りのみ

jobs:
  build-windows:
    permissions:
      contents: read
  # ...
  create-release:
    permissions:
      contents: write  # リリース作成時のみ書き込み権限
```

#### 2.2 シークレットの直接参照
```yaml
env:
  HAS_SIGNING_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}
```

**問題**: シークレットの存在チェックは良いが、実際の使用箇所で直接参照している（162-163行目など）

**推奨**: 環境変数経由で使用し、ログに漏洩しないよう注意

#### 2.3 シークレットの漏洩リスク
- 359行目: `npm run tauri:build 2>&1 | tee /tmp/tauri-build.log` 
  - ビルドログにシークレットが含まれる可能性
- 594行目: `echo "${{ secrets.LINUX_GPG_KEY_PASS }}" | gpg ...`
  - コマンドライン引数としてシークレットを渡している（プロセス一覧に表示される可能性）

**推奨**: 
- シークレットは環境変数経由で渡す
- ログ出力前にシークレットをマスクする処理を追加

---

## Step 3: 各ジョブの設定とエラーハンドリング

### ✅ 良好な点
1. **タイムアウト設定**: ビルドジョブに30分のタイムアウトが設定されている
2. **詳細なデバッグ出力**: macOSビルドで詳細なログ出力

### ⚠️ 問題点

#### 3.1 エラーハンドリングの不整合
```yaml
- name: Install dependencies
  run: npm ci
  if: ${{ hashFiles('package.json') != '' }}
  continue-on-error: true  # ❌ 依存関係のインストール失敗を無視
```

**問題**: 
- 依存関係のインストール失敗を無視すると、後続のビルドが確実に失敗する
- `continue-on-error: true` は、オプショナルなステップにのみ使用すべき

**推奨**: 
```yaml
- name: Install dependencies
  run: npm ci
  if: ${{ hashFiles('package.json') != '' }}
  # continue-on-error を削除（デフォルトは false）
```

#### 3.2 条件付きステップの論理エラー
```yaml
- name: Build frontend
  run: npm run build
  if: ${{ hashFiles('package.json') != '' }}  # ❌ package.json が存在しない場合にスキップ
  continue-on-error: false
```

**問題**: 
- `package.json` が存在しない場合、フロントエンドビルドがスキップされる
- しかし、Tauriアプリにはフロントエンドが必要なため、ビルドは失敗する

**推奨**: 条件を削除するか、より適切な条件に変更
```yaml
- name: Build frontend
  run: npm run build
  # if 条件を削除（package.json は必須）
```

#### 3.3 Rust コンパイルチェックの冗長性
```yaml
- name: Check Rust compilation
  # ...
  continue-on-error: true  # ❌ コンパイルエラーを無視
```

**問題**: 
- コンパイルチェックでエラーを無視しても、後続のビルドで同じエラーが発生する
- 早期にエラーを検出する目的が達成されない

**推奨**: 
- `continue-on-error: false` に変更（デフォルト）
- または、このステップを削除してビルドステップでエラーを検出

#### 3.4 署名検証の条件分岐
```yaml
- name: Verify Windows signatures
  if: env.HAS_SIGNING_KEY == 'true'  # ✅ 適切
  # ...
  continue-on-error: true  # ❌ 署名検証失敗を無視
```

**問題**: 署名検証が失敗した場合でもビルドが成功として扱われる

**推奨**: 
```yaml
continue-on-error: false  # 署名検証は必須
```

---

## Step 4: キャッシュ戦略と最適化

### ✅ 良好な点
1. **Rust依存関係のキャッシュ**: 適切に設定されている
2. **npmキャッシュ**: `setup-node@v4` で自動キャッシュ

### ⚠️ 問題点

#### 4.1 キャッシュキーの一貫性
```yaml
# Windows (109行目)
key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

# macOS (229行目)
key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

# Linux (558行目)
key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

**問題**: すべて同じキーパターンを使用しているが、`Cargo.lock` の場所が異なる可能性がある

**推奨**: より具体的なパスを指定
```yaml
key: ${{ runner.os }}-cargo-${{ hashFiles('Cargo.toml', '**/Cargo.lock') }}
```

#### 4.2 キャッシュパスの不一致
```yaml
# Windows (104-108行目)
path: |
  C:\Users\runner\.cargo\bin
  C:\Users\runner\.cargo\registry\index
  # ...

# macOS/Linux (224-228行目, 552-557行目)
path: |
  ~/.cargo/bin/
  ~/.cargo/registry/index/
  # ...
```

**問題**: パスの形式が異なるが、これはプラットフォームの違いによるものなので問題なし

**確認事項**: Windowsのパスに末尾スラッシュがないが、これは問題ないか確認

---

## Step 5: 署名と検証プロセス

### ✅ 良好な点
1. **プラットフォーム別の署名検証**: 各プラットフォームで適切に検証
2. **条件付き署名**: シークレットが存在する場合のみ署名

### ⚠️ 問題点

#### 5.1 Windows署名検証のパス問題
```yaml
if (Test-Path "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe") {
  # ❌ Test-Path はワイルドカードを展開しない
```

**問題**: PowerShellの `Test-Path` はワイルドカードを展開しないため、条件が常に `false` になる可能性がある

**推奨**: 
```powershell
$exeFiles = Get-ChildItem "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe" -ErrorAction SilentlyContinue
if ($exeFiles) {
  # ...
}
```

#### 5.2 Linux GPG署名のエラーハンドリング
```yaml
- name: Sign Linux artifacts with GPG
  # ...
  continue-on-error: true  # ❌ 署名失敗を無視
```

**問題**: 署名が失敗してもビルドが成功として扱われる

**推奨**: 
```yaml
continue-on-error: false  # タグビルドでは署名は必須
```

#### 5.3 GPGキーIDの参照
```yaml
--default-key "${{ secrets.LINUX_GPG_KEY_ID }}"  # ❌ シークレットが未定義の場合
```

**問題**: `LINUX_GPG_KEY_ID` がシークレットに存在しない場合、エラーになる

**推奨**: 環境変数で確認
```yaml
env:
  LINUX_GPG_KEY_ID: ${{ secrets.LINUX_GPG_KEY_ID || '' }}
```

---

## Step 6: コードの重複と保守性

### ⚠️ 問題点

#### 6.1 重複するステップ
以下のステップが3つのジョブで重複している:
- `Checkout code`
- `Setup Node.js`
- `Install dependencies`
- `Setup Rust`
- `Cache Rust dependencies`
- `Build frontend`
- `Check Rust compilation`

**推奨**: 再利用可能なComposite ActionまたはReusable Workflowに抽出

#### 6.2 重複するキャッシュ設定
Rust依存関係のキャッシュ設定が3回繰り返されている

**推奨**: Composite Actionに抽出

#### 6.3 プラットフォーム固有のスクリプト
Windows、macOS、Linuxで異なるシェルスクリプトを使用しているが、ロジックが重複している部分がある

**推奨**: 可能な限り共通化

---

## Step 7: ベストプラクティスと推奨事項

### ⚠️ 改善点

#### 7.1 アーティファクトのアップロード条件
```yaml
- name: Upload Windows artifacts
  uses: actions/upload-artifact@v4
  if: always()  # ✅ ビルド失敗時もアップロード（デバッグに有用）
```

**良好**: ビルド失敗時もアーティファクトをアップロードすることで、デバッグが容易になる

#### 7.2 リリースノート生成
```yaml
- name: Generate release notes
  # ...
  echo "gpg --import <(curl -s https://raw.githubusercontent.com/unjuno/FLM/main/.github/gpg-public-key.asc)" >> release_notes.md
```

**問題**: ハードコードされたURL。リポジトリ名が変更された場合に問題

**推奨**: 
```yaml
echo "gpg --import <(curl -s https://raw.githubusercontent.com/${{ github.repository }}/main/.github/gpg-public-key.asc)" >> release_notes.md
```

#### 7.3 チェックサム生成
```yaml
find . -type f \( -name "*.exe" -o -name "*.msi" -o ... \) -exec sha256sum {} \;
```

**問題**: `.app` はディレクトリのため、`-type f` では検出されない

**推奨**: 
```yaml
find . -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.dmg" -o -name "*.AppImage" -o -name "*.deb" \) -exec sha256sum {} \;
# .app は別途処理
find . -type d -name "*.app" -exec sh -c 'tar -czf - "$1" | sha256sum' _ {} \;
```

#### 7.4 環境変数の設定タイミング
```yaml
env:
  HAS_SIGNING_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}
```

**問題**: ジョブレベルの `env` はすべてのステップに適用されるが、一部のステップでは不要

**推奨**: 必要なステップでのみ環境変数を設定

---

## 総合評価

### 重大な問題
1. ❌ **トリガー設定の構文エラー** (12-13行目): `tags` のネストが不正
2. ❌ **権限設定の粒度不足**: すべてのジョブに `contents: write` が適用されている
3. ❌ **エラーハンドリングの不整合**: 重要なステップで `continue-on-error: true` が使用されている

### 中程度の問題
1. ⚠️ **コードの重複**: 3つのジョブで同じステップが繰り返されている
2. ⚠️ **署名検証の条件**: 一部の署名検証で `continue-on-error: true` が使用されている
3. ⚠️ **Windows署名検証のパス問題**: ワイルドカードの展開が正しくない

### 軽微な改善点
1. 💡 **リリースノートのURL**: ハードコードされたリポジトリ名
2. 💡 **チェックサム生成**: `.app` ディレクトリの処理が不完全
3. 💡 **環境変数のスコープ**: 不要な箇所でも環境変数が設定されている

---

## 優先度別の修正推奨

### 🔴 高優先度（即座に修正）
1. トリガー設定の構文エラー修正
2. 権限設定の粒度化
3. 依存関係インストールの `continue-on-error` 削除

### 🟡 中優先度（次回リリース前に修正）
1. 署名検証の `continue-on-error` 修正
2. Windows署名検証のパス問題修正
3. コードの重複削減（Composite Action化）

### 🟢 低優先度（改善の機会に修正）
1. リリースノートのURL動的化
2. チェックサム生成の改善
3. 環境変数のスコープ最適化

---

## 次のステップ

1. 重大な問題から順に修正
2. テスト環境で動作確認
3. 段階的に改善を適用
