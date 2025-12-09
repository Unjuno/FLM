# アンインストーラー証明書削除統合完了レポート

> Status: Completed | Date: 2025-01-28 | Category: Packaging

## 概要

Tauriインストーラーからのアンインストール時に証明書を自動削除する機能を統合しました。

## 実施内容

### Windows (NSIS)

**ファイル**: `src-tauri/installer/install-ca.nsh`

**実施内容**:
- `NSIS_HOOK_POSTUNINSTALL`マクロを実装
- アンインストール時にユーザーに証明書削除の確認を求める
- `uninstall-ca.ps1`スクリプトを`-Force`フラグ付きで実行

**設定**: `src-tauri/tauri.conf.json`の`bundle.windows.nsis.installerHooks`に設定済み

### Linux (DEB)

**ファイル**: `src-tauri/installer/postrm`

**実施内容**:
- DEBパッケージの`postrm`スクリプトを作成
- アンインストール時にユーザーに証明書削除の確認を求める
- `uninstall-ca.sh`スクリプトを`--yes`フラグ付きで実行

**設定**: `src-tauri/tauri.conf.json`の`bundle.linux.deb.postrm`に追加

### macOS (DMG)

**ファイル**: `src-tauri/installer/postinstall.sh`

**実施内容**:
- `postinstall`スクリプトを設定（インストール時のみ）
- 注意: macOSのアンインストールフックは通常サポートされていないため、アンインストール時の証明書削除は手動で行う必要があります

**設定**: `src-tauri/tauri.conf.json`の`bundle.macOS.dmg.postinstall`に追加

### スクリプト改善

**ファイル**: `src-tauri/resources/scripts/uninstall-ca.sh`

**実施内容**:
- 非対話モードフラグ（`-y`, `--yes`, `-f`, `--force`）を追加
- アンインストーラーからの自動実行に対応

## 参照

- `docs/planning/PHASE3_PACKAGING_PLAN.md` セクション1.4
- `src-tauri/tauri.conf.json`
- `src-tauri/installer/install-ca.nsh`
- `src-tauri/installer/postrm`
