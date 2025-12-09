# リリース前チェックリスト — 2025-02-01

> Status: Ready for Release | Updated: 2025-02-01 | Audience: Release managers

## 概要

すべての実装作業が完了し、リリース準備が整いました。このドキュメントは、リリース前に実施すべき実環境テストと確認項目をまとめたものです。

## 実装完了状況

- ✅ **Phase 0-2**: 100%完了
- ✅ **Phase 1C**: 完了（統合テスト実装完了 2025-02-01）
- ✅ **Phase 3**: 完了（コード署名、セキュリティ対策、アンインストーラ統合）
- ✅ **テスト**: Rust 100% / TypeScript 改善済み
- ✅ **ドキュメント**: 整備完了

**実装完了度**: 約98-99%

## リリース前チェックリスト

### 1. 実ビルドテスト（実署名鍵を使用）

#### 1.1 CIワークフローでのテスト
- [ ] **Windowsビルドと署名検証**
  - [ ] MSIインストーラーのビルド
  - [ ] NSISインストーラーのビルド
  - [ ] 署名検証ステップの動作確認（`signtool verify /pa`）
  - [ ] 署名検証結果がビルドログに記録されることを確認

- [ ] **macOSビルドと署名検証**
  - [ ] DMGインストーラーのビルド
  - [ ] Appバンドルのビルド
  - [ ] 署名検証ステップの動作確認（`spctl --assess`, `codesign --verify`）
  - [ ] 署名検証結果がビルドログに記録されることを確認
  - [ ] Notarization（Phase 3.5、将来実装予定）

- [ ] **Linuxビルドと署名検証**
  - [ ] DEBパッケージのビルド
  - [ ] AppImageのビルド
  - [ ] GPG署名の生成
  - [ ] GPG署名検証ステップの動作確認（`gpg --verify`）
  - [ ] 署名検証結果がビルドログに記録されることを確認

#### 1.2 ローカル環境でのテスト
- [ ] **Windows環境**
  - [ ] 実署名鍵を使用したビルド
  - [ ] 署名検証の動作確認
  - [ ] インストーラーの動作確認

- [ ] **macOS環境**
  - [ ] 実署名鍵を使用したビルド
  - [ ] 署名検証の動作確認
  - [ ] インストーラーの動作確認

- [ ] **Linux環境**
  - [ ] 実GPG鍵を使用したビルド
  - [ ] GPG署名検証の動作確認
  - [ ] パッケージの動作確認

#### 1.3 アンインストーラの動作確認
- [ ] **Windows NSISアンインストーラー**
  - [ ] アンインストール時の証明書削除スクリプトの実行確認
  - [ ] エラーハンドリングの動作確認
  - [ ] ログ出力の確認

- [ ] **Linux DEBパッケージ**
  - [ ] `postrm`スクリプトの実行確認
  - [ ] 証明書削除の動作確認
  - [ ] ログ出力の確認（`/var/log/flm-uninstall.log`）

- [ ] **macOS DMG**
  - [ ] 手動アンインストール手順の確認
  - [ ] 証明書削除手順の確認

### 2. Phase 1C統合テストの実環境テスト

#### 2.1 実Torデーモンとの統合テスト
- [ ] **Torデーモンのセットアップ**
  - [ ] Torデーモンのインストールと起動
  - [ ] SOCKS5エンドポイントの確認（デフォルト: `127.0.0.1:9050`）

- [ ] **Torモードの動作確認**
  - [ ] `--egress-mode tor`オプションでのプロキシ起動
  - [ ] Tor経由でのHTTPリクエストの動作確認
  - [ ] レスポンスの確認

- [ ] **fail_open/fail_closedの動作確認**
  - [ ] Torデーモン停止時の動作確認（`fail_closed`）
  - [ ] Torデーモン停止時のフォールバック動作確認（`fail_open`）

#### 2.2 実SOCKS5プロキシとの統合テスト
- [ ] **SOCKS5プロキシサーバーのセットアップ**
  - [ ] SOCKS5プロキシサーバーの起動
  - [ ] エンドポイントの確認

- [ ] **CustomSocks5モードの動作確認**
  - [ ] `--egress-mode custom-socks5 --socks5-endpoint <endpoint>`オプションでのプロキシ起動
  - [ ] SOCKS5経由でのHTTPリクエストの動作確認
  - [ ] レスポンスの確認

- [ ] **認証付きSOCKS5プロキシのテスト**（将来実装予定）
  - [ ] ユーザー名/パスワード認証の動作確認

### 3. リリースタグの作成

#### 3.1 リリースタグ作成前の確認
- [ ] すべての実ビルドテストが完了していること
- [ ] すべての実環境テストが完了していること
- [ ] ドキュメントが最新であること
- [ ] チェンジログが更新されていること

#### 3.2 リリースタグの作成
- [ ] **Gitタグの作成**
  - [ ] セマンティックバージョニングに従ったタグ名（例: `v1.0.0`）
  - [ ] タグメッセージの作成
  - [ ] タグのプッシュ

- [ ] **GitHubリリースの作成**
  - [ ] リリースノートの生成
  - [ ] アーティファクトのアップロード
  - [ ] チェックサムの公開
  - [ ] 署名検証手順の記載

## 実装済み項目（確認済み）

以下の項目は実装済みで、実ビルドテストのみが必要です：

- ✅ コード署名検証ステップ（`.github/workflows/build.yml`）
- ✅ ビルドログ記録機能（`reports/BUILD_LOG_YYYYMMDD.md`）
- ✅ リリースノート生成改善（署名検証手順の自動追加）
- ✅ アンインストーラー証明書削除統合（Windows NSIS、Linux DEB）
- ✅ Phase 1C統合テスト（モックSOCKS5サーバー、6つのテストケース）

## テスト実行コマンド

### Phase 1C統合テストの実行
```bash
# すべてのegressテストを実行
cargo test --package flm-proxy test_egress

# 個別のテストを実行
cargo test --package flm-proxy test_egress_direct_mode
cargo test --package flm-proxy test_egress_tor_mode_with_reachable_endpoint
cargo test --package flm-proxy test_egress_tor_mode_with_unreachable_endpoint_fail_closed
cargo test --package flm-proxy test_egress_tor_mode_with_unreachable_endpoint_fail_open
cargo test --package flm-proxy test_egress_custom_socks5_mode_with_reachable_endpoint
cargo test --package flm-proxy test_egress_custom_socks5_mode_without_endpoint
```

### コード品質チェック
```bash
# フォーマットチェック
cargo fmt --check --all

# Lintチェック
cargo clippy --workspace -- -D warnings

# 型チェック
cargo check --workspace

# テスト実行
cargo test --workspace
```

## 関連ドキュメント

- `docs/status/active/RELEASE_READINESS_20250201.md` - リリース準備状況レポート
- `docs/status/completed/tasks/FINAL_IMPLEMENTATION_SUMMARY_20250201.md` - 最終実装完了サマリー
- `docs/status/completed/tasks/IMPLEMENTATION_COMPLETE_20250201.md` - 実装完了サマリー
- `docs/status/completed/tests/PHASE1C_EGRESS_TESTS_COMPLETE_20250201.md` - Phase 1C統合テスト実装完了レポート
- `docs/planning/PHASE3_PACKAGING_PLAN.md` - Phase 3パッケージング計画
- `docs/specs/CODE_SIGNING_POLICY.md` - コード署名ポリシー
- `.github/workflows/build.yml` - ビルドワークフロー

---

**作成日**: 2025-02-01  
**最終更新**: 2025-02-01  
**ステータス**: Ready for Release Testing
