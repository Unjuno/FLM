---
name: Phase 3 Packaging Complete Implementation
overview: "Phase 3パッケージング作業の完全実装: コード署名の設定（Step 6）、セキュリティ対策の実装（Step 7）、アンインストーラ統合の改善を段階的に実装する"
todos:
  - id: step1_windows_verify
    content: Windows署名検証ステップをbuild.ymlに追加（MSI/NSIS両方）
    status: completed
  - id: step1_macos_verify
    content: macOS署名検証ステップをbuild.ymlに追加（DMG/App両方）
    status: completed
  - id: step1_linux_verify
    content: Linux GPG署名検証ステップをbuild.ymlに追加
    status: completed
  - id: step3_secrets_doc
    content: GitHub Secretsのアクセス制限設定をCODE_SIGNING_POLICY.mdに追記
    status: completed
  - id: step3_release_notes
    content: リリースノートへの署名情報自動追加を改善
    status: completed
  - id: step3_build_log
    content: 署名検証結果をビルドログに記録するステップを追加
    status: completed
  - id: step4_linux_postrm
    content: Linux DEB postrmスクリプトのエラーハンドリングとログ出力を改善
    status: completed
  - id: step4_macos_doc
    content: macOSアンインストール手順をドキュメント化
    status: completed
  - id: step4_windows_verify
    content: Windows NSISフックの動作確認とエラーハンドリング改善
    status: completed
  - id: step5_ci_test
    content: CIワークフローで各プラットフォームのビルドと署名検証をテスト
    status: pending
  - id: step5_local_test
    content: ローカル環境で各プラットフォームのビルドと署名検証をテスト
    status: pending
  - id: step5_uninstaller_test
    content: アンインストーラの動作確認（Windows/Linux）
    status: pending
  - id: step6_phase3_plan
    content: PHASE3_PACKAGING_PLAN.mdのStep 6とStep 7を完了済みに更新
    status: completed
  - id: step6_remaining_tasks
    content: REMAINING_TASKS.mdのPhase 3パッケージング作業を完了済みに更新
    status: completed
  - id: step6_code_signing_policy
    content: CODE_SIGNING_POLICY.mdの実装済み項目を更新
    status: completed
---

# Phase 3 パッケージング作業完全実装計画

## 概要

Phase 3パッケージング作業の残り3つの主要タスクを段階的に実装します：

1. コード署名の設定（Step 6）の完全実装
2. セキュリティ対策の実装（Step 7）
3. アンインストーラ統合の改善

## 現状分析

### コード署名（Step 6）

- `.github/workflows/build.yml`に基本的な署名設定は実装済み
- Windows: `TAURI_SIGNING_PRIVATE_KEY`環境変数は設定済み、署名検証ステップが不足
- macOS: `APPLE_CERTIFICATE`関連設定はあるが、署名検証とnotarizationが不足
- Linux: GPG署名は実装済みだが、検証ステップが不足

### セキュリティ対策（Step 7）

- ハッシュ値生成（SHA256）は実装済み
- `checksums.txt`の生成は実装済み
- GPG署名による`checksums.txt`の署名は実装済み
- 署名検証ステップの自動化が不足

### アンインストーラ統合

- Windows (NSIS): `install-ca.nsh`に`NSIS_HOOK_POSTUNINSTALL`実装済み
- Linux (DEB): `postrm`スクリプト実装済み
- macOS (DMG): アンインストールフックは通常サポートされないため、手動削除手順のみ

## 実装ステップ

### Step 1: コード署名検証ステップの追加

**目的**: 各プラットフォームで署名が正しく行われたことをCIで検証する

**実装内容**:

1. **Windows署名検証ステップの追加**

                                                - ファイル: `.github/workflows/build.yml`
                                                - 場所: `build-windows`ジョブの`Build Tauri (Windows)`ステップの後
                                                - 内容:
     ```yaml
     - name: Verify Windows signatures
       if: secrets.TAURI_SIGNING_PRIVATE_KEY != ''
       run: |
         # MSI署名の検証
         if (Test-Path "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi") {
           Get-ChildItem "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi" | ForEach-Object {
             signtool verify /pa $_.FullName
             if ($LASTEXITCODE -ne 0) {
               Write-Error "MSI signature verification failed for $($_.Name)"
               exit 1
             }
           }
         }
         # NSIS署名の検証
         if (Test-Path "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe") {
           Get-ChildItem "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe" | ForEach-Object {
             signtool verify /pa $_.FullName
             if ($LASTEXITCODE -ne 0) {
               Write-Error "NSIS signature verification failed for $($_.Name)"
               exit 1
             }
           }
         }
     ```


