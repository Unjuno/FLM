# FLM Documentation

> Status: Reference | Audience: All contributors | Updated: 2025-11-23

FLMプロジェクトのドキュメント集約ディレクトリです。

## ディレクトリ構造

```
docs/
├── README.md (本ファイル)
├── audit/          # 監査レポート
├── changelog/      # 変更履歴
├── guides/         # ガイド・マニュアル
├── planning/       # プロジェクト計画
├── specs/          # 仕様書
├── status/         # 進捗・完了レポート
├── templates/      # テンプレート
└── tests/          # テスト関連ドキュメント
```

## クイックスタート

### 新規参加者向け

1. **プロジェクト概要**: ルートの `README.md` を確認
2. **プロジェクト計画**: `planning/PLAN.md` で全体像を把握
3. **次のステップ**: `status/active/NEXT_STEPS.md` で現在の作業を確認

### 開発者向け

1. **仕様書**: `specs/` ディレクトリで各コンポーネントの仕様を確認
   - `CORE_API.md` - コアAPI仕様
   - `CLI_SPEC.md` - CLI仕様
   - `PROXY_SPEC.md` - プロキシ仕様
   - `UI_MINIMAL.md` - UI最小仕様
   - `ENGINE_DETECT.md` - エンジン検出仕様
2. **ガイド**: `guides/` で実装ガイドを参照
   - `SECURITY_FIREWALL_GUIDE.md` - セキュリティ・ファイアウォールガイド
   - `MIGRATION_GUIDE.md` - 移行ガイド
   - `TEST_STRATEGY.md` - テスト戦略
   - `VERSIONING_POLICY.md` - バージョニングポリシー

### プロジェクトリーダー向け

1. **進捗確認**: `status/` で最新の進捗を確認
2. **監査レポート**: `audit/` で監査結果を確認
3. **計画**: `planning/` で長期計画を確認

## ディレクトリ詳細

### `audit/` - 監査レポート

プロジェクトの監査レポートが含まれています。

- **CORE_API_AUDIT.md** - Core API監査レポート
- **CLI_AUDIT.md** - CLI監査レポート
- **SECURITY_AUDIT_PHASE1.md** - Phase 1セキュリティ監査
- **README.md** - 監査計画と概要

詳細は `audit/README.md` を参照してください。

### `changelog/` - 変更履歴

- **CHANGELOG.md** - プロジェクトの変更履歴

### `guides/` - ガイド・マニュアル

実装や運用に関するガイドです。

- **SECURITY_FIREWALL_GUIDE.md** - セキュリティ・ファイアウォール設定ガイド
- **MIGRATION_GUIDE.md** - 移行ガイド
- **TEST_STRATEGY.md** - テスト戦略
- **VERSIONING_POLICY.md** - バージョニングポリシー

### `planning/` - プロジェクト計画

プロジェクトの計画と設計ドキュメントです。

- **PLAN.md** - メインプロジェクト計画（**必読**）
- **diagram.md** - アーキテクチャ図
- **HACKER_NEWS_PREP.md** - Hacker News投稿準備ガイド

### `specs/` - 仕様書

各コンポーネントの詳細仕様です。

- **CORE_API.md** - コアAPI仕様
- **CLI_SPEC.md** - CLI仕様
- **PROXY_SPEC.md** - プロキシ仕様
- **UI_MINIMAL.md** - UI最小仕様
- **UI_EXTENSIONS.md** - UI拡張仕様
- **ENGINE_DETECT.md** - エンジン検出仕様
- **DB_SCHEMA.md** - データベーススキーマ
- **FEATURE_SPEC.md** - 機能仕様
- **I18N_SPEC.md** - 国際化仕様
- **BRAND_GUIDELINE.md** - ブランドガイドライン

### `status/` - 進捗・完了レポート

プロジェクトの進捗状況と完了レポートです。

- **active/** - 現在進行中または参照中のレポート
- **completed/** - 完了済みのレポート
- **README.md** - ステータスレポートの詳細説明

詳細は `status/README.md` を参照してください。

### `templates/` - テンプレート

ドキュメント作成用のテンプレートです。

- **ADR_TEMPLATE.md** - Architecture Decision Record (ADR) テンプレート

### `tests/` - テスト関連ドキュメント

テストに関するドキュメントです。

- **ui-scenarios.md** - UIシナリオテスト

## ドキュメントの状態

各ドキュメントには以下のメタデータが含まれています：

- **Status**: ドキュメントの状態（Canonical, Reference, Active, Completed など）
- **Audience**: 対象読者（All contributors, Project stakeholders, Developers など）
- **Updated**: 最終更新日

## ドキュメントの更新

ドキュメントを更新する際は：

1. メタデータ（Status, Audience, Updated）を更新
2. 変更内容を明確に記録
3. 関連ドキュメントへのリンクを確認・更新

## 関連リソース

- **ルートREADME**: `../README.md` - プロジェクト概要
- **アーカイブ**: `../archive/prototype/` - 旧プロトタイプ（参照専用）

## 注意事項

- `archive/prototype/` は旧実装のアーカイブです。新機能の追加や修正は行わないでください。
- 最新の仕様は `specs/` ディレクトリを参照してください。
- 進捗状況は `status/active/` を確認してください。

---

**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

