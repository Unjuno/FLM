# Documentation Update Policy

> Status: Canonical | Audience: All contributors | Updated: 2025-11-25

このドキュメントは、FLMプロジェクトのドキュメント更新ルールとガイドラインを定義します。

## 1. ドキュメントの分類と更新ルール

### 1.1 Canonical（正式版）

**定義**: 実装完了済みで、正式に使用可能なドキュメント。

**更新ルール**:
- 実装変更時は必ず対応するドキュメントを更新
- 破壊的変更（Core API v1.0.0など）はADR経由でのみ許可
- 更新後は`Updated:`フィールドを更新日付に変更

**例**: `docs/specs/CORE_API.md`, `docs/specs/PROXY_SPEC.md`

### 1.2 Draft（草案）

**定義**: 実装進行中または未実装のドキュメント。

**更新ルール**:
- 実装進捗に応じて随時更新
- 実装完了時にCanonicalに変更
- 未実装機能の仕様変更は自由に更新可能

**例**: `docs/guides/MIGRATION_GUIDE.md`, `docs/guides/TEST_STRATEGY.md`

### 1.3 Reference（参照用）

**定義**: 参照情報やガイドラインを提供するドキュメント。

**更新ルール**:
- プロジェクト方針の変更時に更新
- 定期的な見直しを推奨（四半期ごと）

**例**: `docs/guides/GLOSSARY.md`, `docs/DOCUMENTATION_STRUCTURE.md`

## 2. 更新が必要なタイミング

### 2.1 実装変更時

以下の変更時は必ず対応するドキュメントを更新：

- **API変更**: `docs/specs/CORE_API.md`のChangelogセクションに追記
- **CLIコマンド追加/変更**: `docs/specs/CLI_SPEC.md`を更新
- **Proxy機能追加**: `docs/specs/PROXY_SPEC.md`を更新
- **データベーススキーマ変更**: `docs/specs/DB_SCHEMA.md`を更新

### 2.2 新機能実装時

- 仕様書に新機能の説明を追加
- 関連するガイドドキュメントを更新
- 必要に応じて用語集（`docs/guides/GLOSSARY.md`）に用語を追加

### 2.3 バグ修正時

- 修正内容が仕様に影響する場合は仕様書を更新
- トラブルシューティング情報をガイドに追加

### 2.4 プロジェクト方針変更時

- 計画ドキュメント（`docs/planning/PLAN.md`）を更新
- 影響を受ける仕様書やガイドを更新

## 3. 更新手順

### 3.1 仕様書の更新

1. **変更内容の確認**
   - 実装コードと仕様書の差分を確認
   - 影響範囲を特定

2. **仕様書の更新**
   - 該当セクションを更新
   - `Updated:`フィールドを更新日付に変更
   - Changelogセクションに変更履歴を追記（該当する場合）

3. **関連ドキュメントの確認**
   - 他の仕様書やガイドへの影響を確認
   - 必要に応じて関連ドキュメントも更新

### 3.2 ガイドの更新

1. **実装完了の確認**
   - 実装が完了していることを確認
   - テストが通過していることを確認

2. **ガイドの更新**
   - Draft状態のガイドをCanonicalに変更
   - 実装手順やベストプラクティスを追記
   - トラブルシューティング情報を追加

### 3.3 進捗レポートの更新

1. **タスク完了時**
   - `docs/status/active/`から`docs/status/completed/`へ移動
   - 完了日付と成果物を記録

2. **新規タスク開始時**
   - `docs/status/active/`に新規レポートを作成
   - `docs/status/active/NEXT_STEPS.md`を更新

## 4. ドキュメントの品質基準

### 4.1 必須項目

すべてのドキュメントには以下を含める：

- **Status**: Canonical / Draft / Reference
- **Audience**: 対象読者（例: All contributors, Rust core engineers）
- **Updated**: 最終更新日（YYYY-MM-DD形式）

### 4.2 推奨項目

- **関連ドキュメント**: 関連する他のドキュメントへのリンク
- **Changelog**: 変更履歴（仕様書の場合）
- **例**: コード例や使用例

### 4.3 スタイルガイド

- **明確性**: 技術的な正確性を保ちつつ、わかりやすく記述
- **一貫性**: 用語の使用を統一（`docs/guides/GLOSSARY.md`を参照）
- **完全性**: 必要な情報をすべて含める

## 5. レビュープロセス

### 5.1 仕様書の変更

- **破壊的変更**: ADR（Architecture Decision Record）の提出が必要
- **非破壊的変更**: PRレビューで確認

### 5.2 ガイドの更新

- 実装完了後にガイドを更新
- 実装者またはQA担当者がレビュー

### 5.3 進捗レポートの更新

- タスク完了時に自動的に更新
- プロジェクトリーダーが最終確認

## 6. ドキュメントの保守

### 6.1 定期的な見直し

- **四半期ごと**: Referenceドキュメントの見直し
- **リリースごと**: すべてのドキュメントの整合性確認

### 6.2 古いドキュメントの処理

- 実装が完了し、ドキュメントが不要になった場合は`archive/`に移動
- 参照が必要な場合は`archive/`へのリンクを残す

### 6.3 ドキュメントの整理

- 重複する内容は統合
- 関連するドキュメントは相互にリンク
- ディレクトリ構造は`docs/DOCUMENTATION_STRUCTURE.md`に従う

## 7. ツールと自動化

### 7.1 バージョン管理

- `scripts/align_versions.rs`: Core APIバージョンとクレートバージョンの整合性確認
- `scripts/tag_core_api.sh`: Core APIバージョンタグの作成

### 7.2 リンクチェック

- ドキュメント間のリンクが正しいことを確認
- 壊れたリンクは即座に修正

### 7.3 用語の統一

- `docs/guides/GLOSSARY.md`を参照して用語を統一
- 新規用語は用語集に追加

## 8. 例外処理

### 8.1 緊急修正時

- セキュリティ修正など緊急時は、ドキュメント更新を後回しにしても可
- ただし、修正後1週間以内にドキュメントを更新

### 8.2 実験的機能

- 実験的機能のドキュメントはDraft状態で作成
- 正式リリース時にCanonicalに変更

---

**関連ドキュメント**:
- `docs/DOCUMENTATION_STRUCTURE.md` - ドキュメント構成ガイド
- `docs/guides/GLOSSARY.md` - 用語集
- `docs/templates/ADR_TEMPLATE.md` - Architecture Decision Recordテンプレート
- `docs/guides/VERSIONING_POLICY.md` - バージョニングポリシー

