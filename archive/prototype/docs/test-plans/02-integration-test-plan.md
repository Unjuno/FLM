# 結合テスト計画書（Integration Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: 結合テスト（Integration Test）
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

結合テストは、複数のモジュール間の連携を検証するテストです。API連携、データベース接続、フロントエンドとバックエンドの通信など、システムの各コンポーネントが正しく連携することを確認します。

### 1.2 対象範囲

- フロントエンドとバックエンドのIPC通信
- データベース操作とデータ永続化
- API作成から起動までのフロー
- 認証プロキシとの連携
- Ollamaとの連携
- 複数エンジン（Ollama、LM Studio、vLLM）の連携

### 1.3 テストフレームワーク

- **フレームワーク**: Jest + ts-jest
- **環境**: Node.js環境（Tauriアプリが起動している必要がある場合がある）

---

## 2. 既存の実装状況

### 2.1 既存の結合テストファイル

以下の結合テストが既に実装されています：

- `tests/integration/api-integration.test.ts` - API統合テスト
- `tests/integration/f001-api-creation.test.ts` - API作成機能の統合テスト
- `tests/integration/f003-api-management.test.ts` - API管理機能の統合テスト
- `tests/integration/f004-model-management.test.ts` - モデル管理機能の統合テスト
- `tests/integration/f006-log-display.test.ts` - ログ表示機能の統合テスト
- `tests/integration/f007-performance-monitoring.test.ts` - パフォーマンス監視の統合テスト
- `tests/integration/f008-log-deletion.test.ts` - ログ削除機能の統合テスト
- `tests/integration/auth-proxy.test.ts` - 認証プロキシの統合テスト
- `tests/integration/auth-proxy-security.test.ts` - 認証プロキシセキュリティの統合テスト
- `tests/integration/certificate-generation.test.ts` - 証明書生成の統合テスト
- `tests/integration/certificate-auto-generation.test.ts` - 証明書自動生成の統合テスト
- `tests/integration/certificate-integration.test.ts` - 証明書統合テスト
- `tests/integration/ollama-auto-start.test.ts` - Ollama自動起動の統合テスト
- `tests/integration/ollama-install.test.ts` - Ollamaインストールの統合テスト
- `tests/integration/ollama-installation.test.ts` - Ollamaインストールの統合テスト
- `tests/integration/performance-monitoring.test.ts` - パフォーマンス監視の統合テスト
- `tests/integration/multi-engine.test.ts` - マルチエンジンの統合テスト
- `tests/integration/project-init.test.ts` - プロジェクト初期化の統合テスト

---

## 3. テスト対象とテスト項目

### 3.1 API作成から起動までの統合テスト

**対象機能**: F001 - API作成機能

**テスト項目**:
- API作成フロー全体の検証
  - モデル選択 → 設定入力 → API作成 → データベース保存
- データベースへの保存確認
  - API情報が正しく保存されること
  - APIキーが暗号化されて保存されること
- API起動フロー
  - 認証プロキシの起動確認
  - ポート番号の競合チェック
  - エラーハンドリング

**実装ファイル**: `tests/integration/f001-api-creation.test.ts`

### 3.2 API管理機能の統合テスト

**対象機能**: F003 - API管理機能

**テスト項目**:
- API起動/停止の統合テスト
  - 起動状態の確認
  - 停止状態の確認
  - 複数APIの同時管理
- API設定変更の統合テスト
  - ポート番号の変更
  - 認証設定の変更
  - データベース更新の確認
- API削除の統合テスト
  - データベースからの削除
  - リソースのクリーンアップ

**実装ファイル**: `tests/integration/f003-api-management.test.ts`

### 3.3 モデル管理機能の統合テスト

**対象機能**: F004 - モデル管理機能

**テスト項目**:
- モデル検索と取得
  - Ollama APIとの連携
  - モデル情報の取得
- モデルダウンロード
  - ダウンロードプロセスの確認
  - 進捗状況の取得
- モデル削除
  - Ollamaからの削除確認

**実装ファイル**: `tests/integration/f004-model-management.test.ts`

### 3.4 認証プロキシの統合テスト

**対象機能**: F005 - 認証機能

**テスト項目**:
- APIキー生成と検証
  - APIキーの生成
  - Bearer Token認証の動作確認
  - 無効なAPIキーの拒否
- 認証プロキシとの連携
  - リクエストのプロキシ
  - 認証エラーの処理

**実装ファイル**: 
- `tests/integration/auth-proxy.test.ts`
- `tests/integration/auth-proxy-security.test.ts`

### 3.5 証明書生成の統合テスト

**対象機能**: HTTPS対応

**テスト項目**:
- 証明書の自動生成
  - 自己署名証明書の生成
  - 証明書の保存
- 証明書の検証
  - 証明書の読み込み
  - 証明書の有効性確認

**実装ファイル**: 
- `tests/integration/certificate-generation.test.ts`
- `tests/integration/certificate-auto-generation.test.ts`
- `tests/integration/certificate-integration.test.ts`

### 3.6 Ollama連携の統合テスト

**対象機能**: F009 - Ollama自動インストール

**テスト項目**:
- Ollama検出と起動
  - システムパス上のOllama検出
  - Ollamaの自動起動
  - 起動状態の確認
- Ollamaインストール
  - ポータブル版のダウンロード
  - インストールプロセス

