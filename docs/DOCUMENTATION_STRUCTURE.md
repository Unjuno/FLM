# ドキュメント構成ガイド

> Status: Reference | Audience: All contributors | Updated: 2025-11-27

このドキュメントは、FLMプロジェクトのドキュメント構成と整理方針を説明します。

## ディレクトリ構造

```
docs/
├── README.md                    # ドキュメント集約ディレクトリの概要
├── DOCUMENTATION_STRUCTURE.md   # 本ファイル（構成ガイド）
│
├── planning/                    # プロジェクト計画と設計
│   ├── README.md               # planning/ディレクトリの説明
│   ├── PLAN.md                 # メインプロジェクト計画（必読）
│   ├── diagram.md              # アーキテクチャ図
│   ├── BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md  # ボットネット対策実装計画
│   └── HACKER_NEWS_PREP.md     # Hacker News投稿準備ガイド
│
├── specs/                       # 仕様書
│   ├── README.md               # specs/ディレクトリの説明
│   ├── CORE_API.md             # コアAPI仕様（v1.0.0で凍結）
│   ├── CLI_SPEC.md             # CLI仕様
│   ├── PROXY_SPEC.md           # プロキシ仕様
│   ├── UI_MINIMAL.md           # UI最小仕様
│   ├── UI_EXTENSIONS.md        # UI拡張仕様
│   ├── ENGINE_DETECT.md        # エンジン検出仕様
│   ├── DB_SCHEMA.md            # データベーススキーマ
│   ├── FEATURE_SPEC.md         # 機能仕様
│   ├── I18N_SPEC.md            # 国際化仕様
│   └── BRAND_GUIDELINE.md      # ブランドガイドライン
│
├── guides/                      # ガイド・マニュアル
│   ├── README.md                # guides/ディレクトリの説明
│   ├── GLOSSARY.md               # 用語集
│   ├── DOCUMENTATION_UPDATE_POLICY.md  # 文書更新ポリシー
│   ├── SECURITY_BOTNET_PROTECTION.md    # ボットネット対策ガイド（ユーザー向け）
│   ├── SECURITY_FIREWALL_GUIDE.md       # ファイアウォール設定ガイド
│   ├── MIGRATION_GUIDE.md                # 移行ガイド（Draft）
│   ├── TEST_STRATEGY.md                  # テスト戦略（Draft）
│   └── VERSIONING_POLICY.md              # バージョニングポリシー
│
├── audit/                       # 監査レポート
│   ├── README.md               # 監査計画と概要（更新済み）
│   ├── CORE_API_AUDIT.md       # Core API監査（完了）
│   ├── CORE_API_AUDIT_COMPLETE.md # Core API監査完了サマリー
│   ├── CLI_AUDIT.md            # CLI監査（未実施）
│   ├── SECURITY_AUDIT_PHASE1.md # Phase 1セキュリティ監査（未実施）
│   ├── COMPREHENSIVE_SECURITY_AUDIT.md # 包括的セキュリティ監査（完了）
│   └── templates/               # 監査テンプレート
│
├── status/                      # 進捗・完了レポート
│   ├── README.md               # ステータスレポートの説明（更新済み）
│   ├── active/                 # 現在進行中のレポート
│   │   ├── NEXT_STEPS.md       # 次の作業ステップ
│   │   ├── BOTNET_PROTECTION_PLAN.md # ボットネット対策実装計画の進捗
│   │   ├── UNIMPLEMENTED_REPORT.md   # 未実装事項の棚卸し
│   │   └── UNIMPLEMENTED_ANALYSIS.md # 未実装部分の分析
│   └── completed/              # 完了済みのレポート
│       ├── phases/              # フェーズ完了レポート
│       ├── tasks/               # タスク完了レポート（`FINAL_SUMMARY.md` が正、`DONE.md` は簡潔な作業ログ）
│       ├── tests/               # テストレポート
│       ├── safety/              # 安全性・監査レポート
│       ├── proxy/               # ProxyServiceレポート（Phase 1/2 完了サマリー）
│       └── fixes/               # バグ修正レポート
│
├── changelog/                   # 変更履歴
│   └── CHANGELOG.md
│
├── templates/                   # テンプレート
│   └── ADR_TEMPLATE.md         # Architecture Decision Record テンプレート
│
└── tests/                       # テスト関連ドキュメント
    └── ui-scenarios.md         # UIシナリオテスト
```