2. **macOS署名検証ステップの追加**

                                                - ファイル: `.github/workflows/build.yml`
                                                - 場所: `build-macos`ジョブの`Build Tauri (macOS)`ステップの後
                                                - 内容:
     ```yaml
     - name: Verify macOS signatures
       if: secrets.APPLE_CERTIFICATE != ''
       run: |
         # DMG署名の検証
         if [ -f "src-tauri/target/release/*.dmg" ]; then
           for dmg in src-tauri/target/release/*.dmg; do
             spctl --assess --type execute --verbose "$dmg" || exit 1
           done
         fi
         # App署名の検証
         if [ -d "src-tauri/target/release/bundle/macos" ]; then
           find src-tauri/target/release/bundle/macos -name "*.app" -exec codesign --verify --verbose {} \; || exit 1
         fi
     ```


3. **Linux GPG署名検証ステップの追加**

                                                - ファイル: `.github/workflows/build.yml`
                                                - 場所: `build-linux`ジョブの`Sign Linux artifacts with GPG`ステップの後
                                                - 内容:
     ```yaml
     - name: Verify Linux GPG signatures
       if: startsWith(github.ref, 'refs/tags/v') && secrets.LINUX_GPG_KEY != ''
       run: |
         # GPG公開鍵のインポート（検証用）
         echo "${{ secrets.LINUX_GPG_KEY }}" | gpg --batch --import
         # 署名の検証
         cd src-tauri/target/release
         for sig in *.sig; do
           if [ -f "$sig" ]; then
             file="${sig%.sig}"
             gpg --verify "$sig" "$file" || exit 1
           fi
         done
         cd bundle/deb
         for sig in *.sig; do
           if [ -f "$sig" ]; then
             file="${sig%.sig}"
             gpg --verify "$sig" "$file" || exit 1
           fi
         done
     ```


**参照ファイル**:

- `.github/workflows/build.yml` (79-92行目, 146-163行目, 230-277行目)
- `docs/specs/CODE_SIGNING_POLICY.md` (84-86行目, 93行目)

**見積もり**: 0.5日

---

### Step 2: macOS Notarizationの追加（オプション）

**目的**: macOSアプリのnotarizationを有効化する（Phase 3.5として将来実装）

**実装内容**:

- `build-macos`ジョブに`xcrun stapler staple`ステップを追加
- Apple Notary APIとの統合
- 現時点ではスキップ（将来実装）

**参照ファイル**:

- `docs/specs/CODE_SIGNING_POLICY.md` (92行目)

**見積もり**: 1-2日（将来実装）

---

### Step 3: セキュリティ対策の完全実装

**目的**: ビルド環境の保護とインストール時の検証を強化する

**実装内容**:

1. **GitHub Secretsのアクセス制限設定**

                                                - リポジトリ設定でSecretsへのアクセスを制限
                                                - 必要なSecretsのリスト化とドキュメント化
                                                - ファイル: `docs/specs/CODE_SIGNING_POLICY.md`に追記

2. **署名検証ステップの自動化強化**

                                                - Step 1で実装した検証ステップを必須化（`continue-on-error: false`）
                                                - 検証失敗時の明確なエラーメッセージ

3. **リリースノートへの署名情報自動追加**

                                                - ファイル: `.github/workflows/build.yml`
                                                - 場所: `create-release`ジョブの`Generate release notes`ステップ
                                                - 内容: GPG公開鍵のインポート手順と署名検証手順を自動追加
                                                - 現在の実装（357-368行目）を改善

4. **ビルドログへの記録**

                                                - 署名検証結果を`reports/BUILD_LOG_YYYYMMDD.md`に記録
                                                - ファイル: `.github/workflows/build.yml`にステップ追加

**参照ファイル**:

- `.github/workflows/build.yml` (330-373行目)
- `docs/specs/CODE_SIGNING_POLICY.md` (104-111行目)

**見積もり**: 0.5日

---

### Step 4: アンインストーラ統合の改善

**目的**: すべてのプラットフォームでアンインストール時の証明書削除を確実に実行する

