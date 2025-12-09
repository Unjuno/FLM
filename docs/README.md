# FLM Documentation

> Status: Reference | Audience: All contributors | Updated: 2025-02-01

FLMプロジェクトのドキュメント集約ディレクトリです。

## スコープ
- ルート `README.md` はリポジトリ全体の概要、ビルド手順、主要な実装ガイドラインを提供します。
- 本ファイルは `docs/` 配下の索引であり、計画・仕様・ガイド・進捗レポートを探すための入口です。
- テスト／監査の実行結果はリポジトリ直下の `reports/` に集約され、`docs/status/active/` から参照されます。
- 旧プロトタイプ関連情報は `archive/prototype/` に隔離されており、本ドキュメントでは参照専用として取り扱います。

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

プロジェクトの監査レポートが含まれています。詳細は `audit/README.md` を参照してください。

- **CORE_API_AUDIT.md** - Core API監査レポート（完了）
- **CORE_API_AUDIT_COMPLETE.md** - Core API監査完了サマリー（Phase 2-6サマリーを統合済み）
- **CORE_API_AUDIT_KYK.md** - Core API監査KYK（危険予知活動）
- **CLI_AUDIT.md** - CLI監査レポート（未実施）
- **SECURITY_AUDIT_PHASE1.md** - Phase 1セキュリティ監査（未実施）
- **COMPREHENSIVE_SECURITY_AUDIT.md** - 包括的セキュリティ監査（完了、再監査版・IP公開問題・厳格監査を統合済み）
- **SECURITY_FIXES_IMPLEMENTED.md** - セキュリティ修正実装（完了）

### `changelog/` - 変更履歴

- **CHANGELOG.md** - プロジェクトの変更履歴

### `guides/` - ガイド・マニュアル

実装や運用に関するガイドです。詳細は `guides/README.md` を参照してください。

- **SECURITY_BOTNET_PROTECTION.md** - ボットネット対策ガイド（ユーザー向け）
- **SECURITY_FIREWALL_GUIDE.md** - ファイアウォール設定ガイド
- **MIGRATION_GUIDE.md** - 移行ガイド（Draft）
- **TEST_STRATEGY.md** - テスト戦略（Draft）
- **VERSIONING_POLICY.md** - バージョニングポリシー

### `planning/` - プロジェクト計画

プロジェクトの計画と設計ドキュメントです。詳細は `planning/README.md` を参照してください。

- **PLAN.md** - メインプロジェクト計画（**必読**）
- **diagram.md** - アーキテクチャ図
- **BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md** - ボットネット対策実装計画（開発者向け）
- **HACKER_NEWS_PREP.md** - Hacker News投稿準備ガイド

### `specs/` - 仕様書

各コンポーネントの詳細仕様です。詳細は `specs/README.md` を参照してください。

- **CORE_API.md** - コアAPI仕様（v1.0.0で凍結）
- **CLI_SPEC.md** - CLIコマンド仕様
- **PROXY_SPEC.md** - プロキシ仕様
- **UI_MINIMAL.md** - UI最小仕様
- **UI_EXTENSIONS.md** - UI拡張仕様
- **ENGINE_DETECT.md** - エンジン検出仕様
- **DB_SCHEMA.md** - データベーススキーマ
- **FEATURE_SPEC.md** - 機能仕様
- **I18N_SPEC.md** - 国際化仕様
- **BRAND_GUIDELINE.md** - ブランドガイドライン

### `status/` - 進捗・完了レポート

プロジェクトの進捗状況と完了レポートです。詳細は `status/README.md` を参照してください。