補足:
- ルート直下に `reports/` を設け、`*_TEST_REPORT*.md` や `*-results*.txt` を集約しています。README から最新版（例: `reports/FULL_TEST_EXECUTION_REPORT.md`）へリンクするルールです。
- 旧プロトタイプの生成物（`coverage/`, `dist/`, `public/`, `test-results.txt`）は `archive/prototype/prototype-generated-assets.zip` に圧縮済みで、参照が必要な場合のみ解凍してください。
- 自動化スクリプトは `archive/prototype/scripts/` に保管しており、新実装では Cargo/Make/just など既存ビルドツールを直接用います。
- `docs/status/active` には進行中のみ、`docs/status/completed` には完了済みのみを置き、混在が発生した場合は即時移動します。

## ドキュメントの分類

### 1. Planning（計画）

**目的**: プロジェクトの計画と設計方針を定義

**対象読者**: プロジェクトリーダー、アーキテクト、開発者

**主要ドキュメント**:
- `PLAN.md` - メインプロジェクト計画（必読）
- `diagram.md` - アーキテクチャ図
- `BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` - セキュリティ機能の実装計画
- `HACKER_NEWS_PREP.md` - 公開準備ガイド

**特徴**:
- 実装前の設計と計画
- アーキテクチャの全体像
- フェーズ定義と成功基準

### 2. Specs（仕様書）

**目的**: 各コンポーネントの詳細仕様を定義

**対象読者**: 開発者、実装者

**主要ドキュメント**:
- `CORE_API.md` - コアAPI仕様（v1.0.0で凍結）
- `CLI_SPEC.md` - CLIコマンド仕様
- `PROXY_SPEC.md` - プロキシ仕様
- `UI_MINIMAL.md` - UI最小仕様
- `ENGINE_DETECT.md` - エンジン検出仕様
- `DB_SCHEMA.md` - データベーススキーマ

**特徴**:
- 実装の詳細仕様
- API定義とデータ構造
- バージョン管理（v1.0.0で凍結）
- 各仕様書に「関連ドキュメント」セクションを追加済み

### 3. Guides（ガイド）

**目的**: 実装・運用に関するガイドを提供

**対象読者**: 開発者、ユーザー

**主要ドキュメント**:
- `SECURITY_BOTNET_PROTECTION.md` - ボットネット対策ガイド（ユーザー向け）
- `SECURITY_FIREWALL_GUIDE.md` - ファイアウォール設定ガイド
- `MIGRATION_GUIDE.md` - 移行ガイド（Draft）
- `TEST_STRATEGY.md` - テスト戦略（Draft）
- `VERSIONING_POLICY.md` - バージョニングポリシー

**特徴**:
- 実装手順とベストプラクティス
- ユーザー向けの使い方
- トラブルシューティング
- Draft状態のガイドは実装完了後に更新予定

### 4. Audit（監査）

**目的**: コード品質とセキュリティの監査結果を記録

**対象読者**: プロジェクトリーダー、セキュリティエンジニア

**主要ドキュメント**:
- `CORE_API_AUDIT.md` - Core API監査（完了）
- `CORE_API_AUDIT_COMPLETE.md` - Core API監査完了サマリー
- `CLI_AUDIT.md` - CLI監査（未実施）
- `SECURITY_AUDIT_PHASE1.md` - Phase 1セキュリティ監査（未実施）
- `COMPREHENSIVE_SECURITY_AUDIT.md` - 包括的セキュリティ監査（完了）
- `SECURITY_FIXES_IMPLEMENTED.md` - セキュリティ修正実装（完了）

**特徴**:
- Phase別の監査レポート
- 問題点と修正状況
- 品質メトリクス
- 監査レポートを分類（完了/未実施/問題発見済み）

### 5. Status（進捗）

**目的**: プロジェクトの進捗状況と完了レポートを記録

**対象読者**: プロジェクトリーダー、ステークホルダー

- **主要ドキュメント**:
  - `active/NEXT_STEPS.md` - 次の作業ステップ（推奨: 最新の進捗確認）
  - `active/BOTNET_PROTECTION_PLAN.md` - ボットネット対策実装計画の進捗
  - `active/UNIMPLEMENTED_REPORT.md` / `active/UNIMPLEMENTED_ANALYSIS.md` - 未実装領域の棚卸し
  - `completed/tasks/FINAL_SUMMARY.md` - 最終サマリー（推奨: 全体の完了状況確認）
  - `completed/proxy/PROXY_SERVICE_PHASE2_COMPLETE.md` - ProxyService Phase 2完了レポート
  - `completed/phases/` - フェーズ完了レポート
  - `completed/tasks/` - タスク完了レポート
  - `completed/tests/` - テストレポート
  - `completed/safety/` - 安全性・監査レポート

**特徴**:
- 現在の進捗状況は `active/` 配下に集約し、ステータスラベルも `Status: Active` に統一
- 完了したタスクは `completed/` 配下へ移動し、`Status: Completed` に更新
- `reports/README.md` を経由して `reports/` 配下の最新ログと紐付ける
- レポートはフェーズ/タスク/テスト/安全性/プロキシ/修正などの粒度でサブディレクトリに整理

