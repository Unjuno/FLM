# Status Directory

> Updated: 2025-02-01 | Status: Reference | Last Cleanup: 2025-02-01

## ディレクトリ構造

```
docs/status/
├── README.md (本ファイル)
├── PROGRESS_REPORT.md - 進捗レポート
├── PROGRESS_CHECK_REPORT.md - 進捗チェックレポート
├── active/ - 現在進行中のレポート（2025-02-01整理済み）
│   ├── NEXT_STEPS.md - 唯一の公式タスクリスト
│   ├── ISSUES_INDEX.md - 問題レポート索引
│   ├── CURRENT_IMPLEMENTATION_STATUS.md - 現在の実装状況
│   ├── RELEASE_READINESS_ASSESSMENT.md - リリース可能性評価
│   ├── RELEASE_READINESS_20250201.md - 最新のリリース準備状況
│   ├── RELEASE_CHECKLIST_20250201.md - リリース前チェックリスト
│   ├── PROGRESS_STEP_BY_STEP.md - 進捗レポート
│   ├── ABSOLUTE_FINAL_ISSUES.md - 最新の問題レポート
│   ├── INCIDENT_LOG.md - インシデントログ
│   └── ... (その他の進行中レポート)
└── completed/ - 完了済みレポート
    ├── phases/ - フェーズ完了レポート
    ├── tasks/ - タスク完了レポート
    ├── tests/ - テストレポート
    ├── fixes/ - バグ修正レポート
    ├── safety/ - 安全性・監査レポート
    ├── security/ - セキュリティレポート
    ├── proxy/ - ProxyServiceレポート
    └── packaging/ - パッケージングレポート
```

## 運用ルール

### Active/Completed 運用

- **作業が完了したら**: 該当ドキュメントを `active/` から対応する `completed/*` サブディレクトリへ物理移動し、ヘッダーの `Status` を更新する
- **唯一のタスクリスト**: `active/NEXT_STEPS.md` は「唯一の進行中タスクリスト」とし、他ファイルから重複情報を排除する
- **完了レポート**: `completed/tasks/FINAL_SUMMARY.md` をタスク完了の正とし、完了時は `DONE.md` に簡潔な作業ログを追記

### 問題レポートの整理

- **問題分析レポート**: `active/ISSUES_INDEX.md` を参照
- **最新の問題**: `active/ABSOLUTE_FINAL_ISSUES.md` を参照（2025-02-01整理により最新版を保持）
- **過去の分析**: 必要に応じて `completed/tasks/` 内の過去レポートを参照
- **重複レポート**: 2025-02-01整理により、古い重複レポート（`ULTIMATE_FINAL_ISSUES.md`, `FINAL_COMPREHENSIVE_ISSUES.md`など）は `completed/tasks/` に移動済み

### レポートの分類

1. **進捗レポート**: プロジェクト全体の進捗状況
2. **問題レポート**: 発見された問題とその分析
3. **完了レポート**: 完了したタスクやフェーズの記録
4. **修正レポート**: バグ修正や改善の記録

## 関連ドキュメント

- `docs/README.md` - ドキュメント全体の索引
- `docs/planning/PLAN.md` - プロジェクト計画
- `docs/specs/CORE_API.md` - Core API仕様