- **active/** - 現在進行中のレポートのみを配置
  - `NEXT_STEPS.md` - 唯一の公式タスクリスト（進捗レポート・プロジェクト状況要約を統合済み）
  - `BOTNET_PROTECTION_PLAN.md` - ボットネット対策実装進捗
  - `UNIMPLEMENTED_REPORT.md` - 未実装領域の棚卸し（コード分析情報を含む）
  - `TEST_ENVIRONMENT_STATUS.md` - テスト環境の状態（セットアップ情報を含む）
- **completed/** - 完了済みのレポート
  - `phases/` - フェーズ完了レポート
  - `tasks/` - タスク完了レポート（`FINAL_SUMMARY.md`推奨、`DONE.md`は簡潔な作業ログ）
  - `tests/` - テストレポート
  - `safety/` - 安全性・監査レポート
  - `proxy/` - ProxyServiceレポート
  - `fixes/` - バグ修正レポート

`reports/` ディレクトリに格納された最新テスト／監査結果は `status/active` からリンクされ、完了後は該当する `completed/*` レポートで要約されます。

### `../reports/` - 実行レポート（リポジトリ直下）

- `*_TEST_REPORT*.md` - 実行サマリー。`FULL_TEST_EXECUTION_REPORT.md` が詳細版、`FULL_TEST_EXECUTION_SUMMARY.md` が要約版。
- `*-results*.txt` - テストハーネスの生ログ。必要に応じてリンクまたは添付。
- 新しいレポートを追加した場合は `docs/status/active/NEXT_STEPS.md` または関連レポートから参照を張り、完了後に `docs/status/completed/` に要約を残す。

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

- `archive/prototype/` は旧実装のアーカイブです。新機能の追加や修正は行わないでください（生成物は `prototype-generated-assets.zip` に圧縮済み）。
- 最新の仕様は `specs/` ディレクトリの定義に従います。
- 進捗状況は `status/active/` と `reports/` を併読して把握してください。

## ドキュメント整理（2025-11-27、2025-01-28更新）

以下の統合・削除を実施しました：

- **ルートレベル**: `DOCUMENTATION_STRUCTURE.md` を `README.md` に統合、`IMPLEMENTATION_STATUS.md` を削除
- **audit/**: Phase別サマリー（Phase 2-6）を `CORE_API_AUDIT_COMPLETE.md` に統合、セキュリティ監査レポート（再監査版・IP公開問題・厳格監査）を `COMPREHENSIVE_SECURITY_AUDIT.md` に統合
- **status/active/**: 進捗レポートを `NEXT_STEPS.md` に統合、テスト環境レポートを `TEST_ENVIRONMENT_STATUS.md` に統合、未実装レポートを `UNIMPLEMENTED_REPORT.md` に統合、実装ログを追加（Phase 3、テスト、I18N）
- **status/completed/**: 類似レポートを統合（safety/、proxy/、tests/）

## ドキュメントの分類と整理方針

### ドキュメントの分類

1. **Planning（計画）**: プロジェクトの計画と設計方針を定義
   - 対象読者: プロジェクトリーダー、アーキテクト、開発者
   - 特徴: 実装前の設計と計画、アーキテクチャの全体像、フェーズ定義と成功基準

2. **Specs（仕様書）**: 各コンポーネントの詳細仕様を定義
   - 対象読者: 開発者、実装者
   - 特徴: 実装の詳細仕様、API定義とデータ構造、バージョン管理（v1.0.0で凍結）

3. **Guides（ガイド）**: 実装・運用に関するガイドを提供
   - 対象読者: 開発者、ユーザー
   - 特徴: 実装手順とベストプラクティス、ユーザー向けの使い方、トラブルシューティング

4. **Audit（監査）**: コード品質とセキュリティの監査結果を記録
   - 対象読者: プロジェクトリーダー、セキュリティエンジニア
   - 特徴: Phase別の監査レポート、問題点と修正状況、品質メトリクス

5. **Status（進捗）**: プロジェクトの進捗状況と完了レポートを記録
   - 対象読者: プロジェクトリーダー、ステークホルダー
   - 特徴: 現在の進捗状況は `active/` 配下に集約、完了したタスクは `completed/` 配下へ移動

### ドキュメント間の関係性

```
planning/PLAN.md
  ↓
specs/CORE_API.md, CLI_SPEC.md, PROXY_SPEC.md
  ↓
実装（コード）
  ↓
audit/CORE_API_AUDIT.md, CLI_AUDIT.md
  ↓
status/completed/
```

### Active/Completed 運用ルール

- 作業が完了したら、該当ドキュメントを `active/` から対応する `completed/*` サブディレクトリへ物理移動し、ヘッダーの `Status` を更新する。
- `active/NEXT_STEPS.md` は「唯一の進行中タスクリスト」とし、他ファイルから重複情報を排除する。
- `completed/tasks/FINAL_SUMMARY.md` をタスク完了の正とし、旧 `ALL_TASKS_COMPLETE.md` は削除済み。
- 旧プロトタイプや参照専用資料には「Reference only / Frozen」と明記し、進行中にカウントしない。

### ドキュメントの更新ルール

1. **計画ドキュメント**（`planning/`）: プロジェクト方針変更時のみ更新
2. **仕様書**（`specs/`）: v1.0.0で凍結、変更はADR経由
3. **ガイド**（`guides/`）: 実装完了後、随時更新
4. **監査**（`audit/`）: Phase完了時に作成
5. **進捗**（`status/`）: タスク完了時に更新

---

**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