#### Active/Completed 運用ルール
- 作業が完了したら、該当ドキュメントを `active/` から対応する `completed/*` サブディレクトリへ物理移動し、ヘッダーの `Status` を更新する。
- `active/NEXT_STEPS.md` は「唯一の進行中タスクリスト」とし、他ファイルから重複情報を排除する。
- `completed/tasks/FINAL_SUMMARY.md` をタスク完了の正とし、旧 `ALL_TASKS_COMPLETE.md` は削除済み。
- 旧プロトタイプや参照専用資料には「Reference only / Frozen」と明記し、進行中にカウントしない。

## ドキュメント間の関係性

### 計画 → 仕様 → 実装 → 監査 → 完了

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

### セキュリティ関連ドキュメントの関係

```
planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md (実装計画)
  ↓
specs/PROXY_SPEC.md (仕様)
  ↓
実装（コード）
  ↓
guides/SECURITY_BOTNET_PROTECTION.md (ユーザーガイド)
```

## ドキュメントの状態（Status）

各ドキュメントには以下のStatusが設定されています：

- **Canonical**: 正式版、変更は慎重に
- **Reference**: 参照用、随時更新可能
- **Planning**: 計画段階、実装前
- **Active**: 進行中
- **Completed**: 完了済み

## 整理方針

### 1. 重複の回避

- **実装計画**（`planning/`）と**ユーザーガイド**（`guides/`）は明確に分離
  - `planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` → 開発者向け実装仕様
  - `guides/SECURITY_BOTNET_PROTECTION.md` → ユーザー向け使い方

### 2. 参照関係の明確化

- 各ドキュメントに「関連ドキュメント」セクションを追加 ✅ 完了
- 相互参照を適切に設定 ✅ 完了

### 3. メタデータの統一

- Status, Audience, Updated を各ドキュメントに明記 ✅ 完了
- 更新日を適切に管理 ✅ 完了（CORE_API.mdの日付を修正）

### 4. ディレクトリ構造の最適化

- 目的別にディレクトリを分割 ✅ 完了
- 各ディレクトリにREADME.mdを配置 ✅ 完了
  - `planning/README.md` ✅
  - `specs/README.md` ✅
  - `guides/README.md` ✅
  - `audit/README.md` ✅（更新済み）

## ドキュメントの更新ルール

1. **計画ドキュメント**（`planning/`）: プロジェクト方針変更時のみ更新
2. **仕様書**（`specs/`）: v1.0.0で凍結、変更はADR経由
3. **ガイド**（`guides/`）: 実装完了後、随時更新
4. **監査**（`audit/`）: Phase完了時に作成
5. **進捗**（`status/`）: タスク完了時に更新

## クイックリファレンス

### 新規参加者向け

1. `README.md` - プロジェクト概要
2. `planning/PLAN.md` - 全体計画
3. `planning/diagram.md` - アーキテクチャ図
4. `status/active/NEXT_STEPS.md` - 次の作業

### 開発者向け

1. `specs/CORE_API.md` - コアAPI仕様
2. `specs/CLI_SPEC.md` - CLI仕様
3. `specs/PROXY_SPEC.md` - プロキシ仕様
4. `guides/TEST_STRATEGY.md` - テスト戦略

### セキュリティ実装者向け

1. `planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` - 実装計画
2. `specs/PROXY_SPEC.md` - プロキシ仕様
3. `specs/CORE_API.md` - コアAPI仕様
4. `guides/SECURITY_FIREWALL_GUIDE.md` - ファイアウォール設定

### ユーザー向け

1. `guides/SECURITY_BOTNET_PROTECTION.md` - ボットネット対策ガイド
2. `guides/SECURITY_FIREWALL_GUIDE.md` - ファイアウォール設定
3. `guides/MIGRATION_GUIDE.md` - 移行ガイド
4. `reports/` 配下の最新テスト要約（公開可否を判断する際の根拠）

---

**最終更新**: 2025-11-27  
**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

## ドキュメント統合（2025-11-27）

ルート直下にあった以下のドキュメントを`docs/`配下に統合しました：
- `PROGRESS_CHECK_ISSUES.md` → `docs/status/active/UNIMPLEMENTED_REPORT.md`に統合（証明書・レート制限表示機能の実装状況を確認・記録）
- `DONE.md` → `docs/status/completed/tasks/DONE.md`に移動（簡潔な作業ログとして保持）
- `TASK.md` → 削除（内容が少なく、`DONE.md`に記録済み）
- `PLAN.md` → 削除（`docs/planning/PLAN.md`が存在するため）

