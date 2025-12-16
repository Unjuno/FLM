# FLM Internationalization (i18n) Specification
> Status: Implemented | Audience: UI engineers | Updated: 2025-02-01
> Phase 2 で実装完了。実装状況は `README.md` セクション「国際化（I18N）」を参照してください。

> 章別リビジョン:
>
> | 節 | バージョン | 最終更新 |
> | --- | --- | --- |
> | 2. UI多言語対応 | Draft | 2025-11-20 |
> | 3. CLI多言語対応 | v1.0.0 | 2025-11-20 |
> | 7. 実装すべき項目 | Draft backlog | 2025-11-25 |

## 1. 概要

FLMの多言語対応は、**UIのみ日本語・英語対応**、**CLIは英語のみ**とする。

### 1.1 対応言語

```
対応言語:
- 日本語 (ja) - デフォルト
- 英語 (en)

将来の拡張:
- 他の言語は Phase 3 以降で検討
```

### 1.2 方針

- **UI**: 日本語・英語対応（大衆向けのため）
- **CLI**: 英語のみ（技術者向けのため、実装の複雑さを避ける）
- **Rust Core**: 言語依存ロジックを持たない（UI/CLIで処理）

## 2. UI多言語対応

### 2.1 実装方法

```
- 翻訳ファイル: locales/ja.json, locales/en.json
- ライブラリ: i18next + tauri-plugin-store
- 設定保存: config.db の preferred_language フィールド
- フォールバック: 日本語 → 英語 → キー名
```

### 2.2 翻訳ファイル構造

プロトタイプの構造を継承:

```json
{
  "dashboard": {
    "title": "ダッシュボード",
    "engineStatus": "エンジン状態",
    "proxyStatus": "プロキシ状態"
  },
  "apiSetup": {
    "title": "API設定",
    "createKey": "APIキーを作成",
    "revokeKey": "APIキーを失効"
  },
  "errors": {
    "engineNotFound": "エンジンが見つかりません",
    "proxyStartFailed": "プロキシの起動に失敗しました"
  }
}
```

### 2.3 言語切り替え

#### UI設定画面
```
- 設定画面で言語を選択（日本語/英語）
- 即座に反映（再起動不要）
- 設定は config.db に保存
```

#### 初回起動時
```
- OSの言語設定を自動検出
- 日本語または英語が検出された場合は自動設定
- それ以外の場合は日本語をデフォルト
```

### 2.4 フォールバック戦略

```
1. 選択された言語の翻訳を取得
2. 見つからない場合 → 日本語の翻訳を使用
3. それでも見つからない場合 → 英語の翻訳を使用
4. それでも見つからない場合 → キー名をそのまま表示
```

### 2.5 実装例

```typescript
// i18n コンテキストの使用例
const { locale, setLocale, t } = useI18n();

// 翻訳の取得
const title = t('dashboard.title'); // "ダッシュボード" または "Dashboard"

// 言語の切り替え
await setLocale('en'); // 英語に切り替え
```

## 3. CLI多言語対応

### 3.1 方針

**CLIは英語のみ**とする。

理由:
- 技術者向けツールのため、英語が標準
- 実装の複雑さを避ける
- 国際的な標準に合わせる

### 3.2 実装

```
- エラーメッセージ: 英語
- ヘルプメッセージ: 英語
- JSON出力: 英語（キー名、エラーコード等）
```

### 3.3 エラーメッセージ例

```json
{
  "error": {
    "code": "ENGINE_NOT_FOUND",
    "message": "Ollama is not installed"
  }
}
```

## 4. UIからCLIコマンドを提示する場合

UIの説明文は選択された言語で表示し、CLIコマンド自体は英語のまま:

```
日本語UI:
「以下のコマンドを実行してください: flm engines detect」

英語UI:
"Run the following command: flm engines detect"
```

コメントや説明文は選択された言語で表示:

```bash
# 日本語UIの場合
# エンジンを検出します
flm engines detect

# 英語UIの場合
# Detect available engines
flm engines detect
```

## 5. Rust Core

### 5.1 方針

**Rust Coreには言語依存ロジックを持たせない**。

理由:
- Coreは純粋なビジネスロジック層
- 言語依存はUI/CLI層で処理
- テストの複雑さを避ける

### 5.2 エラーメッセージ

```
- Core APIのエラーメッセージは英語のみ
- UI/CLIで翻訳して表示
- エラーコードは言語非依存（例: "ENGINE_NOT_FOUND"）
```

## 6. 翻訳ファイルの管理

### 6.1 ファイル構造

```
locales/
  ├── ja.json  # 日本語翻訳
  └── en.json  # 英語翻訳
```

### 6.2 翻訳キーの命名規則

```
- 階層構造を使用（例: "dashboard.title"）
- 意味が明確なキー名を使用
- 技術用語は英語のまま（例: "API", "HTTPS"）
```

### 6.3 翻訳キーの検証

```
- Lintタスクでキー漏れを検出
- 翻訳未定義キーはデフォルト英語をフォールバック
- CIで翻訳ファイルの整合性をチェック
```

## 7. 実装すべき項目

### Phase 2（UI実装時）- ✅ 実装完了

- [x] 翻訳ファイル（`locales/ja.json`, `locales/en.json`）の作成
- [x] i18n コンテキストの実装（プロトタイプの `I18nContext.tsx` を参考）
- [x] 言語切り替えUIの実装（設定画面）
- [x] 設定保存機能（`config.db` の `preferred_language`）
- [x] 初回起動時の言語自動検出

**実装状況**: すべての項目が実装完了しています。詳細は `README.md` セクション「国際化（I18N）」を参照してください。

### Phase 1（CLI実装時）

- [ ] CLIのエラーメッセージを英語で実装（既に実装済み）
- [ ] CLIのヘルプメッセージを英語で実装（既に実装済み）

## 8. 用語集（大衆向け用語）

UIでは技術用語を大衆向け用語に置き換える:

| 技術用語 | 日本語UI | 英語UI |
|---------|---------|--------|
| API | 「接続先」または「サービス」 | "Service" or "Endpoint" |
| エンドポイント | 「接続先URL」 | "Endpoint URL" |
| APIキー | 「アクセスキー」 | "Access Key" |
| プロキシ | 「中継サーバー」 | "Proxy Server" |
| モデル | 「AI」 | "AI Model" |
| エンジン | 「AIエンジン」 | "AI Engine" |

詳細は `docs/specs/TERMINOLOGY.md`（将来作成予定）を参照。

## 9. 参考実装

プロトタイプの実装を参考:
- `archive/prototype/src/contexts/I18nContext.tsx` - i18nコンテキストの実装
- `archive/prototype/src/locales/ja.json` - 日本語翻訳ファイル
- `archive/prototype/src/locales/en.json` - 英語翻訳ファイル

---

**注意**: CLIは英語のみのため、CLI関連の翻訳キーは不要。

