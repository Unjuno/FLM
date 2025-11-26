# Phase 3: パッケージング準備計画

> Status: Planning | Audience: Core developers, Packaging team | Updated: 2025-01-27

## 概要

Phase 3では、FLMをパッケージ版として配布するための準備を行います。主な目標は：

1. `packaged-ca`モードの実装（証明書自動管理）
2. インストーラーの作成（Windows/macOS/Linux）
3. コード署名とセキュリティ対策
4. 配布準備

## 実装タスク

### 1. packaged-caモードの実装

#### 1.1 ルートCA証明書の生成と同梱

**実装場所**: `crates/flm-core/src/services/certificate.rs` (新規作成)

**機能**:
- ビルド時に自己署名ルートCA証明書を生成
- 公開鍵 (`flm-ca.crt`) をインストーラに同梱
- 秘密鍵 (`flm-ca.key`) はGitHub Secretsで管理

**実装手順**:
1. `rcgen`クレートを使用してルートCA証明書を生成
2. ビルドスクリプト (`build.rs`) で証明書生成を実行
3. 公開鍵をリソースとして同梱
4. 秘密鍵は環境変数から読み込み（CI/CD環境）

**依存関係**:
- `rcgen`: 証明書生成
- `x509-parser`: 証明書解析（既存）

#### 1.2 サーバー証明書の自動生成

**実装場所**: `crates/flm-proxy/src/certificate.rs` (新規作成)

**機能**:
- `packaged-ca`モードで起動時、サーバー証明書を自動生成
- Subject Alternative Name (SAN) に以下を含める:
  - `localhost`, `127.0.0.1`, `::1`
  - RFC1918 プライベートIP範囲
- ルートCAで署名
- `AppData/flm/certs/server.pem` に保存
- 証明書が既に存在し有効期限内なら再利用

**実装手順**:
1. 証明書保存ディレクトリの作成
2. 既存証明書の有効期限チェック
3. 無効または存在しない場合、新規生成
4. ルートCA秘密鍵で署名
5. 証明書と秘密鍵を保存

#### 1.3 OS信頼ストアへの自動登録

**実装場所**: `crates/flm-core/src/services/certificate.rs`

**機能**:
- Windows: `Cert:\LocalMachine\Root` に登録（UAC確認）
- macOS: `security add-trusted-cert` を実行
- Linux: `/usr/local/share/ca-certificates/` にコピー後、`update-ca-certificates` を実行

**実装手順**:
1. OS検出（`std::env::consts::OS`）
2. プラットフォーム別の登録コマンドを実行
3. エラーハンドリングとログ記録

#### 1.4 アンインストール時の削除

**実装場所**: インストーラスクリプト（Tauri）

**機能**:
- アンインストーラで証明書を削除するオプションを提供
- 手動削除手順もドキュメントに記載

### 2. インストーラー作成

#### 2.1 Tauri設定の更新

**実装場所**: `archive/prototype/src-tauri/tauri.conf.json`

**機能**:
- インストーラーの設定
- コード署名の設定
- 証明書同梱の設定

#### 2.2 インストールスクリプト

**実装場所**: `archive/prototype/src-tauri/installer/`

**機能**:
- 証明書の自動登録
- ディレクトリの作成
- 設定ファイルの初期化

### 3. コード署名

#### 3.1 Windows

**実装場所**: `.github/workflows/build.yml`

**機能**:
- Tauri Signing Private Keyを使用
- インストーラにデジタル署名

#### 3.2 macOS

**実装場所**: `.github/workflows/build.yml`

**機能**:
- Apple Developer Certificateを使用
- DMGに署名

#### 3.3 Linux

**実装場所**: 将来実装予定

**機能**:
- GPG署名

### 4. セキュリティ対策

#### 4.1 ハッシュ値の公開

**実装場所**: GitHub Releases

**機能**:
- SHA256ハッシュ値を公開
- ダウンロードページに表示

#### 4.2 ビルド環境の保護

**実装場所**: GitHub Secrets

**機能**:
- 秘密鍵の管理
- アクセス制限
- 監査ログ

#### 4.3 インストール時の検証

**実装場所**: インストーラスクリプト

**機能**:
- 証明書のフィンガープリント検証
- インストールログの記録

## 実装順序

1. **Step 1**: ルートCA証明書生成機能の実装 ⏳ 進行中（rcgen APIの修正が必要）
   - `CertificateParams::new()`は引数不要に修正済み
   - `Certificate::from_params()`が存在しないため、正しいAPIに置き換えが必要
   - `rcgen` 0.13のAPIを確認し、`Certificate::generate()`または適切なAPIを使用
2. **Step 2**: サーバー証明書自動生成機能の実装
3. **Step 3**: `packaged-ca`モードの統合
4. **Step 4**: OS信頼ストアへの自動登録機能の実装
5. **Step 5**: インストーラー設定の更新
6. **Step 6**: コード署名の設定
7. **Step 7**: セキュリティ対策の実装

## スケジュール（2025-11-25 更新）

| 期間 | マイルストーン | 依存 / アウトプット |
| ---- | -------------- | -------------------- |
| 11/25〜12/06 | Step 1完了：`rcgen` API更新 & `certificate.rs` 雛形作成 | `rcgen` 0.13ドキュメントレビュー、`docs/specs/UI_MINIMAL.md` で必要となる証明書抽象化を共有 |
| 12/09〜12/13 | Step 2完了：サーバー証明書自動生成 + キャッシュ実装 | 新規 `crates/flm-proxy/src/certificate.rs`、再起動テストログを `reports/` へ追加 |
| 12/16〜12/20 | Step 3-4：`packaged-ca` モード統合と OS 信頼ストア登録（Windows/macOS優先） | Proxy/E2Eテストを `reports/FULL_TEST_EXECUTION_REPORT.md` に追記、UI Wizard（`UI_MINIMAL`）へ TLS ステータス提供 |
| 01/06〜01/17 | Step 5-7：インストーラー PoC、コード署名、ハッシュ公開 | `.github/workflows/build.yml` 改訂、`docs/specs/UI_MINIMAL.md#phase-2-残タスク--スケジュール` と連動して外部公開ウィザードのメッセージ更新 |

> このスケジュールは UI 側 Phase 2 残タスクのマイルストーン（`UI_MINIMAL.md`）と同期済み。UI で TLS/証明書状態を表示する直前の週に `packaged-ca` を安定化させることで、Setup Wizard の案内文と整合させる。

## 既知の問題

- **rcgen APIの不一致**: `rcgen` 0.13では`Certificate::from_params()`が存在しない
  - 解決策: `rcgen`のドキュメントを確認し、正しいAPI（`Certificate::generate()`など）を使用
  - 影響: ルートCA証明書生成とサーバー証明書生成の実装が保留

## 関連ドキュメント

- `docs/specs/PROXY_SPEC.md` セクション10 - 証明書管理（packaged-ca モード）
- `docs/guides/SECURITY_FIREWALL_GUIDE.md` - セキュリティガイド
- `docs/planning/HACKER_NEWS_PREP.md` - Hacker News投稿準備ガイド

## 注意事項

- 秘密鍵 (`flm-ca.key`) は絶対にリポジトリにコミットしない
- ビルド環境でのみ使用し、本番環境には展開しない
- 漏洩時は即座に再生成し、新しいルートCA証明書を配布

