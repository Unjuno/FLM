# Step 5: テストと検証 - 詳細計画

> Status: Scripts Implemented | Updated: 2025-02-01 | Audience: All contributors

## 概要

Phase 3パッケージング作業のStep 5として、実装した機能が正しく動作することを確認するための包括的なテスト計画です。

## テスト対象

1. **CIワークフローのテスト実行** ✅
   - 各プラットフォームのビルドが成功することを確認
   - 署名検証ステップが正しく動作することを確認
   - **実装**: `scripts/ci-workflow-verify.sh` と `scripts/ci-workflow-verify.ps1` を作成
   - **結果**: `reports/CI_WORKFLOW_TEST_RESULTS.md` を参照

2. **ローカル環境でのテスト** ✅
   - Windows: NSISインストーラーのビルドと署名検証
   - macOS: DMGのビルドと署名検証
   - Linux: DEBパッケージのビルドとGPG署名検証
   - **実装**: `scripts/local-build-test.sh` と `scripts/local-build-test.ps1` を作成
   - **結果**: `reports/LOCAL_TEST_RESULTS.md` を参照

3. **アンインストーラの動作確認** ✅
   - Windows: NSISアンインストーラーで証明書削除が動作することを確認
   - Linux: DEBパッケージのアンインストールで証明書削除が動作することを確認
   - **実装**: `scripts/uninstaller-test.sh` を作成
   - **結果**: `reports/UNINSTALLER_TEST_RESULTS.md` を参照

---

## テスト1: CIワークフローのテスト実行

### 目的
各プラットフォームのビルドが成功し、署名検証ステップが正しく動作することを確認する。

