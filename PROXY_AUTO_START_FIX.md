# プロキシ自動起動機能の修正

## 問題の原因

アプリケーション起動時に「プロキシが起動していない」というメッセージが表示される問題がありました。

### 原因

1. **自動起動機能の実装不備**
   - `Home.tsx`の`useEffect`でプロキシの状態をチェックしているが、`loadProxyStatus()`が非同期関数のため、完了前に`proxyStatus`を参照していた
   - その結果、`proxyStatus`が`null`の状態でチェックされ、自動起動が実行されなかった

2. **エラーメッセージの表示**
   - `ChatTester.tsx`で`getProxyEndpoint()`が`null`を返すと、エラーメッセージが表示される
   - これは正常な動作だが、ユーザーにとっては混乱を招く可能性がある

## 修正内容

### 1. `loadProxyStatus()`の戻り値を追加

`loadProxyStatus()`関数を修正し、プロキシの状態を返すようにしました。これにより、呼び出し側で直接結果を使用できます。

```typescript
const loadProxyStatus = useCallback(async (): Promise<ProxyStatus | null> => {
  // ... 既存のコード ...
  return status; // プロキシの状態を返す
}, [handleProxyStatusResult, handleProxyStatusError]);
```

### 2. 自動起動ロジックの修正

`useEffect`内で`loadProxyStatus()`の結果を待ってから、自動起動を判断するように修正しました。

```typescript
useEffect(() => {
  const initializeApp = async () => {
    // プロキシの状態をチェック（結果を待つ）
    const status = await loadProxyStatus();
    
    // プロキシが起動していない場合、自動的に起動を試みる
    if (status && !status.running) {
      try {
        await safeInvoke('ipc_proxy_start', {
          mode: DEFAULT_PROXY_CONFIG.MODE,
          port: DEFAULT_PROXY_CONFIG.PORT,
          no_daemon: true,
        });
        // 起動後、ステータスを更新
        setTimeout(() => {
          void loadProxyStatus();
        }, TIMING.STATUS_REFRESH_DELAY_MS);
      } catch (err) {
        // 自動起動に失敗した場合、エラーをログに記録するが、ユーザーには表示しない
        logger.warn('Failed to auto-start proxy:', err);
      }
    }
    
    // エンジンの検出
    void loadEngines();
  };
  
  void initializeApp();
  // ... 定期的なステータス更新 ...
}, [loadProxyStatus, loadEngines]);
```

## 動作

1. **アプリケーション起動時**
   - プロキシの状態をチェック
   - プロキシが起動していない場合、自動的に起動を試みる
   - 起動に成功した場合、ステータスを更新

2. **エラーハンドリング**
   - 自動起動に失敗した場合、エラーをログに記録するが、ユーザーには表示しない
   - ユーザーは手動でプロキシを起動できる

## テスト

修正後、以下の動作を確認してください：

1. アプリケーションを起動
2. プロキシが自動的に起動することを確認
3. 「プロキシが起動していない」というメッセージが表示されないことを確認

## 注意事項

- 自動起動は「試みる」ものであり、失敗してもアプリは使用可能です
- ポート8080が既に使用されている場合など、自動起動が失敗する可能性があります
- その場合、ユーザーは手動でプロキシを起動する必要があります

