# Guides

> Status: Reference | Audience: All contributors | Updated: 2025-11-25

このディレクトリには、実装・運用に関するガイドとマニュアルが含まれています。

## ディレクトリ構成

```
docs/guides/
├── README.md (本ファイル)
├── GLOSSARY.md                        # 用語集
├── DOCUMENTATION_UPDATE_POLICY.md     # 文書更新ポリシー
├── SECURITY_BOTNET_PROTECTION.md    # ボットネット対策ガイド（ユーザー向け）
├── SECURITY_FIREWALL_GUIDE.md        # ファイアウォール設定ガイド
├── MIGRATION_GUIDE.md                # 移行ガイド
├── TEST_STRATEGY.md                  # テスト戦略
├── VERSIONING_POLICY.md              # バージョニングポリシー
└── ENGINE_CACHE_FAQ.md               # エンジン検出キャッシュFAQ
```

## ガイド一覧

### GLOSSARY.md - 用語集

**Status**: Reference | **Audience**: All contributors | **Updated**: 2025-11-25

FLMプロジェクトで使用される主要な用語の定義。アルファベット順に整理されている。

- コアAPI用語（Engine、Proxy、Securityなど）
- ドメインモデル用語
- サービス層用語
- エラータイプ用語

**関連ドキュメント**:
- `docs/specs/CORE_API.md` - コアAPI仕様（用語の詳細定義）
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/CLI_SPEC.md` - CLI仕様

### DOCUMENTATION_UPDATE_POLICY.md - 文書更新ポリシー

**Status**: Canonical | **Audience**: All contributors | **Updated**: 2025-11-25

ドキュメント更新ルールとガイドライン。ドキュメントの分類、更新手順、品質基準を定義する。

- ドキュメントの分類（Canonical/Draft/Reference）
- 更新が必要なタイミング
- 更新手順とレビュープロセス
- ドキュメントの品質基準
- 定期的な見直しと保守

**関連ドキュメント**:
- `docs/README.md` - ドキュメント構成ガイド（統合済み）
- `docs/guides/GLOSSARY.md` - 用語集
- `docs/templates/ADR_TEMPLATE.md` - Architecture Decision Recordテンプレート

### SECURITY_BOTNET_PROTECTION.md - ボットネット対策ガイド

**Status**: Canonical | **Audience**: All users | **Updated**: 2025-11-25

外部公開時のボットネット対策機能の使い方。ユーザー向けの実用的なガイド。

- 自動有効化の説明
- 各機能の使い方
- 設定方法
- トラブルシューティング
- ベストプラクティス

**関連ドキュメント**:
- `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` - 実装計画（開発者向け）
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様

### SECURITY_FIREWALL_GUIDE.md - ファイアウォール設定ガイド

**Status**: Canonical | **Audience**: UI backend / Ops | **Updated**: 2025-11-25

ファイアウォール設定の自動化ガイド。Windows/macOS/Linux対応。

- ファイアウォール設定の自動化
- Setup Wizardでの統合
- 手動設定手順
- セキュリティ検証手順

**関連ドキュメント**:
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/UI_MINIMAL.md` - UI最小仕様

### MIGRATION_GUIDE.md - 移行ガイド

**Status**: Draft | **Audience**: CLI / Ops engineers | **Updated**: 2025-11-25

旧プロトタイプ（`archive/prototype/`）からの移行手順。

- データ移行手順
- 設定の変換方法
- ロールバック手順
- 検証方法

**注意**: このガイドはDraft状態です。実装完了後に更新予定。

**関連ドキュメント**:
- `docs/specs/DB_SCHEMA.md` - データベーススキーマ
- `docs/planning/PLAN.md` - プロジェクト計画（データ移行戦略）

### TEST_STRATEGY.md - テスト戦略

**Status**: Draft | **Audience**: QA / Release engineers | **Updated**: 2025-11-25

プロジェクト全体のテスト戦略。単体テスト、統合テスト、E2Eテストの方針。

- テストの種類と範囲
- CI/CDでの自動テスト
- 手動テスト手順
- カバレッジ目標

**注意**: このガイドはDraft状態です。実装進捗に応じて更新予定。

**関連ドキュメント**:
- `docs/planning/PLAN.md` - プロジェクト計画（メトリクス）
- `docs/tests/ui-scenarios.md` - UIシナリオテスト

### VERSIONING_POLICY.md - バージョニングポリシー

**Status**: Canonical | **Audience**: Release/Platform engineers | **Updated**: 2025-11-25

バージョン管理ポリシー。Core/API/CLI/Proxyのバージョン管理方針。

- バージョン番号の付け方
- セマンティックバージョニング
- 互換性の定義
- リリースプロセス

**関連ドキュメント**:
- `docs/specs/CORE_API.md` - コアAPI仕様（v1.0.0凍結）
- `docs/planning/PLAN.md` - プロジェクト計画

## ガイドの状態（Status）

各ガイドには以下のStatusが設定されています：

- **Canonical**: 正式版、実装完了済み
- **Draft**: 草案、実装進行中または未実装

## ガイドの更新ルール

1. **実装完了後**: 実装が完了したらDraftからCanonicalに更新
2. **機能追加時**: 新機能追加時に該当ガイドを更新
3. **問題発見時**: トラブルシューティング情報を随時追加

## ガイドの分類

### ユーザー向けガイド

- `SECURITY_BOTNET_PROTECTION.md` - ボットネット対策の使い方

### 開発者向けガイド

- `SECURITY_FIREWALL_GUIDE.md` - ファイアウォール設定の実装
- `MIGRATION_GUIDE.md` - データ移行の実装
- `TEST_STRATEGY.md` - テストの実装
- `ENGINE_CACHE_FAQ.md` - エンジン検出キャッシュの挙動とトラブルシュート

### 運用者向けガイド

- `VERSIONING_POLICY.md` - リリース管理

## CLI検証フロー（FORMAT → LINT → TYPECHECK → TEST）

CLI の変更は必ず以下の順でツールを実行してください（`cargo` はワークスペースルートで実行）。

1. **FORMAT_CMD**: `cargo fmt --all -- --check` （修正する場合は `cargo fmt --all`）
2. **LINT_CMD**: `cargo clippy --all-targets --all-features -- -D warnings`
3. **TYPECHECK_CMD**: `cargo check --workspace --all-targets`
4. **TEST_CMD**: `cargo test --workspace --all-targets`（CLIのみ検証したい場合は `cargo test -p flm-cli --all-targets`）

プロキシやUIと連携する CLI 機能を追加した場合は、上記に加えて `cargo test -p flm-cli --test cli_test` を実行してエンドツーエンドの CLI 実行結果を確認すること。

## 関連リソース

- **仕様書**: `docs/specs/` - 各コンポーネントの詳細仕様
- **計画**: `docs/planning/PLAN.md` - プロジェクト計画
- **監査**: `docs/audit/` - 監査レポート
- **進捗**: `docs/status/` - 進捗状況

---

**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