### 前提条件
- GitHub ActionsのSecretsが設定されていること
  - Windows: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`
  - Linux: `LINUX_GPG_KEY`, `LINUX_GPG_KEY_PASS`, `LINUX_GPG_KEY_ID`

### Step-by-Step 計画

#### Step 1.1: テスト用ブランチの作成
```bash
# テスト用ブランチを作成
git checkout -b test/ci-workflow-verification
```

**確認項目**:
- [ ] ブランチが正常に作成された
- [ ] 最新のmainブランチの変更が含まれている

**見積もり**: 5分

---

#### Step 1.2: ワークフローファイルの確認
**ファイル**: `.github/workflows/build.yml`

**確認項目**:
- [ ] Windowsビルドジョブに署名検証ステップが含まれている（85-108行目）
- [ ] macOSビルドジョブに署名検証ステップが含まれている（182-195行目）
- [ ] LinuxビルドジョブにGPG署名検証ステップが含まれている（307-327行目）
- [ ] 各署名検証ステップの条件分岐が正しい（`if: secrets.XXX != ''`）

**確認コマンド**:
```bash
# ワークフローファイルの構文チェック
yamllint .github/workflows/build.yml
```

**見積もり**: 15分

---

#### Step 1.3: テスト用タグの作成とプッシュ
```bash
# テスト用タグを作成（例: v0.1.0-test）
git tag -a v0.1.0-test -m "Test tag for CI workflow verification"
git push origin v0.1.0-test
```

**確認項目**:
- [ ] タグが正常に作成された
- [ ] タグがリモートにプッシュされた
- [ ] GitHub Actionsでワークフローがトリガーされた

**見積もり**: 10分

---

#### Step 1.4: Windowsビルドジョブの確認
**GitHub Actions**: `build-windows`ジョブ

**確認項目**:
- [ ] ビルドが成功した（`Build Tauri (Windows)`ステップ）
- [ ] MSIファイルが生成された（`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi`）
- [ ] NSISインストーラーが生成された（`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`）
- [ ] 署名検証ステップが実行された（`Verify Windows signatures`）
- [ ] 署名検証が成功した（エラーがない）
- [ ] アーティファクトがアップロードされた（`windows-build`）

**確認方法**:
1. GitHub Actionsのログを確認
2. 各ステップの出力を確認
3. アーティファクトのダウンロードと確認

**見積もり**: 30分（ビルド時間含む）

---

#### Step 1.5: macOSビルドジョブの確認
**GitHub Actions**: `build-macos`ジョブ

**確認項目**:
- [ ] ビルドが成功した（`Build Tauri (macOS)`ステップ）
- [ ] DMGファイルが生成された（`src-tauri/target/release/*.dmg`）
- [ ] Appバンドルが生成された（`src-tauri/target/release/bundle/macos/**/*.app`）
- [ ] 署名検証ステップが実行された（`Verify macOS signatures`）
- [ ] 署名検証が成功した（エラーがない）
- [ ] アーティファクトがアップロードされた（`macos-build`）

**確認方法**:
1. GitHub Actionsのログを確認
2. 各ステップの出力を確認
3. アーティファクトのダウンロードと確認

**見積もり**: 30分（ビルド時間含む）

---

#### Step 1.6: Linuxビルドジョブの確認
**GitHub Actions**: `build-linux`ジョブ

**確認項目**:
- [ ] ビルドが成功した（`Build Tauri (Linux)`ステップ）
- [ ] DEBパッケージが生成された（`src-tauri/target/release/bundle/deb/*.deb`）
- [ ] AppImageファイルが生成された（`src-tauri/target/release/*.AppImage`）
- [ ] GPG署名が生成された（`*.deb.sig`, `*.AppImage.sig`）
- [ ] GPG署名検証ステップが実行された（`Verify Linux GPG signatures`）
- [ ] 署名検証が成功した（エラーがない）
- [ ] アーティファクトがアップロードされた（`linux-build`）

**確認方法**:
1. GitHub Actionsのログを確認
2. 各ステップの出力を確認
3. アーティファクトのダウンロードと確認

**見積もり**: 30分（ビルド時間含む）

---

#### Step 1.7: リリース作成ジョブの確認
**GitHub Actions**: `create-release`ジョブ

**確認項目**:
- [ ] チェックサムファイルが生成された（`checksums.txt`）
- [ ] GPG署名が生成された（`checksums.txt.sig`）
- [ ] ビルドログが記録された（`reports/BUILD_LOG_YYYYMMDD.md`）
- [ ] リリースノートが生成された（`release_notes.md`）
- [ ] GitHub Releaseが作成された
- [ ] すべてのアーティファクトがリリースに添付された

**確認方法**:
1. GitHub Actionsのログを確認
2. GitHub Releasesページを確認
3. リリースノートの内容を確認

**見積もり**: 20分

---

#### Step 1.8: テスト結果の記録
**ファイル**: `reports/CI_WORKFLOW_TEST_RESULTS.md`

**記録内容**:
- テスト実行日時
- テスト用タグ名
- 各プラットフォームのビルド結果
- 署名検証結果
- 発見された問題（あれば）
- 修正内容（あれば）

**見積もり**: 15分

---

### テスト1の合計見積もり
**合計**: 約2.5時間（ビルド時間含む）

---

## テスト2: ローカル環境でのテスト

### 目的
ローカル環境で各プラットフォームのビルドと署名検証をテストする。

### 前提条件
- 各プラットフォームの開発環境が整っていること
- 署名鍵がローカルに設定されていること（オプション）

---

### テスト2.1: Windowsローカルビルドテスト

#### Step 2.1.1: 環境準備
**確認項目**:
- [ ] Node.js 20がインストールされている
- [ ] Rust toolchainがインストールされている（`x86_64-pc-windows-msvc`ターゲット）
- [ ] Tauri CLIがインストールされている（`npm install -g @tauri-apps/cli`）
- [ ] Windows SDKがインストールされている
- [ ] 署名鍵が設定されている（オプション、`TAURI_SIGNING_PRIVATE_KEY`環境変数）

**確認コマンド**:
```powershell
# Node.jsバージョン確認
node --version

# Rustバージョン確認
rustc --version

# Tauri CLI確認
tauri --version

# Windows SDK確認
where signtool
```

**見積もり**: 30分

---

#### Step 2.1.2: フロントエンドビルド
```powershell
# 依存関係のインストール
npm ci

# フロントエンドビルド
npm run build
```

**確認項目**:
- [ ] ビルドが成功した
- [ ] `dist/`ディレクトリにビルド成果物が生成された

**見積もり**: 10分

---

#### Step 2.1.3: Tauriビルド（Windows）
```powershell
# Windows用ビルド
npm run tauri:build:windows
```

**確認項目**:
- [ ] ビルドが成功した
- [ ] MSIファイルが生成された（`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi`）
- [ ] NSISインストーラーが生成された（`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`）

**見積もり**: 20分（ビルド時間含む）

---

#### Step 2.1.4: 署名検証（Windows）
```powershell
# MSI署名の検証
Get-ChildItem "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi" | ForEach-Object {
    signtool verify /pa $_.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "MSI signature verification failed for $($_.Name)"
    }
}

# NSIS署名の検証
Get-ChildItem "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe" | ForEach-Object {
    signtool verify /pa $_.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "NSIS signature verification failed for $($_.Name)"
    }
}
```

**確認項目**:
- [ ] 署名検証が成功した（エラーがない）
- [ ] 署名情報が正しく表示された

**見積もり**: 10分

---

#### Step 2.1.5: テスト結果の記録
**ファイル**: `reports/LOCAL_WINDOWS_TEST_RESULTS.md`

**記録内容**:
- テスト実行日時
- 環境情報（OS、Node.js、Rustバージョン）
- ビルド結果
- 署名検証結果
- 発見された問題（あれば）

**見積もり**: 10分

---

### テスト2.2: macOSローカルビルドテスト

#### Step 2.2.1: 環境準備
**確認項目**:
- [ ] Node.js 20がインストールされている
- [ ] Rust toolchainがインストールされている
- [ ] Tauri CLIがインストールされている
- [ ] Xcode Command Line Toolsがインストールされている
- [ ] 署名鍵が設定されている（オプション、`APPLE_CERTIFICATE`環境変数）

**確認コマンド**:
```bash
# Node.jsバージョン確認
node --version

# Rustバージョン確認
rustc --version

# Tauri CLI確認
tauri --version

# Xcode Command Line Tools確認
xcode-select -p
```

**見積もり**: 30分

---

#### Step 2.2.2: フロントエンドビルド
```bash
# 依存関係のインストール
npm ci

# フロントエンドビルド
npm run build
```

**確認項目**:
- [ ] ビルドが成功した
- [ ] `dist/`ディレクトリにビルド成果物が生成された

**見積もり**: 10分

---

#### Step 2.2.3: Tauriビルド（macOS）
```bash
# macOS用ビルド
npm run tauri build
```

**確認項目**:
- [ ] ビルドが成功した
- [ ] DMGファイルが生成された（`src-tauri/target/release/*.dmg`）
- [ ] Appバンドルが生成された（`src-tauri/target/release/bundle/macos/**/*.app`）

**見積もり**: 20分（ビルド時間含む）

---

#### Step 2.2.4: 署名検証（macOS）
```bash
# DMG署名の検証
for dmg in src-tauri/target/release/*.dmg; do
    spctl --assess --type execute --verbose "$dmg" || exit 1
done

# App署名の検証
find src-tauri/target/release/bundle/macos -name "*.app" -exec codesign --verify --verbose {} \; || exit 1

# 詳細な署名情報の表示
find src-tauri/target/release/bundle/macos -name "*.app" -exec codesign -dvv {} \;
```

**確認項目**:
- [ ] 署名検証が成功した（エラーがない）
- [ ] 署名情報が正しく表示された

**見積もり**: 10分

---

#### Step 2.2.5: テスト結果の記録
**ファイル**: `reports/LOCAL_MACOS_TEST_RESULTS.md`

**記録内容**:
- テスト実行日時
- 環境情報（OS、Node.js、Rustバージョン）
- ビルド結果
- 署名検証結果
- 発見された問題（あれば）

**見積もり**: 10分

---

### テスト2.3: Linuxローカルビルドテスト

#### Step 2.3.1: 環境準備
**確認項目**:
- [ ] Node.js 20がインストールされている
- [ ] Rust toolchainがインストールされている
- [ ] Tauri CLIがインストールされている
- [ ] システム依存関係がインストールされている（`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`など）
- [ ] GPG鍵が設定されている（オプション）

**確認コマンド**:
```bash
# Node.jsバージョン確認
node --version

# Rustバージョン確認
rustc --version

# Tauri CLI確認
tauri --version

# システム依存関係確認
dpkg -l | grep -E "libwebkit2gtk|libgtk-3"
```

**見積もり**: 30分

---

#### Step 2.3.2: フロントエンドビルド
```bash
# 依存関係のインストール
npm ci

# フロントエンドビルド
npm run build
```

**確認項目**:
- [ ] ビルドが成功した
- [ ] `dist/`ディレクトリにビルド成果物が生成された

**見積もり**: 10分

---

#### Step 2.3.3: Tauriビルド（Linux）
```bash
# Linux用ビルド
npm run tauri build
```

**確認項目**:
- [ ] ビルドが成功した
- [ ] DEBパッケージが生成された（`src-tauri/target/release/bundle/deb/*.deb`）
- [ ] AppImageファイルが生成された（`src-tauri/target/release/*.AppImage`）

**見積もり**: 20分（ビルド時間含む）

---

#### Step 2.3.4: GPG署名と検証（Linux）
```bash
# GPG鍵のインポート（検証用）
gpg --import <(cat ~/.gnupg/public.key)

# DEBパッケージの署名（オプション、署名鍵がある場合）
cd src-tauri/target/release/bundle/deb
for file in *.deb; do
    gpg --batch --yes --armor --output "${file}.sig" --detach-sign "$file"
done

# 署名の検証
for sig in *.sig; do
    if [ -f "$sig" ]; then
        file="${sig%.sig}"
        gpg --verify "$sig" "$file" || exit 1
    fi
done
```

**確認項目**:
- [ ] GPG署名が生成された（オプション）
- [ ] 署名検証が成功した（エラーがない）

**見積もり**: 15分

---

#### Step 2.3.5: テスト結果の記録
**ファイル**: `reports/LOCAL_LINUX_TEST_RESULTS.md`

**記録内容**:
- テスト実行日時
- 環境情報（OS、Node.js、Rustバージョン）
- ビルド結果
- GPG署名検証結果
- 発見された問題（あれば）

**見積もり**: 10分

---

### テスト2の合計見積もり
**合計**: 約3時間（各プラットフォーム1時間）

---

## テスト3: アンインストーラの動作確認

### 目的
アンインストール時に証明書が正しく削除されることを確認する。

---

### テスト3.1: Windows NSISアンインストーラーテスト

#### Step 3.1.1: テスト環境の準備
**確認項目**:
- [ ] Windowsテスト環境が準備されている（VMまたは専用マシン）
- [ ] テスト用のNSISインストーラーがビルドされている
- [ ] 証明書がインストールされている（事前にインストール）

**見積もり**: 30分

---

#### Step 3.1.2: インストールの実行
```powershell
# NSISインストーラーの実行
.\FLM_*.exe

# インストール完了を確認
# - インストール先ディレクトリの確認
# - 証明書がインストールされたか確認
```

**確認項目**:
- [ ] インストールが成功した
- [ ] 証明書がシステムの信頼ストアにインストールされた
- [ ] インストールスクリプトが実行された（`install-ca.ps1`）

**確認コマンド**:
```powershell
# 証明書の確認
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*FLM*" }
```

**見積もり**: 15分

---

#### Step 3.1.3: アンインストールの実行
```powershell
# アンインストールの実行（コントロールパネルまたはプログラムと機能から）
# または
# アンインストーラーの直接実行
.\uninstall.exe
```

**確認項目**:
- [ ] アンインストールが成功した
- [ ] 証明書削除の確認ダイアログが表示された
- [ ] 証明書がシステムの信頼ストアから削除された
- [ ] アンインストールスクリプトが実行された（`uninstall-ca.ps1`）

**確認コマンド**:
```powershell
# 証明書が削除されたか確認
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*FLM*" }
# 結果が空であることを確認
```

**見積もり**: 15分

---

#### Step 3.1.4: エラーハンドリングの確認
**確認項目**:
- [ ] 証明書が存在しない場合のエラーハンドリング
- [ ] スクリプトが存在しない場合のエラーハンドリング
- [ ] 権限不足の場合のエラーハンドリング

**見積もり**: 20分

---

#### Step 3.1.5: テスト結果の記録
**ファイル**: `reports/WINDOWS_UNINSTALLER_TEST_RESULTS.md`

**記録内容**:
- テスト実行日時
- 環境情報（OS、バージョン）
- インストール結果
- アンインストール結果
- エラーハンドリングの確認結果
- 発見された問題（あれば）

**見積もり**: 10分

---

### テスト3.2: Linux DEBアンインストーラーテスト

#### Step 3.2.1: テスト環境の準備
**確認項目**:
- [ ] Linuxテスト環境が準備されている（VMまたは専用マシン）
- [ ] テスト用のDEBパッケージがビルドされている
- [ ] 証明書がインストールされている（事前にインストール）

**見積もり**: 30分

---

#### Step 3.2.2: インストールの実行
```bash
# DEBパッケージのインストール
sudo dpkg -i FLM_*.deb

# 依存関係の解決（必要に応じて）
sudo apt-get install -f
```

**確認項目**:
- [ ] インストールが成功した
- [ ] 証明書がシステムの信頼ストアにインストールされた
- [ ] postinstスクリプトが実行された

**確認コマンド**:
```bash
# 証明書の確認
ls -la /usr/local/share/ca-certificates/ | grep flm
# または
certutil -L | grep -i flm
```

**見積もり**: 15分

---

#### Step 3.2.3: アンインストールの実行
```bash
# DEBパッケージのアンインストール
sudo dpkg -r flm

# または
sudo apt-get remove flm
```

**確認項目**:
- [ ] アンインストールが成功した
- [ ] postrmスクリプトが実行された
- [ ] 証明書がシステムの信頼ストアから削除された
- [ ] ログファイルが生成された（`/var/log/flm-uninstall.log`）

**確認コマンド**:
```bash
# 証明書が削除されたか確認
ls -la /usr/local/share/ca-certificates/ | grep flm
# 結果が空であることを確認

# ログファイルの確認
cat /var/log/flm-uninstall.log
```

**見積もり**: 15分

---

#### Step 3.2.4: エラーハンドリングの確認
**確認項目**:
- [ ] 証明書が存在しない場合のエラーハンドリング
- [ ] スクリプトが存在しない場合のエラーハンドリング（代替パス検索）
- [ ] 非対話モードでの動作確認
- [ ] ログ出力の確認

**見積もり**: 20分

---

#### Step 3.2.5: テスト結果の記録
**ファイル**: `reports/LINUX_UNINSTALLER_TEST_RESULTS.md`

**記録内容**:
- テスト実行日時
- 環境情報（OS、バージョン）
- インストール結果
- アンインストール結果
- エラーハンドリングの確認結果
- ログファイルの内容
- 発見された問題（あれば）

**見積もり**: 10分

---

### テスト3の合計見積もり
**合計**: 約2時間（各プラットフォーム1時間）

---

## 全体のスケジュール

### 推奨実行順序

1. **テスト1: CIワークフローのテスト実行**（2.5時間）
   - 最初に実行し、CI環境での動作を確認
   - 問題があれば修正してからローカルテストに進む

2. **テスト2: ローカル環境でのテスト**（3時間）
   - Windows、macOS、Linuxの順に実行
   - 各プラットフォームで問題があれば修正

3. **テスト3: アンインストーラの動作確認**（2時間）
   - Windows、Linuxの順に実行
   - エラーハンドリングも含めて確認

### 合計見積もり
**合計**: 約7.5時間

---

## チェックリスト

### テスト1: CIワークフローのテスト実行
- [ ] テスト用ブランチの作成
- [ ] ワークフローファイルの確認
- [ ] テスト用タグの作成とプッシュ
- [ ] Windowsビルドジョブの確認
- [ ] macOSビルドジョブの確認
- [ ] Linuxビルドジョブの確認
- [ ] リリース作成ジョブの確認
- [ ] テスト結果の記録

### テスト2: ローカル環境でのテスト
- [ ] Windowsローカルビルドテスト
  - [ ] 環境準備
  - [ ] フロントエンドビルド
  - [ ] Tauriビルド
  - [ ] 署名検証
  - [ ] テスト結果の記録
- [ ] macOSローカルビルドテスト
  - [ ] 環境準備
  - [ ] フロントエンドビルド
  - [ ] Tauriビルド
  - [ ] 署名検証
  - [ ] テスト結果の記録
- [ ] Linuxローカルビルドテスト
  - [ ] 環境準備
  - [ ] フロントエンドビルド
  - [ ] Tauriビルド
  - [ ] GPG署名と検証
  - [ ] テスト結果の記録

### テスト3: アンインストーラの動作確認
- [ ] Windows NSISアンインストーラーテスト
  - [ ] テスト環境の準備
  - [ ] インストールの実行
  - [ ] アンインストールの実行
  - [ ] エラーハンドリングの確認
  - [ ] テスト結果の記録
- [ ] Linux DEBアンインストーラーテスト
  - [ ] テスト環境の準備
  - [ ] インストールの実行
  - [ ] アンインストールの実行
  - [ ] エラーハンドリングの確認
  - [ ] テスト結果の記録

---

## 関連ドキュメント

- `.cursor/plans/phase_3_packaging_complete_implementation_1a297fdf.plan.md` - Phase 3実装計画
- `.github/workflows/build.yml` - CIワークフローファイル
- `src-tauri/installer/install-ca.nsh` - Windows NSISフック
- `src-tauri/installer/postrm` - Linux DEB postrmスクリプト
- `docs/specs/CODE_SIGNING_POLICY.md` - コード署名ポリシー
- `docs/planning/PHASE3_PACKAGING_PLAN.md` - Phase 3パッケージング計画

---

**更新日**: 2025-02-01  
**ステータス**: In Progress  
**次のステップ**: テスト1（CIワークフローのテスト実行）から開始