**実装ファイル**: 
- `tests/integration/ollama-auto-start.test.ts`
- `tests/integration/ollama-install.test.ts`
- `tests/integration/ollama-installation.test.ts`

### 3.7 ログ機能の統合テスト

**対象機能**: F006 - ログ表示機能

**テスト項目**:
- ログの記録
  - APIリクエストログの保存
  - データベースへの記録
- ログの取得と表示
  - ログ一覧の取得
  - フィルタリング機能
  - ページネーション

**実装ファイル**: `tests/integration/f006-log-display.test.ts`

### 3.8 パフォーマンス監視の統合テスト

**対象機能**: F007 - パフォーマンス監視

**テスト項目**:
- パフォーマンスデータの収集
  - レスポンスタイムの記録
  - リクエスト数の記録
  - エラー率の記録
- データの集計と表示
  - 統計情報の計算
  - グラフデータの生成

**実装ファイル**: 
- `tests/integration/f007-performance-monitoring.test.ts`
- `tests/integration/performance-monitoring.test.ts`

### 3.9 マルチエンジンの統合テスト

**対象機能**: 複数エンジン対応

**テスト項目**:
- 複数エンジンの検出
  - Ollama、LM Studio、vLLMの検出
- エンジン間の切り替え
  - エンジン選択の動作確認
  - API作成時のエンジン指定

**実装ファイル**: `tests/integration/multi-engine.test.ts`

---

## 4. テスト実装方針

### 4.1 テストの構造

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

describe('統合テスト名', () => {
  let createdResources: string[] = [];

  beforeAll(() => {
    // テスト前の初期化処理
  });

  afterAll(async () => {
    // テストで作成したリソースのクリーンアップ
    for (const resourceId of createdResources) {
      try {
        await invoke('delete_resource', { id: resourceId });
      } catch (error) {
        // クリーンアップエラーは警告のみ
      }
    }
  });

  describe('サブ機能', () => {
    it('should integrate multiple components correctly', async () => {
      // 統合テストコード
      const result = await invoke('create_api', { config });
      expect(result).toBeDefined();
    });
  });
});
```

### 4.2 テスト環境の要件

- **Tauriアプリケーション**: 統合テストの一部はTauriアプリが起動している必要がある
- **Ollama**: モデル管理テストはOllamaがインストールされている必要がある
- **データベース**: テスト用のデータベースを使用（本番データを汚染しない）

### 4.3 クリーンアップ処理

- 各テストで作成したリソース（API、ログなど）は必ずクリーンアップ
- `afterAll`で一括クリーンアップ
- クリーンアップエラーは警告のみ（テスト失敗にはしない）

---

## 5. テスト実行方法

### 5.1 すべての結合テストを実行

```bash
npm run test:integration
```

### 5.2 ウォッチモードで実行

```bash
npm run test:watch -- tests/integration
```

### 5.3 特定のテストファイルを実行

```bash
npm test -- tests/integration/api-integration.test.ts
```

### 5.4 Tauriアプリと一緒に実行

一部の統合テストはTauriアプリが起動している必要があります：

```bash
# Tauriアプリを起動してから
npm run test:integration
```

---

## 6. テスト実装優先順位

### 優先度: 高

1. **API作成から起動までの統合テスト**
   - 最も重要な機能フローの検証
   - 既に実装済み（`f001-api-creation.test.ts`）

2. **認証プロキシの統合テスト**
   - セキュリティに関わる重要な機能
   - 既に実装済み（`auth-proxy.test.ts`）

3. **データベース操作の統合テスト**
   - データ永続化の検証
   - 既に実装済み（各種テストで含まれている）

### 優先度: 中

4. **モデル管理の統合テスト**
   - Ollamaとの連携確認
   - 既に実装済み（`f004-model-management.test.ts`）

5. **ログ機能の統合テスト**
   - ログの記録と取得の検証
   - 既に実装済み（`f006-log-display.test.ts`）

### 優先度: 低

6. **パフォーマンス監視の統合テスト**
   - データ収集と集計の検証
   - 既に実装済み（`f007-performance-monitoring.test.ts`）

---

## 7. テスト品質基準

### 7.1 テストの品質指標

- **独立性**: 各テストは独立して実行可能（データベースのクリーンアップが重要）
- **再現性**: 同じ条件下で常に同じ結果が得られること
- **完全性**: 主要な統合パスを網羅していること
- **保守性**: コード変更に伴いテストも容易に更新できること

### 7.2 エラーハンドリング

- Tauriアプリが起動していない場合のエラーハンドリング
- Ollamaがインストールされていない場合のエラーハンドリング
- ネットワークエラーのハンドリング

---

## 8. CI/CDへの統合

### 8.1 自動実行

- プルリクエスト作成時に自動実行
- マージ前に必須チェック

### 8.2 テスト環境

- CI/CD環境ではTauriアプリのモックを使用
- 実際のOllamaとの連携テストは手動実行

---

## 9. トラブルシューティング

### 9.1 よくある問題

**問題**: Tauriアプリが起動していないエラー
- **解決策**: テストをスキップするか、エラーメッセージを確認して適切に処理

**問題**: データベースの競合
- **解決策**: 各テストで一意のリソースIDを使用、テスト後にクリーンアップ

**問題**: Ollamaが起動していない
- **解決策**: テストをスキップするか、Ollamaを自動起動

---

## 10. 参考資料

- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- [Tauri APIドキュメント](https://tauri.app/api/)
- 既存の統合テストファイル（`tests/integration/`）