**実装内容**:

1. **Linux DEB postrmスクリプトの改善**

                                                - ファイル: `src-tauri/installer/postrm`
                                                - 改善点:
                                                                                - エラーハンドリングの強化
                                                                                - ログ出力の改善
                                                                                - 非対話モードでの動作確認

2. **macOSアンインストール手順のドキュメント化**

                                                - macOS DMGは通常アンインストールフックをサポートしないため、手動削除手順を明確化
                                                - ファイル: `docs/guides/SECURITY_FIREWALL_GUIDE.md`に追記
                                                - または: `src-tauri/resources/scripts/uninstall-ca.sh`のREADMEに追記

3. **Windows NSISフックの動作確認**

                                                - ファイル: `src-tauri/installer/install-ca.nsh`
                                                - `NSIS_HOOK_POSTUNINSTALL`マクロの動作確認
                                                - エラーハンドリングの改善

4. **Tauri設定の確認**

                                                - ファイル: `src-tauri/tauri.conf.json`
                                                - Linux DEBの`postrm`スクリプトが正しく設定されているか確認
                                                - 現在の設定（72-82行目）を確認

**参照ファイル**:

- `src-tauri/installer/postrm` (現在開いているファイル)
- `src-tauri/installer/install-ca.nsh` (27-41行目)
- `src-tauri/tauri.conf.json` (72-82行目)
- `docs/status/completed/packaging/UNINSTALL_CERT_INTEGRATION_COMPLETE.md`

**見積もり**: 0.5日

---

### Step 5: テストと検証

**目的**: 実装した機能が正しく動作することを確認する

**実装内容**:

1. **CIワークフローのテスト実行**

                                                - 各プラットフォームのビルドが成功することを確認
                                                - 署名検証ステップが正しく動作することを確認

2. **ローカル環境でのテスト**

                                                - Windows: NSISインストーラーのビルドと署名検証
                                                - macOS: DMGのビルドと署名検証
                                                - Linux: DEBパッケージのビルドとGPG署名検証

3. **アンインストーラの動作確認**

                                                - Windows: NSISアンインストーラーで証明書削除が動作することを確認
                                                - Linux: DEBパッケージのアンインストールで証明書削除が動作することを確認

**見積もり**: 1日

---

### Step 6: ドキュメント更新

**目的**: 実装内容をドキュメントに反映する

**実装内容**:

1. **Phase 3パッケージング計画の更新**

                                                - ファイル: `docs/planning/PHASE3_PACKAGING_PLAN.md`
                                                - Step 6とStep 7を完了済みに更新

2. **残りの作業タスクリストの更新**

                                                - ファイル: `docs/status/active/REMAINING_TASKS.md`
                                                - Phase 3パッケージング作業を完了済みに更新

3. **コード署名ポリシーの更新**

                                                - ファイル: `docs/specs/CODE_SIGNING_POLICY.md`
                                                - 実装済み項目を更新

**見積もり**: 0.5日

---

## 実装順序

1. **Step 1**: コード署名検証ステップの追加（0.5日）
2. **Step 3**: セキュリティ対策の完全実装（0.5日）
3. **Step 4**: アンインストーラ統合の改善（0.5日）
4. **Step 5**: テストと検証（1日）
5. **Step 6**: ドキュメント更新（0.5日）

**合計見積もり**: 3日

---

## 注意事項

1. **GitHub Secretsの設定**: 実装前に必要なSecretsが設定されていることを確認
2. **macOS Notarization**: Phase 3.5として将来実装（現時点ではスキップ）
3. **macOSアンインストール**: DMGは通常アンインストールフックをサポートしないため、手動削除手順のみ
4. **テスト環境**: 各プラットフォームでのテストには実際の署名鍵が必要

---

## 関連ファイル

- `.github/workflows/build.yml` - メインのビルドワークフロー
- `src-tauri/installer/postrm` - Linux DEBアンインストールスクリプト
- `src-tauri/installer/install-ca.nsh` - Windows NSISフック
- `src-tauri/tauri.conf.json` - Tauri設定ファイル
- `docs/specs/CODE_SIGNING_POLICY.md` - コード署名ポリシー
- `docs/planning/PHASE3_PACKAGING_PLAN.md` - Phase 3パッケージング計画
- `docs/status/active/REMAINING_TASKS.md` - 残りの作業タスクリスト