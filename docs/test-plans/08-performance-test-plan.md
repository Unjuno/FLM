# パフォーマンステスト計画書（Performance Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: パフォーマンステスト（Performance Test）
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

パフォーマンステストは、負荷・応答時間・スループットなどの性能を検証するテストです。システムが期待される性能要件を満たしていることを確認し、ボトルネックを特定します。

### 1.2 対象範囲

- IPC通信の応答時間
- データベース操作の応答時間
- APIリクエストの応答時間
- 大量データの処理性能
- メモリ使用量
- CPU使用量
- 同時接続数の処理能力

### 1.3 テストフレームワーク

- **フレームワーク**: Jest + カスタムパフォーマンス測定
- **推奨ツール**: JMeter、Locust
- **現状**: Jestベースのパフォーマンステスト

---

## 2. 既存の実装状況

### 2.1 既存のパフォーマンステストファイル

以下のパフォーマンステストが既に実装されています：

- `tests/performance/performance.test.ts` - パフォーマンステスト

---

## 3. テスト対象とテスト項目

### 3.1 IPC通信のパフォーマンス

**対象機能**: フロントエンドとバックエンドの通信

**テスト項目**:
- 単一リクエストの応答時間
- 複数同時リクエストの処理
- 大量リクエストの処理

**既存テスト**:
```typescript
describe('IPC通信のパフォーマンス', () => {
  it('should respond to get_app_info within 100ms', async () => {
    const startTime = Date.now();
    await invoke('get_app_info');
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(100);
  });

  it('should handle multiple concurrent IPC requests efficiently', async () => {
    const requestCount = 10;
    const startTime = Date.now();
    
    const requests = Array(requestCount).fill(null).map(() => 
      invoke('get_app_info')
    );

    await Promise.all(requests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / requestCount;

    expect(averageTime).toBeLessThan(200);
  });
});
```

**実装ファイル**: `tests/performance/performance.test.ts`

### 3.2 データベース操作のパフォーマンス

**対象機能**: データベースの読み書き操作

**テスト項目**:
- API一覧取得の応答時間
- API詳細取得の応答時間
- API作成の応答時間
- 大量データの取得性能

**既存テスト**:
```typescript
describe('データベース操作のパフォーマンス', () => {
  it('should retrieve API list within acceptable time', async () => {
    const startTime = Date.now();
    await invoke('list_apis');
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(500);
  });

  it('should retrieve API details quickly', async () => {
    const apis = await invoke<Array<{ id: string }>>('list_apis');
    
    if (apis.length > 0) {
      const apiId = apis[0].id;
      const startTime = Date.now();
      await invoke('get_api_details', { api_id: apiId });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(300);
    }
  });
});
```

**実装ファイル**: `tests/performance/performance.test.ts`

### 3.3 APIリクエストのパフォーマンス

**対象機能**: 作成されたAPIのエンドポイント

**テスト項目**:
- チャットAPIの応答時間
- ストリーミングレスポンスの処理性能
- 同時リクエストの処理能力
- 負荷テスト

**テスト例**:
```typescript
describe('API Request Performance', () => {
  it('should respond to chat completion within acceptable time', async () => {
    const startTime = Date.now();
    const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3:8b',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status).toBe(200);
    // レスポンス時間は30秒以内（LLMの処理時間を考慮）
    expect(responseTime).toBeLessThan(30000);
  });

  it('should handle concurrent requests', async () => {
    const requestCount = 5;
    const startTime = Date.now();

    const requests = Array(requestCount).fill(null).map(() =>
      fetch(`${apiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama3:8b',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })
    );

    await Promise.all(requests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // 同時リクエストの処理時間が許容範囲内であること
    expect(totalTime).toBeLessThan(60000);
  });
});
```

### 3.4 大量データの処理性能

**対象機能**: 大量のログ、APIデータの処理

**テスト項目**:
- 大量ログの取得性能
- 大量APIの一覧取得性能
- 大量モデルの一覧取得性能

**既存テスト**:
```typescript
describe('大量データのパフォーマンス', () => {
  it('should handle retrieving many installed models efficiently', async () => {
    const startTime = Date.now();
    await invoke('get_installed_models');
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(500);
  });
});
```

**実装ファイル**: `tests/performance/performance.test.ts`

### 3.5 メモリ使用量の監視

**対象機能**: アプリケーション全体のメモリ使用量

**テスト項目**:
- メモリリークの検出
- 繰り返し操作後のメモリ使用量
- 長時間動作時のメモリ使用量

**既存テスト**:
```typescript
describe('メモリ使用量の監視', () => {
  it('should not cause memory leaks in repeated operations', async () => {
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      await invoke('list_apis');
    }

    // メモリリークがないことを確認（応答時間が一定である）
    const startTime = Date.now();
    await invoke('list_apis');
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(responseTime).toBeLessThan(500);
  });
});
```

**実装ファイル**: `tests/performance/performance.test.ts`

### 3.6 CPU使用量の監視

**対象機能**: アプリケーション全体のCPU使用量

**テスト項目**:
- 高負荷時のCPU使用量
- アイドル状態のCPU使用量
- CPU使用率の推移

---

## 4. パフォーマンス基準

### 4.1 応答時間の基準

| 操作 | 目標応答時間 | 許容応答時間 |
|------|------------|------------|
| IPC通信（単一） | 100ms | 200ms |
| IPC通信（複数同時） | 200ms | 500ms |
| データベース読み取り | 300ms | 500ms |
| データベース書き込み | 500ms | 1000ms |
| APIリクエスト（チャット） | 30秒 | 60秒 |

### 4.2 スループットの基準

| 操作 | 目標スループット | 許容スループット |
|------|----------------|----------------|
| IPC通信 | 100 req/s | 50 req/s |
| APIリクエスト | 10 req/s | 5 req/s |

### 4.3 リソース使用量の基準

| リソース | 目標値 | 許容値 |
|---------|--------|--------|
| メモリ使用量 | 500MB | 1GB |
| CPU使用率（アイドル） | 5% | 10% |
| CPU使用率（高負荷） | 50% | 80% |

---

## 5. テスト実装方針

### 5.1 パフォーマンス測定の実装

```typescript
// パフォーマンス測定ヘルパー関数
async function measurePerformance<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await operation();
  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`${operationName} took ${duration}ms`);

  return { result, duration };
}

