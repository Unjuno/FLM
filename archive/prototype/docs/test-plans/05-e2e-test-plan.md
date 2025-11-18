# E2Eテスト計画書（End-to-End Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: E2Eテスト（End-to-End Test）
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

E2Eテストは、ユーザー視点での操作フローを検証するテストです。システム全体をユーザーの実際の使用シナリオに沿ってテストし、エンドツーエンドで正常に動作することを確認します。

### 1.2 対象範囲

- ユーザー操作フローの検証
- ブラウザ操作の自動化（Web版の場合）
- モバイル操作の自動化（将来対応）
- システム全体の動作確認

### 1.3 テストフレームワーク

- **フレームワーク**: Jest + jsdom
- **推奨ツール**: Selenium、Appium、BrowserStack
- **現状**: JestベースのE2Eテスト

---

## 2. 既存の実装状況

### 2.1 既存のE2Eテストファイル

以下のE2Eテストが既に実装されています：

- `tests/e2e/complete-api-flow.test.ts` - 完全なAPIフローのE2Eテスト
- `tests/e2e/complete-features-e2e.test.ts` - 完全機能のE2Eテスト
- `tests/e2e/api-creation-flow.test.ts` - API作成フローのE2Eテスト
- `tests/e2e/f006-logs-display.test.ts` - ログ表示機能のE2Eテスト
- `tests/e2e/f007-performance-dashboard.test.ts` - パフォーマンスダッシュボードのE2Eテスト
- `tests/e2e/f008-log-deletion.test.ts` - ログ削除機能のE2Eテスト
- `tests/e2e/f008-website.test.ts` - 公式WebサイトのE2Eテスト
- `tests/e2e/logs-display.test.ts` - ログ表示のE2Eテスト
- `tests/e2e/performance-dashboard.test.ts` - パフォーマンスダッシュボードのE2Eテスト
- `tests/e2e/ollama-auto-start.test.ts` - Ollama自動起動のE2Eテスト

---

## 3. テスト対象とテスト項目

### 3.1 完全なAPI作成から利用までのフロー

**対象機能**: F001, F002, F003

**テスト項目**:
1. アプリ起動
   - アプリケーションの起動確認
   - ホーム画面の表示確認
2. Ollama検出・起動
   - Ollamaの検出確認
   - Ollamaの自動起動（必要な場合）
3. モデル選択
   - モデル一覧の取得
   - モデル選択
4. API作成
   - 設定入力
   - API作成の実行
   - 作成完了の確認
5. API起動
   - API起動の実行
   - 起動状態の確認
6. API利用
   - チャットインターフェースの表示
   - APIリクエストの送信
   - レスポンスの受信
7. API停止・削除
   - API停止の実行
   - API削除の実行

**実装ファイル**: `tests/e2e/complete-api-flow.test.ts`

### 3.2 モデル管理フロー

**対象機能**: F004

**テスト項目**:
1. モデル管理画面への遷移
2. モデル検索
   - 検索バーでの検索
   - フィルタリング
3. モデルダウンロード
   - ダウンロードボタンのクリック
   - 進捗状況の確認
   - ダウンロード完了の確認
4. モデル削除
   - 削除ボタンのクリック
   - 削除確認

**実装ファイル**: `tests/e2e/complete-features-e2e.test.ts`

### 3.3 ログ表示フロー

**対象機能**: F006

**テスト項目**:
1. ログ画面への遷移
2. ログ一覧の表示
3. ログフィルタリング
   - 日付フィルタ
   - ステータスコードフィルタ
4. ログ詳細の表示
5. ログエクスポート
6. ログ削除

**実装ファイル**: 
- `tests/e2e/f006-logs-display.test.ts`
- `tests/e2e/logs-display.test.ts`

### 3.4 パフォーマンス監視フロー

**対象機能**: F007

**テスト項目**:
1. パフォーマンスダッシュボードへの遷移
2. パフォーマンスデータの表示
   - レスポンスタイムグラフ
   - リクエスト数グラフ
   - エラー率グラフ
3. 統計情報の表示
4. アラート設定
5. アラート履歴の表示

**実装ファイル**: 
- `tests/e2e/f007-performance-dashboard.test.ts`
- `tests/e2e/performance-dashboard.test.ts`

### 3.5 ログ削除フロー

**対象機能**: F008

**テスト項目**:
1. ログ削除画面への遷移
2. 削除対象の選択
3. 削除確認ダイアログ
4. 削除の実行
5. 削除完了の確認

**実装ファイル**: `tests/e2e/f008-log-deletion.test.ts`

### 3.6 公式Webサイトフロー

**対象機能**: F008

**テスト項目**:
1. Webサイトの表示
2. 各ページへの遷移
   - ホームページ
   - 機能紹介ページ
   - ダウンロードページ
   - FAQページ
3. フォーム操作
4. リンクの動作確認

**実装ファイル**: `tests/e2e/f008-website.test.ts`

