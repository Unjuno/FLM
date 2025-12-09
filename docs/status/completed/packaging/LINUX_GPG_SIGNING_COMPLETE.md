# Linux GPG署名実装完了レポート

> Status: Completed | Date: 2025-01-28 | Category: Packaging

## 概要

Linuxパッケージ（AppImage、DEB）のGPG署名機能を実装し、GitHub Actionsワークフローに統合しました。

## 実施内容

### GitHub Actionsワークフロー

**ファイル**: `.github/workflows/build.yml`

**実施内容**:
- `Setup GPG for signing`ステップを追加（GPGキーのインポート）
- `Sign Linux artifacts with GPG`ステップを追加（AppImageとDEBパッケージの署名）
- `Sign checksums with GPG`ステップを追加（チェックサムファイルの署名）
- 署名はタグ付きリリース時のみ実行されるように設定

### Secrets設定ドキュメント化

**ファイル**: `docs/specs/CODE_SIGNING_POLICY.md`

**実施内容**:
- Linux GPG Secrets設定手順を追加
- GPGキーペアの生成方法
- GitHub Secretsの設定方法
- 公開鍵のエクスポート方法

## 必要なSecrets

以下のGitHub Secretsを設定する必要があります：

1. `LINUX_GPG_KEY`: GPG秘密鍵（ASCII形式）
2. `LINUX_GPG_KEY_PASS`: GPGキーのパスフレーズ
3. `LINUX_GPG_KEY_ID`: GPGキーID（公開鍵フィンガープリントの短縮版）

## 署名されるファイル

- `*.AppImage` → `*.AppImage.sig`
- `*.deb` → `*.deb.sig`
- `checksums.txt` → `checksums.txt.sig`

## 参照

- `docs/specs/CODE_SIGNING_POLICY.md`
- `.github/workflows/build.yml`
- `docs/planning/PHASE3_PACKAGING_PLAN.md`
