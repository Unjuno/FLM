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

## トラブルシューティング

### Tauriコマンドが見つからない
- Tauriアプリケーションが起動していることを確認してください
- `src-tauri/src/lib.rs`でコマンドが登録されていることを確認してください

### タイムアウトエラー
- テストのタイムアウト時間を延長してください（例: `it('test', async () => { ... }, 30000);`）
- ネットワーク接続を確認してください（Ollama API呼び出しなど）

### データベースエラー
- テスト環境用のデータベースが正しく初期化されていることを確認してください
- テスト間でデータが干渉しないように、適切にクリーンアップしてください

