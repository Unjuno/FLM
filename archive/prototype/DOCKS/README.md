# DOCKS - 設計・仕様・アーキテクチャドキュメント

## 📚 このディレクトリについて

このディレクトリには、FLMプロジェクトの設計、仕様、アーキテクチャに関するドキュメントが含まれています。

**📖 [ドキュメントインデックス](./DOCUMENTATION_INDEX.md)** - すべてのドキュメントファイルの一覧と分類（推奨）

---

## 📚 ドキュメント構成（概要）

### 🎯 必読ドキュメント

以下のドキュメントは、プロジェクトを理解するために必ず読むことをお勧めします：

1. **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - すべてのドキュメントファイルの一覧と分類
2. **[AGENT_CHECKLIST.md](./AGENT_CHECKLIST.md)** - エージェント別タスクチェックリスト
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - システムアーキテクチャ設計書
4. **[SPECIFICATION.md](./SPECIFICATION.md)** - 完全な仕様書

---

## 🎯 必須ドキュメント（実装前に必読）

### 1. [CONCEPT.md](./CONCEPT.md)
**プロジェクトのコンセプトとビジョン**
- プロジェクトの目的と目標
- ターゲットユーザー
- 差別化ポイント
- 市場分析

### 2. [SPECIFICATION.md](./SPECIFICATION.md)
**機能仕様書（メイン）**
- システム概要
- 機能仕様（F001-F009）
- 技術仕様（アーキテクチャ、OSS選定）
- UI/UX仕様
- API仕様
- セキュリティ仕様
- 開発・テスト方針

### 3. [公式サイト仕様書.md](./公式サイト仕様書.md)
**公式Webサイトの仕様**
- サイト構成とページ仕様
- 技術仕様（HTML/CSS/JavaScriptのみ）
- UI/UX仕様
- 機能要件

---

## 🗺️ UI/UX関連

### [UI_MAP.md](./UI_MAP.md)
**UI画面構成とナビゲーション構造**
- 全体構造の可視化
- 各画面の詳細仕様
- ユーザーフロー

---

## 🔒 セキュリティ関連

### [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)
**セキュリティ監査レポート**
- セキュリティ要件の確認
- 潜在的な脆弱性の特定
- 改善提案

---

## 📝 サマリードキュメント

### [SPECIFICATION_SUMMARY.md](./SPECIFICATION_SUMMARY.md)
**仕様の要点サマリー**
- 主要ポイントの整理
- 確定事項の一覧
- 実装時の参照用

**注意**: 詳細は `SPECIFICATION.md` を参照してください。

### [仕様書未記載機能一覧.md](./仕様書未記載機能一覧.md)
**仕様書に明記されていない実装済み機能一覧**
- 実装済みだが仕様書に記載されていない機能のリスト
- v2.0以降の予定機能として記載されているが既に実装済みの機能
- 将来の拡張としてのみ言及されているが既に実装済みの機能

---

## 📋 その他

**注意**: 最新の仕様は `SPECIFICATION.md` を参照してください。簡易参照用には `SPECIFICATION_SUMMARY.md` をご利用ください。

---

## 🔗 ドキュメント間の関係

```
CONCEPT.md (コンセプト)
    ↓
SPECIFICATION.md (メイン仕様書)
    ├── 公式サイト仕様書.md (公式サイト)
    ├── UI_MAP.md (UI設計)
    └── SECURITY_AUDIT_REPORT.md (セキュリティ)
```

---

## 🚀 実装開始前に確認すべき事項

1. ✅ **CONCEPT.md** でプロジェクトのコンセプトを理解
2. ✅ **SPECIFICATION.md** で機能要件と技術仕様を確認
3. ✅ **公式サイト仕様書.md** で公式サイトの要件を確認
4. ✅ **UI_MAP.md** でUI設計を確認
5. ✅ **SECURITY_AUDIT_REPORT.md** でセキュリティ要件を確認

---

## 📌 重要なポイント

- **プロジェクト名**: FLM（統一済み）
- **データ保存場所**: `%APPDATA%/FLM/` (Windows)
- **公式サイトURL**: `https://flm.com` (仮)
- **技術スタック**: Tauri、Ollama、SQLite（OSS優先）

---

**最終更新**: 2024年

