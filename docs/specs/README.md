# Specifications

> Status: Reference | Audience: All contributors | Updated: 2025-01-27

このディレクトリには、FLMプロジェクトの各コンポーネントの詳細仕様書が含まれています。

## ディレクトリ構成

```
docs/specs/
├── README.md (本ファイル)
├── CORE_API.md              # コアAPI仕様（v1.0.0で凍結）
├── CLI_SPEC.md              # CLIコマンド仕様
├── PROXY_SPEC.md            # プロキシ仕様
├── UI_MINIMAL.md            # UI最小仕様
├── UI_EXTENSIONS.md         # UI拡張仕様
├── ENGINE_DETECT.md         # エンジン検出仕様
├── DB_SCHEMA.md             # データベーススキーマ
├── FEATURE_SPEC.md          # 機能仕様
├── I18N_SPEC.md             # 国際化仕様
└── BRAND_GUIDELINE.md       # ブランドガイドライン
```

## 仕様書一覧

### CORE_API.md - コアAPI仕様

**Status**: Canonical | **Audience**: Rust core engineers | **Updated**: 2025-01-27

Rustコアライブラリ（`flm-core`）のAPI仕様。Domain層、Application層、Ports（Traits）の定義。

- Domain層のデータモデル
- Service層のAPI定義
- Ports（抽象インターフェイス）の定義
- エラーハンドリング

**重要**: この仕様はv1.0.0で凍結されています。変更はADR経由でのみ許可されます。

**参照元**: `docs/planning/PLAN.md`, `docs/specs/CLI_SPEC.md`, `docs/specs/PROXY_SPEC.md`

### CLI_SPEC.md - CLIコマンド仕様

**Status**: Canonical | **Audience**: CLI developers & QA | **Updated**: 2025-11-20

CLIコマンドの詳細仕様。コマンド一覧、オプション、出力形式、エラーハンドリング。

- コマンド一覧とオプション
- 出力形式（JSON/Text）
- エラーコードとメッセージ
- Core APIとの対応関係

**参照元**: `docs/specs/CORE_API.md`

### PROXY_SPEC.md - プロキシ仕様

**Status**: Canonical | **Audience**: Proxy/Network engineers | **Updated**: 2025-11-20

HTTP(S)プロキシの詳細仕様。ルーティング、認証、セキュリティ、OpenAI互換API。

- リクエストフロー
- ルーティングルール
- 認証とセキュリティポリシー
- OpenAI互換APIの変換ルール
- HTTPS証明書管理

**参照元**: `docs/specs/CORE_API.md`, `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`

### UI_MINIMAL.md - UI最小仕様

**Status**: Canonical | **Audience**: UI engineers | **Updated**: 2025-11-20

Phase 2で実装する最小UIの仕様。画面構成、コンポーネント、IPC通信。

- 画面構成（ステータス表示、API作成フォーム、テスト用チャット）
- コンポーネント設計
- IPC通信仕様
- Core APIとの対応関係

**参照元**: `docs/specs/CORE_API.md`, `docs/planning/PLAN.md`

### UI_EXTENSIONS.md - UI拡張仕様

**Status**: Reference | **Audience**: Product & UI leads | **Updated**: 2025-11-20

Phase 2以降のUI拡張機能の仕様。多言語対応、テーマ、アクセシビリティ。

- 多言語対応（i18n）
- テーマとカスタマイズ
- アクセシビリティ
- 将来の拡張機能

**参照元**: `docs/specs/UI_MINIMAL.md`, `docs/specs/I18N_SPEC.md`

### ENGINE_DETECT.md - エンジン検出仕様

**Status**: Canonical | **Audience**: Engine adapter developers | **Updated**: 2025-11-20

LLMエンジン（Ollama、vLLM、LM Studio、llama.cpp）の検出ロジック仕様。

- エンジン検出アルゴリズム
- 状態判定（InstalledOnly、RunningHealthy等）
- エンジン固有の検出方法
- キャッシュ戦略

**参照元**: `docs/specs/CORE_API.md`

### DB_SCHEMA.md - データベーススキーマ

**Status**: Canonical | **Audience**: Persistence / CLI engineers | **Updated**: 2025-11-20

SQLiteデータベース（`config.db`、`security.db`）のスキーマ定義とマイグレーション方針。

- テーブル定義
- インデックス設計
- マイグレーション戦略
- バックアップ/復旧手順

**参照元**: `docs/specs/CORE_API.md`, `docs/guides/MIGRATION_GUIDE.md`

### FEATURE_SPEC.md - 機能仕様

**Status**: Canonical | **Audience**: Product & Engineering leads | **Updated**: 2025-11-20

プロジェクト全体の機能仕様。各フェーズで実装する機能の詳細。

- Phase別の機能一覧
- 機能の優先順位
- 実装方針

**参照元**: `docs/planning/PLAN.md`

### I18N_SPEC.md - 国際化仕様

**Status**: Canonical | **Audience**: UI engineers | **Updated**: 2025-11-20

多言語対応の仕様。翻訳ファイルの構造、ロケール管理、実装方針。

- 対応言語
- 翻訳ファイルの構造
- ロケール管理
- 実装方針

**参照元**: `docs/specs/UI_EXTENSIONS.md`

### BRAND_GUIDELINE.md - ブランドガイドライン

**Status**: Canonical | **Audience**: UI/Design engineers | **Updated**: 2025-11-20

ブランドガイドライン。ロゴ、カラーパレット、タイポグラフィ、UIコンポーネント。

- ロゴとアイコン
- カラーパレット
- タイポグラフィ
- UIコンポーネントのスタイル

**参照元**: `docs/specs/UI_MINIMAL.md`, `docs/specs/UI_EXTENSIONS.md`

## 仕様書の状態（Status）

各仕様書には以下のStatusが設定されています：

- **Canonical**: 正式版、変更は慎重に（v1.0.0で凍結された仕様はADR経由でのみ変更）
- **Reference**: 参照用、随時更新可能

## 仕様書の更新ルール

1. **CORE_API.md**: v1.0.0で凍結。変更はADR経由でのみ許可
2. **CLI_SPEC.md, PROXY_SPEC.md**: Core APIに依存するため、Core API変更時に対応
3. **UI_MINIMAL.md**: Phase 2実装前に確定
4. **その他**: 実装進捗に応じて随時更新

## 仕様書間の依存関係

```
CORE_API.md (v1.0.0凍結)
  ├─ CLI_SPEC.md
  ├─ PROXY_SPEC.md
  ├─ UI_MINIMAL.md
  ├─ ENGINE_DETECT.md
  └─ DB_SCHEMA.md

UI_MINIMAL.md
  ├─ UI_EXTENSIONS.md
  └─ I18N_SPEC.md

UI_EXTENSIONS.md
  └─ BRAND_GUIDELINE.md
```

## 関連リソース

- **計画**: `docs/planning/PLAN.md` - プロジェクト計画
- **ガイド**: `docs/guides/` - 実装・運用ガイド
- **監査**: `docs/audit/` - 監査レポート
- **進捗**: `docs/status/` - 進捗状況

---

**質問や提案**: Issueまたはドキュメントコメントでお知らせください。

