# FLM - ドキュメントインデックス

## 文書情報

- **プロジェクト名**: FLM
- **バージョン**: 1.0.0
- **最終更新日**: 2024年
- **目的**: プロジェクト内のすべてのドキュメントファイルを整理し、分類・参照を容易にする

---

## 📚 ドキュメント分類

### 🏗️ 設計・アーキテクチャ（DOCKS/）

#### システム設計
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - システムアーキテクチャ設計書
- **[INTERFACE_SPEC.md](./INTERFACE_SPEC.md)** - モジュール間インターフェース仕様
- **[DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql)** - データベーススキーマ（SQL）

#### 仕様書
- **[SPECIFICATION.md](./SPECIFICATION.md)** - 完全な仕様書（メイン）
- **[SPECIFICATION_SUMMARY.md](./SPECIFICATION_SUMMARY.md)** - 仕様書サマリー（簡易参照用）

#### 技術選定・レポート
- **[TECHNOLOGY_SELECTION_REPORT.md](./TECHNOLOGY_SELECTION_REPORT.md)** - 技術選定レポート
- **[PERFORMANCE_AUDIT_REPORT.md](./PERFORMANCE_AUDIT_REPORT.md)** - パフォーマンス監査レポート
- **[SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)** - セキュリティ監査レポート

#### UI/UX設計
- **[UI_MAP.md](./UI_MAP.md)** - UIマップ
- **[公式サイト仕様書.md](./公式サイト仕様書.md)** - 公式Webサイト仕様書

#### その他
- **[CONCEPT.md](./CONCEPT.md)** - プロジェクトコンセプト
- **[README.md](./README.md)** - DOCKSディレクトリの説明

#### 📦 開発履歴（アーカイブ）
v1.0リリース完了後の開発履歴ドキュメントは `archive/` ディレクトリに移動しました：
- **[archive/AGENT_ARCHITECTURE.md](./archive/AGENT_ARCHITECTURE.md)** - AIエージェント構成設計書（開発フェーズ用）
- **[archive/AGENT_CHECKLIST.md](./archive/AGENT_CHECKLIST.md)** - エージェント別タスクチェックリスト（開発フェーズ用）
- **[archive/PROJECT_COMPLETION_GUIDE.md](./archive/PROJECT_COMPLETION_GUIDE.md)** - プロジェクト完成までの手順書（開発フェーズ用）

---

### 👥 ユーザー向けドキュメント（docs/）

- **[USER_GUIDE.md](../docs/USER_GUIDE.md)** - ユーザーガイド（使い方ガイド）
- **[FAQ.md](../docs/FAQ.md)** - よくある質問（30の質問と回答）
- **[TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)** - トラブルシューティングガイド（15の問題と解決方法）

---

### 👨‍💻 開発者向けドキュメント（docs/）

#### 開発環境・セットアップ
- **[DEVELOPMENT_SETUP.md](../docs/DEVELOPMENT_SETUP.md)** - 開発環境セットアップ手順
- **[PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md)** - プロジェクト構造の説明

#### API・技術仕様
- **[API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md)** - APIドキュメント（Tauri IPCコマンドとOpenAI互換API）
- **[AUTH_PROXY_SPEC.md](../docs/AUTH_PROXY_SPEC.md)** - 認証プロキシ仕様
- **[DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md)** - データベーススキーマ説明

#### 開発ガイド
- **[DEVELOPER_GUIDE.md](../docs/DEVELOPER_GUIDE.md)** - 開発者ガイド（アーキテクチャ説明、コントリビューションガイド）

#### パフォーマンス・品質
- **[PERFORMANCE_OPTIMIZATION.md](../docs/PERFORMANCE_OPTIMIZATION.md)** - パフォーマンス最適化

#### 将来の拡張
- **[FUTURE_EXTENSIONS.md](../docs/FUTURE_EXTENSIONS.md)** - 将来の拡張計画

#### 📦 開発履歴（アーカイブ）
v1.0リリース完了後の開発履歴ドキュメントは `docs/archive/` ディレクトリに移動しました：
- **[archive/PROJECT_COMPLETION_REPORT.md](../docs/archive/PROJECT_COMPLETION_REPORT.md)** - プロジェクト完了報告書（v1.0完了記録）
- **[archive/PROJECT_FINAL_REVIEW.md](../docs/archive/PROJECT_FINAL_REVIEW.md)** - プロジェクト最終レビュー報告書（v1.0完了記録）
- **[archive/IMPLEMENTATION_STATUS.md](../docs/archive/IMPLEMENTATION_STATUS.md)** - 実装状況レポート（開発フェーズ用）

---

### 📖 ルートディレクトリのドキュメント

- **[README.md](../README.md)** - プロジェクトREADME（プロジェクト概要、技術スタック、セットアップ）
- **[CHANGELOG.md](../CHANGELOG.md)** - 変更履歴（すべての重要な変更の記録）
- **[RELEASE_NOTES.md](../RELEASE_NOTES.md)** - リリースノート（v1.0.0）
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - コントリビューションガイド
- **[LICENSE](../LICENSE)** - MIT License

