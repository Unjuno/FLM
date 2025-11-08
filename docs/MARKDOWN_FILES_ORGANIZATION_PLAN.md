# Markdownファイル整理計画

**作成日**: 2025-11-09  
**目的**: プロジェクト内のMarkdownファイルを体系的に整理

---

## 📊 現状分析

### ファイル数の概算
- ルートディレクトリ: 約30個の監査レポートファイル
- `docs/`: 約100個以上のMarkdownファイル
- `docs/reports/`: 約70個のレポートファイル
- `DOCKS/`: 約20個の仕様書・設計書

### 主な問題点

1. **重複ファイルが多い**
   - 同じ監査レポートの複数バージョン（V2, V3, FINAL, LATEST, ULTIMATEなど）
   - 同じ内容のファイルが異なる名前で存在

2. **ディレクトリ構造が不明確**
   - ルートディレクトリに監査レポートが散在
   - `docs/`内にも多数の監査レポートが存在

3. **命名規則が統一されていない**
   - `AUDIT_REPORT_*`, `*_AUDIT_REPORT`, `*_AUDIT_*`など様々な形式

---

## 🎯 整理方針

### 1. ディレクトリ構造の整理

```
FLM/
├── README.md                    # プロジェクトメインREADME
├── CHANGELOG.md                 # 変更履歴
├── CONTRIBUTING.md              # コントリビューションガイド
├── SECURITY_POLICY.md           # セキュリティポリシー
├── LICENSE                      # ライセンス
│
├── DOCKS/                       # 仕様書・設計書
│   ├── SPECIFICATION.md         # 機能仕様書（メイン）
│   ├── ARCHITECTURE.md          # アーキテクチャ設計
│   ├── DOCUMENT_AUDIT_REPORT.md # ドキュメント監査レポート
│   ├── DOCUMENT_AUDIT_SUMMARY.md # ドキュメント監査サマリー
│   └── archive/                 # アーカイブ済みファイル
│
└── docs/                        # ユーザー・開発者向けドキュメント
    ├── README.md                # ドキュメントインデックス
    ├── INSTALLATION_GUIDE.md    # インストールガイド
    ├── USER_GUIDE.md            # ユーザーガイド
    ├── FAQ.md                   # よくある質問
    ├── TROUBLESHOOTING.md       # トラブルシューティング
    ├── DEVELOPMENT_SETUP.md     # 開発環境セットアップ
    ├── API_DOCUMENTATION.md     # APIドキュメント
    │
    └── reports/                 # 監査レポート（統合後）
        ├── README.md            # レポートインデックス
        ├── CODE_QUALITY_AUDIT_REPORT.md      # コード品質監査（最新版）
        ├── SECURITY_AUDIT_REPORT.md          # セキュリティ監査（最新版）
        ├── PERFORMANCE_AUDIT_REPORT.md       # パフォーマンス監査（最新版）
        ├── USABILITY_AUDIT_REPORT.md          # ユーザビリティ監査（最新版）
        ├── PRIVACY_AUDIT_REPORT.md           # プライバシー監査（最新版）
        ├── COMMUNICATION_AUDIT_REPORT.md      # コミュニケーション監査（最新版）
        ├── OPERATIONAL_AUDIT_REPORT.md        # 運用監査（最新版）
        ├── ETHICS_AUDIT_REPORT.md             # 倫理監査（最新版）
        ├── TEST_AUDIT_REPORT.md               # テスト監査（最新版）
        ├── DEVELOPMENT_PROCESS_AUDIT_REPORT.md # 開発プロセス監査（最新版）
        ├── LICENSE_AUDIT_REPORT.md           # ライセンス監査
        └── archive/             # 古いバージョンのレポート
```

### 2. ファイル整理ルール

#### 2.1 ルートディレクトリ
- **保持**: README.md, CHANGELOG.md, CONTRIBUTING.md, SECURITY_POLICY.md, LICENSE
- **移動**: すべての監査レポートファイル → `docs/reports/` または `docs/reports/archive/`

#### 2.2 重複ファイルの処理
- **最新版を保持**: `*_FINAL.md`, `*_LATEST.md`, `*_ULTIMATE.md`, `*_V15.md`など最新バージョン
- **古いバージョンをアーカイブ**: `*_V2.md`, `*_V3.md`など → `docs/reports/archive/`
- **統合可能なファイル**: 同じ内容のファイルは1つに統合

#### 2.3 命名規則の統一
- 監査レポート: `{CATEGORY}_AUDIT_REPORT.md`
- バージョン管理: ファイル名にバージョン番号を含めない（最新版のみ保持）
- アーカイブ: `archive/{ORIGINAL_NAME}`

---

## 📋 整理手順

### フェーズ1: ルートディレクトリの整理
1. ルートディレクトリの監査レポートを`docs/reports/`に移動
2. 必要に応じて`docs/reports/archive/`に古いバージョンを移動

### フェーズ2: docs/内の整理
1. 重複する監査レポートを特定
2. 最新版を保持し、古いバージョンを`docs/reports/archive/`に移動
3. 統合可能なファイルを統合

### フェーズ3: 命名規則の統一
1. ファイル名を統一された命名規則に変更
2. 参照リンクを更新

### フェーズ4: ドキュメント化
1. `docs/reports/README.md`を更新
2. `DOCKS/DOCUMENTATION_INDEX.md`を更新

---

## ✅ 整理後の期待される効果

1. **可読性の向上**: 必要なファイルがすぐに見つかる
2. **保守性の向上**: 重複がなくなり、更新が容易に
3. **一貫性の向上**: 統一された命名規則とディレクトリ構造

---

**注意**: この整理作業は段階的に実施し、各フェーズで動作確認を行います。