// 使用例
describe('Performance Test', () => {
  it('should measure operation performance', async () => {
    const { duration } = await measurePerformance(
      () => invoke('list_apis'),
      'List APIs'
    );

    expect(duration).toBeLessThan(500);
  });
});
```

### 5.2 負荷テストの実装

```typescript
// 負荷テストヘルパー関数
async function loadTest(
  operation: () => Promise<any>,
  concurrency: number,
  iterations: number
): Promise<{ averageTime: number; minTime: number; maxTime: number }> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const batch = Array(concurrency).fill(null).map(async () => {
      const startTime = Date.now();
      await operation();
      const endTime = Date.now();
      return endTime - startTime;
    });

    const batchTimes = await Promise.all(batch);
    times.push(...batchTimes);
  }

  const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return { averageTime, minTime, maxTime };
}
```

---

## 6. テスト実行方法

### 6.1 パフォーマンステストを実行

```bash
npm run test:performance
```

### 6.2 JMeterを使用する場合

1. JMeterテスト計画の作成
2. スレッドグループの設定
3. HTTPリクエストの設定
4. リスナーの追加（結果の可視化）
5. テストの実行

### 6.3 Locustを使用する場合

```python
# locustfile.py
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def chat_completion(self):
        self.client.post(
            "/v1/chat/completions",
            json={
                "model": "llama3:8b",
                "messages": [{"role": "user", "content": "Hello"}]
            },
            headers={"Authorization": "Bearer YOUR_API_KEY"}
        )
```

```bash
# Locustの実行
locust -f locustfile.py --host=http://localhost:8080
```

---

## 7. テスト実装優先順位

### 優先度: 高

1. **IPC通信のパフォーマンス**
   - 基本的な操作の応答時間
   - 既に実装済み

2. **データベース操作のパフォーマンス**
   - データ読み書きの応答時間
   - 既に実装済み

### 優先度: 中

3. **APIリクエストのパフォーマンス**
   - APIエンドポイントの応答時間
   - 負荷テスト

4. **メモリ使用量の監視**
   - メモリリークの検出
   - 既に実装済み

### 優先度: 低

5. **CPU使用量の監視**
   - CPU使用率の測定

---

## 8. パフォーマンス最適化の指針

### 8.1 ボトルネックの特定

- プロファイリングツールの使用
- パフォーマンス測定結果の分析
- ボトルネックの特定と最適化

### 8.2 最適化の実施

- データベースクエリの最適化
- キャッシュの導入
- 非同期処理の最適化
- メモリ使用量の最適化

---

## 9. CI/CDへの統合

### 9.1 自動実行

- 定期的なパフォーマンステストの実行
- パフォーマンス回帰の検出

### 9.2 パフォーマンスレポート

- パフォーマンス測定結果の記録
- パフォーマンストレンドの可視化

---

## 10. トラブルシューティング

### 10.1 よくある問題

**問題**: テストが不安定に失敗する
- **解決策**: テスト環境の安定化、リトライロジックの実装

**問題**: パフォーマンス測定結果が不正確
- **解決策**: 測定方法の改善、外部要因の排除

---

## 11. 参考資料

- 既存のパフォーマンステストファイル（`tests/performance/performance.test.ts`）
- [JMeter公式ドキュメント](https://jmeter.apache.org/usermanual/)
- [Locust公式ドキュメント](https://docs.locust.io/)
- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)

