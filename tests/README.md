# FLM - テストドキュメント

## テスト構成

このプロジェクトでは、Jestを使用してテストを実行します。

### テストの種類

1. **単体テスト** (`tests/unit/`)
   - 個別の機能モジュールのテスト
   - 例: `api-commands.test.ts`, `ipc.test.ts`

2. **統合テスト** (`tests/integration/`)
   - 複数モジュール間の統合テスト
   - 例: `f001-api-creation.test.ts`, `f003-api-management.test.ts`, `f004-model-management.test.ts`, `multi-engine.test.ts`

3. **E2Eテスト** (`tests/e2e/`)
   - エンドツーエンドのフローテスト
   - 例: `api-creation-flow.test.ts`

4. **パフォーマンステスト** (`tests/performance/`)
   - アプリケーションのパフォーマンステスト
   - 例: `performance.test.ts`

5. **セキュリティテスト** (`tests/security/`)
   - セキュリティ関連のテスト
   - 例: `security.test.ts`

## テストの実行

### すべてのテストを実行
```bash
npm test
```

### ウォッチモードで実行
```bash
npm run test:watch
```

### カバレッジレポートを生成
```bash
npm run test:coverage
```

### 統合テストのみ実行
```bash
npm run test:integration
```

### E2Eテストのみ実行
```bash
npm run test:e2e
```

### パフォーマンステストのみ実行
```bash
npm run test:performance
```

### セキュリティテストのみ実行
```bash
npm run test:security
```

## テストの書き方

### 基本構造
```typescript
import { describe, it, expect } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

describe('機能名', () => {
  it('should do something', async () => {
    const result = await invoke('command_name', { param: 'value' });
    expect(result).toBeDefined();
  });
});
```

### 注意事項

1. **Tauri環境が必要**: 実際のTauriアプリケーションが起動している必要があります
2. **非同期処理**: IPCコマンドは非同期なので、`async/await`を使用します
3. **タイムアウト設定**: 長時間かかるテストは、タイムアウト時間を適切に設定してください
4. **クリーンアップ**: テストで作成したリソース（API、モデルなど）は`afterAll`でクリーンアップしてください

## カバレッジ目標

目標カバレッジ: **80%以上**

カバレッジレポートは `coverage/` ディレクトリに生成されます。

## ベストプラクティス

### テストヘルパーの使用

監査レポートの推奨事項に基づき、共通のテストヘルパー関数を使用してください：

```typescript
import { 
  checkTauriAvailable, 
  skipIfTauriNotAvailable,
  createTestApi,
  cleanupTestApis,
  waitForApiStart,
  waitForApiStop,
  handleTauriAppNotRunningError,
  safeInvokeWithErrorHandling
} from '../setup/test-helpers';

// Tauriアプリが利用可能かチェック
const isAvailable = await checkTauriAvailable();

// API作成とクリーンアップ
const apiId = await createTestApi({ name: 'Test API', ... });
await cleanupTestApis([apiId]);

// 固定待機時間の代わりに状態を待つ
await waitForApiStart(apiId);
```

### 固定待機時間の回避

**❌ 悪い例**:
```typescript
await invoke('start_api', { api_id: apiId });
await new Promise(resolve => setTimeout(resolve, 2000)); // 固定待機時間
```

**✅ 良い例**:
```typescript
await invoke('start_api', { api_id: apiId });
await waitForApiStart(apiId); // 状態を待つ
```

### デバッグログの使用

監査レポートの推奨事項に基づき、統一されたデバッグログ機能を使用してください：

```typescript
import { debugLog, debugWarn, debugError } from '../setup/debug';

debugLog('テスト開始');
debugWarn('警告メッセージ');
debugError('エラーメッセージ');
```

デバッグログは`JEST_DEBUG=1`環境変数が設定されている場合のみ出力されます。

### エラーハンドリング

適切なエラーハンドリングを実装してください：

```typescript
try {
  const result = await invoke('command', args);
  expect(result).toBeDefined();
} catch (error) {
  if (handleTauriAppNotRunningError(error)) {
    // Tauriアプリが起動していない場合はテストをスキップ
    return;
  }
  throw error;
}
```

## トラブルシューティング

### Tauriコマンドが見つからない
- Tauriアプリケーションが起動していることを確認してください
- `src-tauri/src/lib.rs`でコマンドが登録されていることを確認してください
- `checkTauriAvailable()`を使用してアプリの可用性をチェックしてください

### タイムアウトエラー
- テストのタイムアウト時間を延長してください（例: `it('test', async () => { ... }, 30000);`）
- ネットワーク接続を確認してください（Ollama API呼び出しなど）
- 固定待機時間の代わりに`waitForApiStart()`などの状態待機関数を使用してください

### データベースエラー
- テスト環境用のデータベースが正しく初期化されていることを確認してください
- テスト間でデータが干渉しないように、適切にクリーンアップしてください
- `cleanupTestApis()`などのクリーンアップヘルパーを使用してください

### テストが不安定
- 固定待機時間を使用していないか確認してください
- 状態を待つヘルパー関数（`waitForApiStart()`など）を使用してください
- テスト間でリソースが適切にクリーンアップされているか確認してください

## テストの種類別ガイドライン

### 単体テスト
- モックを使用して外部依存を排除
- 高速に実行できるようにする
- 各テストは独立している必要がある

### 統合テスト
- 実際のTauriアプリケーションが必要
- `skipIfTauriNotAvailable()`を使用してTauriアプリが利用できない場合はスキップ
- テスト後にリソースをクリーンアップ

### E2Eテスト
- 完全なユーザーフローをテスト
- より長いタイムアウト時間を設定
- 実際の環境に近い状態でテスト

