# ドキュメント構成ガイド

> Status: Reference | Audience: All contributors | Updated: 2025-01-27

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
│   │   └── ...
│   └── completed/              # 完了済みのレポート
│       ├── phases/              # フェーズ完了レポート
│       ├── tasks/               # タスク完了レポート
│       ├── tests/               # テストレポート
│       ├── safety/              # 安全性・監査レポート
│       ├── proxy/               # ProxyServiceレポート
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

**主要ドキュメント**:
- `active/NEXT_STEPS.md` - 次の作業ステップ（推奨: 最新の進捗確認）
- `active/BOTNET_PROTECTION_PLAN.md` - ボットネット対策実装計画の進捗
- `completed/tasks/FINAL_SUMMARY.md` - 最終サマリー（推奨: 全体の完了状況確認）
- `completed/phases/` - フェーズ完了レポート
- `completed/tasks/` - タスク完了レポート
- `completed/tests/` - テストレポート
- `completed/safety/` - 安全性・監査レポート

**特徴**:
- 現在の進捗状況（`active/`）
- 完了したタスクの記録（`completed/`）
- 次のステップの明確化
- レポートの分類（フェーズ/タスク/テスト/安全性/プロキシ/修正）

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

---

**最終更新**: 2025-01-27  
**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

