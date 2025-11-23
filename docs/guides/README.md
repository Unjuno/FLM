# Guides

> Status: Reference | Audience: All contributors | Updated: 2025-01-27

このディレクトリには、実装・運用に関するガイドとマニュアルが含まれています。

## ディレクトリ構成

```
docs/guides/
├── README.md (本ファイル)
├── SECURITY_BOTNET_PROTECTION.md    # ボットネット対策ガイド（ユーザー向け）
├── SECURITY_FIREWALL_GUIDE.md        # ファイアウォール設定ガイド
├── MIGRATION_GUIDE.md                # 移行ガイド
├── TEST_STRATEGY.md                  # テスト戦略
└── VERSIONING_POLICY.md              # バージョニングポリシー
```

## ガイド一覧

### SECURITY_BOTNET_PROTECTION.md - ボットネット対策ガイド

**Status**: Canonical | **Audience**: All users | **Updated**: 2025-01-27

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

**Status**: Canonical | **Audience**: UI backend / Ops | **Updated**: 2025-11-20

ファイアウォール設定の自動化ガイド。Windows/macOS/Linux対応。

- ファイアウォール設定の自動化
- Setup Wizardでの統合
- 手動設定手順
- セキュリティ検証手順

**関連ドキュメント**:
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/UI_MINIMAL.md` - UI最小仕様

### MIGRATION_GUIDE.md - 移行ガイド

**Status**: Draft | **Audience**: CLI / Ops engineers | **Updated**: 2025-11-20

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

**Status**: Draft | **Audience**: QA / Release engineers | **Updated**: 2025-11-20

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

**Status**: Canonical | **Audience**: Release/Platform engineers | **Updated**: 2025-11-20

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

### 運用者向けガイド

- `VERSIONING_POLICY.md` - リリース管理

## 関連リソース

- **仕様書**: `docs/specs/` - 各コンポーネントの詳細仕様
- **計画**: `docs/planning/PLAN.md` - プロジェクト計画
- **監査**: `docs/audit/` - 監査レポート
- **進捗**: `docs/status/` - 進捗状況

---

**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

