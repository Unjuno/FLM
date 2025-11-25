# Planning Documents

> Status: Reference | Audience: All contributors | Updated: 2025-11-25

このディレクトリには、プロジェクトの計画と設計ドキュメントが含まれています。

## ディレクトリ構成

```
docs/planning/
├── README.md (本ファイル)
├── PLAN.md                              # メインプロジェクト計画（必読）
├── diagram.md                           # アーキテクチャ図
├── BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md  # ボットネット対策実装計画
└── HACKER_NEWS_PREP.md                 # Hacker News投稿準備ガイド
```

## ドキュメント一覧

### PLAN.md - メインプロジェクト計画

**Status**: Canonical | **Audience**: All contributors | **Updated**: 2025-11-25

プロジェクト全体の計画とフェーズ定義。必読のドキュメントです。

- アーキテクチャ設計
- フェーズ定義（Phase 0-3）
- 実装方針と成功基準
- データ移行戦略

**参照先**: `docs/specs/`, `docs/guides/`

### diagram.md - アーキテクチャ図

**Status**: Canonical | **Audience**: All contributors | **Updated**: 2025-11-25

Rust コア / Adapters / External Dependencies の関係と依存方向を示すマーメイド図。

- Domain層（flm-core）の構造
- Ports（Traits）の定義
- Application Layer（CLI/UI/Proxy）の関係
- External Systemsとの接続

**参照元**: `PLAN.md`

### BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md - ボットネット対策実装計画

**Status**: Planning | **Audience**: Security engineers, Core developers | **Updated**: 2025-11-25

外部公開時のボットネット対策機能の実装計画。開発者向けの詳細な実装仕様。

- 実装する機能の詳細仕様
- データベーススキーマ
- API設計
- 実装順序と優先順位
- テスト計画

**関連ドキュメント**:
- `docs/guides/SECURITY_BOTNET_PROTECTION.md` - ユーザー向けガイド
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/CORE_API.md` - コアAPI仕様

### HACKER_NEWS_PREP.md - Hacker News投稿準備ガイド

**Status**: Reference | **Audience**: Project leads | **Updated**: 2025-11-25

Phase 3完了後のHacker News投稿に向けた準備ガイド。

- 投稿タイミングと条件
- 投稿内容のテンプレート
- 必要な資料のリスト
- よくある質問への回答準備

**注意**: Phase 3完了まで投稿しないこと。

## ドキュメントの関係性

```
PLAN.md (メイン計画)
  ├─ diagram.md (アーキテクチャ図)
  ├─ BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md (セキュリティ実装計画)
  │   └─ guides/SECURITY_BOTNET_PROTECTION.md (ユーザーガイド)
  └─ HACKER_NEWS_PREP.md (投稿準備)
      └─ specs/PROXY_SPEC.md (セキュリティ対策の参照)
```

## ドキュメントの更新方針

1. **PLAN.md**: プロジェクト全体の方針変更時のみ更新
2. **diagram.md**: アーキテクチャ変更時に更新
3. **BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md**: 実装計画の変更時に更新
4. **HACKER_NEWS_PREP.md**: Phase 3完了時に最終更新

## 関連リソース

- **仕様書**: `docs/specs/` - 各コンポーネントの詳細仕様
- **ガイド**: `docs/guides/` - 実装・運用ガイド
- **進捗**: `docs/status/` - 進捗状況と完了レポート
- **監査**: `docs/audit/` - 監査レポート

---

**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

