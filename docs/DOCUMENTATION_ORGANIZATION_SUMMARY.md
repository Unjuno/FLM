# ドキュメント整理サマリー

**作成日**: 2025年11月7日  
**目的**: Markdownファイルの整理と分類

---

## 📋 整理内容

### 整理前の状態
- ルートディレクトリに多数のMarkdownファイルが散在
- 重複するリリース関連ドキュメントが多数存在
- 実装レポート、テストガイド、手順書などが混在

### 整理後の構造

```
docs/
├── README.md                          # ドキュメント一覧
├── overview/                          # プロジェクト概要
│   ├── README.md
│   ├── APP_INFO.md
│   └── USAGE_STATUS.md
├── release/                           # リリース関連
│   ├── README.md
│   └── [リリース準備・完了ドキュメント]
├── reports/                           # 実装・テストレポート
│   ├── README.md
│   └── [実装完了、テスト、評価レポート]
├── tests/
│   ├── guides/                        # テストガイド
│   │   ├── README.md
│   │   ├── TESTING_GUIDE.md
│   │   ├── TEST_EXECUTION_GUIDE.md
│   │   ├── QUICK_TEST_GUIDE.md
│   │   └── LLM_TEST_GUIDE.md
│   └── test-plans/                    # テスト計画（既存）
├── procedures/                        # 公開手順・開発手順
│   ├── README.md
│   ├── 開発手順.md
│   ├── ウェブサイト公開手順.md
│   ├── スチーム公開手順.md
│   └── ハッカーニュース公開手順.md
└── guides/                            # 各種機能の使用方法ガイド
    ├── README.md
    ├── RATE_LIMIT_USAGE.md
    └── REDIS_RATE_LIMIT_SETUP.md
```

---

## 📁 移動したファイル

### プロジェクト概要 (`docs/overview/`)
- `APP_INFO.md`
- `USAGE_STATUS.md`

### リリース関連 (`docs/release/`)
- `RELEASE_CHECKLIST.md`
- `RELEASE_PREPARATION_SUMMARY.md`
- `RELEASE_READINESS_REPORT.md`
- `RELEASE_READY*.md` (複数バージョン)
- `RELEASE_COMPLETE*.md` (複数バージョン)
- `RELEASE_FINAL*.md` (複数バージョン)
- `RELEASE_STATUS*.md` (複数バージョン)
- `RELEASE_SUMMARY*.md` (複数バージョン)
- `FINAL_RELEASE_*.md` (複数バージョン)

### 実装・テストレポート (`docs/reports/`)
- `DEVELOPER_EXPERT_ULTIMATE_COMPREHENSIVE_REPORT.md`
- `FINAL_TEST_REPORT.md`
- `IMPLEMENTATION_*.md`
- `IMPROVEMENTS_*.md`
- `APPLICATION_EVALUATION_REPORT.md`
- `CLEANUP_SUMMARY.md`
- `ERROR_FIX_SUMMARY.md`
- `SECURITY_*.md` (セキュリティ監査レポート)
- `TAURI_V2_AUDIT_REPORT.md`
- `DOCKS/IMPLEMENTATION_VERIFICATION_REPORT.md`

### テストガイド (`docs/tests/guides/`)
- `TESTING_GUIDE.md`
- `TEST_EXECUTION_GUIDE.md`
- `QUICK_TEST_GUIDE.md`
- `LLM_TEST_GUIDE.md`

### 手順書 (`docs/procedures/`)
- `Procedure/開発手順.md`
- `Procedure/ウェブサイト公開手順.md`
- `Procedure/スチーム公開手順.md`
- `Procedure/ハッカーニュース公開手順.md`

### ガイド (`docs/guides/`)
- `RATE_LIMIT_USAGE.md`
- `REDIS_RATE_LIMIT_SETUP.md`

### テスト関連 (`docs/tests/`)
- `MISSING_TEST_ITEMS.md` - テスト不足項目一覧

### テストガイド (`docs/tests/guides/`)
- `test-f001-guide.md` - F001テストの実行方法
- `test-model-parameters.md` - モデルパラメータテスト手順

### docs直下に移動
- `NEXT_STEPS.md`
- `NEXT_ACTIONS_PRIORITY.md`

### DOCKSに移動
- `仕様書未記載機能一覧.md` - 仕様書の補足資料として`DOCKS/`に配置

---

## ✅ 整理結果

### ルートディレクトリ
以下の重要なファイルのみがルートに残っています：
- `README.md` - プロジェクト概要
- `CHANGELOG.md` - 変更履歴
- `RELEASE_NOTES.md` - リリースノート（誤って移動されていたものを復元）
- `CONTRIBUTING.md` - コントリビューションガイド
- `SECURITY_POLICY.md` - セキュリティポリシー（誤って移動されていたものを復元）
- `LICENSES.md` - ライセンス情報

### ドキュメント構造
- カテゴリ別に整理され、各ディレクトリにREADMEを追加
- 重複ファイルを整理し、開発履歴として保持
- 参照しやすい構造に改善

### 更新したファイル
- `README.md` - 新しいドキュメント構造を反映
- `docs/README.md` - サブディレクトリの説明を追加
- `DOCKS/DOCUMENTATION_INDEX.md` - 新しい構造を反映

---

## 📌 注意事項

1. **重複ファイル**: `docs/release/`内には、リリース準備時に作成された複数のバージョンのドキュメントが含まれています。これらは開発履歴として保持されています。

2. **参照パス**: 既存のコードやドキュメント内で、移動したファイルへの参照がある場合は、パスを更新してください。

3. **Procedureフォルダ**: 空になった`Procedure/`フォルダは削除されました。

4. **追加整理**:
   - `tests/`フォルダ内のテストガイドを`docs/tests/guides/`に移動
   - `仕様書未記載機能一覧.md`を`DOCKS/`に移動（仕様書の補足資料として）
   - 誤って移動されていた`RELEASE_NOTES.md`と`SECURITY_POLICY.md`をルートに復元

---

**整理完了日**: 2025年11月7日  
**最終更新**: 2025年11月7日（追加整理完了）