### 3.7 Ollama自動起動フロー

**対象機能**: F009

**テスト項目**:
1. Ollama検出
2. Ollama自動起動
3. 起動状態の確認
4. モデル一覧の取得

**実装ファイル**: `tests/e2e/ollama-auto-start.test.ts`

---

## 4. テスト実装方針

### 4.1 テストの構造

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

describe('E2E Test: Complete API Flow', () => {
  let createdApiId: string | null = null;

  beforeAll(() => {
    // テスト前の初期化処理
  });

  afterAll(async () => {
    // テストで作成したリソースのクリーンアップ
    if (createdApiId) {
      try {
        await invoke('delete_api', { api_id: createdApiId });
      } catch (error) {
        // クリーンアップエラーは警告のみ
      }
    }
  });

  it('should complete full API lifecycle', async () => {
    // E2Eテストコード
    // 1. アプリ起動
    // 2. モデル選択
    // 3. API作成
    // 4. API起動
    // 5. API利用
    // 6. API削除
  });
});
```

### 4.2 テスト環境の要件

- **Tauriアプリケーション**: E2EテストはTauriアプリが起動している必要がある
- **Ollama**: モデル管理テストはOllamaがインストールされている必要がある
- **データベース**: テスト用のデータベースを使用

### 4.3 クリーンアップ処理

- 各テストで作成したリソース（API、ログなど）は必ずクリーンアップ
- `afterAll`で一括クリーンアップ
- クリーンアップエラーは警告のみ（テスト失敗にはしない）

---

## 5. テスト実行方法

### 5.1 すべてのE2Eテストを実行

```bash
npm run test:e2e
```

### 5.2 ウォッチモードで実行

```bash
npm run test:watch -- tests/e2e
```

### 5.3 特定のテストファイルを実行

```bash
npm test -- tests/e2e/complete-api-flow.test.ts
```

### 5.4 Tauriアプリと一緒に実行

E2EテストはTauriアプリが起動している必要があります：

```bash
# Tauriアプリを起動してから
npm run test:e2e
```

---

## 6. テスト実装優先順位

### 優先度: 高

1. **完全なAPI作成から利用までのフロー**
   - 最も重要なユーザーシナリオ
   - 既に実装済み（`complete-api-flow.test.ts`）

2. **モデル管理フロー**
   - 主要機能の動作確認
   - 既に実装済み（`complete-features-e2e.test.ts`）

### 優先度: 中

3. **ログ表示フロー**
   - ログ機能の動作確認
   - 既に実装済み（`f006-logs-display.test.ts`）

4. **パフォーマンス監視フロー**
   - パフォーマンス機能の動作確認
   - 既に実装済み（`f007-performance-dashboard.test.ts`）

### 優先度: 低

5. **公式Webサイトフロー**
   - Webサイトの動作確認
   - 既に実装済み（`f008-website.test.ts`）

---

## 7. テスト品質基準

### 7.1 テストの品質指標

- **完全性**: 主要なユーザーシナリオを網羅していること
- **再現性**: 同じ条件下で常に同じ結果が得られること
- **独立性**: 各テストは独立して実行可能であること
- **保守性**: コード変更に伴いテストも容易に更新できること

### 7.2 エラーハンドリング

- Tauriアプリが起動していない場合のエラーハンドリング
- Ollamaがインストールされていない場合のエラーハンドリング
- ネットワークエラーのハンドリング

---

## 8. ブラウザ自動化（Web版の場合）

### 8.1 Seleniumを使用する場合

```bash
# Seleniumのインストール
npm install --save-dev selenium-webdriver

# WebDriverの設定
# ChromeDriver、GeckoDriverなどのインストール
```

### 8.2 Playwrightを使用する場合

```bash
# Playwrightのインストール
npm install --save-dev @playwright/test

# ブラウザのインストール
npx playwright install
```

---

## 9. CI/CDへの統合

### 9.1 自動実行

- プルリクエスト作成時に自動実行
- マージ前に必須チェック（オプション）

### 9.2 テスト環境

- CI/CD環境ではTauriアプリのモックを使用
- 実際のOllamaとの連携テストは手動実行

---

## 10. トラブルシューティング

### 10.1 よくある問題

**問題**: Tauriアプリが起動していないエラー
- **解決策**: テストをスキップするか、エラーメッセージを確認して適切に処理

**問題**: テストが不安定に失敗する
- **解決策**: テストの待機時間を適切に設定、リトライロジックの実装

**問題**: データベースの競合
- **解決策**: 各テストで一意のリソースIDを使用、テスト後にクリーンアップ

---

## 11. 参考資料

- 既存のE2Eテストファイル（`tests/e2e/`）
- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- [Selenium公式ドキュメント](https://www.selenium.dev/documentation/)
- [Appium公式ドキュメント](https://appium.io/docs/)
- [BrowserStack公式ドキュメント](https://www.browserstack.com/docs/)