---

## 📋 ドキュメント一覧（用途別）

### プロジェクト開始時
1. [README.md](../README.md) - プロジェクト概要
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - システムアーキテクチャ
3. [SPECIFICATION.md](./SPECIFICATION.md) - 完全な仕様書
4. [CONCEPT.md](./CONCEPT.md) - プロジェクトコンセプト

### 開発時
1. [DEVELOPMENT_SETUP.md](../docs/DEVELOPMENT_SETUP.md) - 開発環境セットアップ
2. [DEVELOPER_GUIDE.md](../docs/DEVELOPER_GUIDE.md) - 開発者ガイド
3. [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md) - APIドキュメント
4. [PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md) - プロジェクト構造

### ユーザー向け
1. [INSTALLATION_GUIDE.md](../docs/INSTALLATION_GUIDE.md) - インストールガイド
2. [USER_GUIDE.md](../docs/USER_GUIDE.md) - ユーザーガイド
3. [FAQ.md](../docs/FAQ.md) - よくある質問
4. [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) - トラブルシューティング

---

## 🔗 ドキュメント間の関連性

### 設計 → 実装
- `ARCHITECTURE.md` → `DEVELOPER_GUIDE.md`
- `INTERFACE_SPEC.md` → `API_DOCUMENTATION.md`
- `SPECIFICATION.md` → `DEVELOPER_GUIDE.md`

### 技術 → ユーザー
- `API_DOCUMENTATION.md` → `USER_GUIDE.md`
- `DEVELOPER_GUIDE.md` → `USER_GUIDE.md`

---

## 📝 ドキュメント更新履歴

### 主要ドキュメントの更新状況

| ドキュメント | 最終更新 | 状態 |
|------------|---------|------|
| ARCHITECTURE.md | 2024年 | ✅ 最新 |
| SPECIFICATION.md | 2024年 | ✅ 最新 |
| API_DOCUMENTATION.md | 2024年 | ✅ 最新 |
| USER_GUIDE.md | 2024年 | ✅ 最新 |
| DEVELOPER_GUIDE.md | 2024年 | ✅ 最新 |

---

## 🗂️ ファイル構造の推奨

### 現在の構造
```
FLLM/
├── DOCKS/              # 設計・仕様・アーキテクチャ
├── docs/               # ユーザー向け・開発者向け
├── ARCHITECTURE.md     # ルート（重複の可能性）
└── INTERFACE_SPEC.md   # ルート（重複の可能性）
```

### 整理の推奨事項

1. **ルートディレクトリの重複ファイルを確認**
   - `ARCHITECTURE.md` と `DOCKS/ARCHITECTURE.md` の整合性を確認
   - `INTERFACE_SPEC.md` と `DOCKS/INTERFACE_SPEC.md` の整合性を確認

2. **シンボリックリンクまたはREADMEでの参照**
   - ルートの `ARCHITECTURE.md` と `INTERFACE_SPEC.md` は `DOCKS/` への参照のみにする
   - または、シンボリックリンクを使用

3. **ドキュメントの命名規則統一**
   - 英語名を優先
   - 日本語名のファイルは必要最小限に

---

## 📌 重要なドキュメント（優先度順）

### 最高優先度（必読）
1. [README.md](../README.md) - プロジェクト概要
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - システムアーキテクチャ
3. [SPECIFICATION.md](./SPECIFICATION.md) - 完全な仕様書

### 高優先度（開発時に参照）
1. [DEVELOPMENT_SETUP.md](../docs/DEVELOPMENT_SETUP.md) - 開発環境セットアップ
2. [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md) - APIドキュメント
3. [DEVELOPER_GUIDE.md](../docs/DEVELOPER_GUIDE.md) - 開発者ガイド

### 中優先度（必要に応じて参照）
1. [SPECIFICATION.md](./SPECIFICATION.md) - 完全な仕様書
2. [USER_GUIDE.md](../docs/USER_GUIDE.md) - ユーザーガイド
3. [FAQ.md](../docs/FAQ.md) - よくある質問

---

## 🔍 ドキュメント検索

### 特定のトピックを探す

- **APIについて**: [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md)
- **データベースについて**: [DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md), [DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql)
- **認証について**: [AUTH_PROXY_SPEC.md](../docs/AUTH_PROXY_SPEC.md)
- **パフォーマンスについて**: [PERFORMANCE_AUDIT_REPORT.md](./PERFORMANCE_AUDIT_REPORT.md), [PERFORMANCE_OPTIMIZATION.md](../docs/PERFORMANCE_OPTIMIZATION.md)
- **セキュリティについて**: [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)
- **トラブルシューティング**: [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
- **開発履歴（v1.0完了記録）**: [archive/](../DOCKS/archive/) ディレクトリを参照

---

**このインデックスを定期的に更新して、ドキュメントの整理を維持してください。**

**作成者**: アーキテクトエージェント (ARCH)  
**作成日**: 2024年

