# 現在の実装状況

> Updated: 2025-02-01

## プロキシ自動起動機能の実装状況

### 1. プロキシステータスの読み込み (`loadProxyStatus`)

**場所**: `src/pages/Home.tsx:164-204`

**実装内容**:
- `Promise<ProxyStatus | null>`を返すように修正済み
- `ipc_proxy_status`を呼び出してプロキシの状態を取得
- 結果を`handleProxyStatusResult`で処理し、`proxyStatus`ステートを更新
- エラー時は`{ running: false }`を返す

**コード**:
```typescript
const loadProxyStatus = useCallback(async (): Promise<ProxyStatus | null> => {
  try {
    const result = await safeInvoke<{ version?: string; data?: Array<{ running: boolean; port?: number; mode?: ProxyMode }> }>(
      'ipc_proxy_status'
    );
    handleProxyStatusResult(result);
    // ... エラーハンドリング ...
    // 結果を返す（自動起動の判断に使用）
    if (isProxyStatusResult(result)) {
      const handles = result.data;
      if (handles && handles.length > 0) {
        const handle = handles[0];
        return {
          running: handle.running ?? false,
          port: handle.port,
          mode: handle.mode,
        };
      }
    }
    // ... フォールバック処理 ...
    return { running: false };
  } catch (err) {
    // ... エラーハンドリング ...
    return { running: false };
  }
}, [handleProxyStatusResult, handleProxyStatusError]);
```

### 2. 初期化処理（プロキシステータスとエンジンの読み込み）

**場所**: `src/pages/Home.tsx:370-384`

**実装内容**:
- アプリ起動時に`loadProxyStatus()`と`loadEngines()`を呼び出す
- 30秒ごとにプロキシステータスを自動更新

**コード**:
```typescript
useEffect(() => {
  void loadProxyStatus();
  void loadEngines();

  // 定期的にステータスを更新
  const statusInterval = setInterval(() => {
    void loadProxyStatus();
  }, TIMING.STATUS_POLL_INTERVAL_MS); // 30000ms = 30秒

  return () => {
    clearInterval(statusInterval);
    clearAllTimeouts(timeoutRef);
  };
}, [loadProxyStatus, loadEngines]);
```

### 3. プロキシ自動起動機能

**場所**: `src/pages/Home.tsx:386-423`

**実装内容**:
- `proxyStatus`の変更を監視する`useEffect`
- `proxyStatus !== null && !proxyStatus.running`の場合、自動的にプロキシを起動
- 1秒の遅延を設けて、初回ロード完了を待つ
- 自動起動に失敗しても、エラーはログに記録するのみ（ユーザーには表示しない）

**コード**:
```typescript
useEffect(() => {
  const autoStartProxy = async () => {
    // プロキシの状態が確定してから実行（初回ロード完了を待つ）
    // proxyStatusがnullの場合はまだロード中なので、スキップ
    if (proxyStatus !== null && !proxyStatus.running) {
      try {
        await safeInvoke('ipc_proxy_start', {
          mode: DEFAULT_PROXY_CONFIG.MODE, // 'dev-selfsigned'
          port: DEFAULT_PROXY_CONFIG.PORT,  // 8080
          no_daemon: true,
        });
        // 起動後、ステータスを更新
        setTimeout(() => {
          void loadProxyStatus();
        }, TIMING.STATUS_REFRESH_DELAY_MS); // 1000ms = 1秒
      } catch (err) {
        // 自動起動に失敗した場合、エラーをログに記録するが、ユーザーには表示しない
        logger.warn('Failed to auto-start proxy:', err);
      }
    }
  };
  
  // 少し遅延させて実行（初回ロードが完了するのを待つ）
  const timeoutId = setTimeout(() => {
    void autoStartProxy();
  }, 1000);
  
  return () => {
    clearTimeout(timeoutId);
  };
}, [proxyStatus, loadProxyStatus]);
```

### 4. デフォルト設定

**場所**: `src/config/constants.ts:24-27`

**設定値**:
```typescript
export const DEFAULT_PROXY_CONFIG = {
  MODE: 'dev-selfsigned' as const,
  PORT: 8080,
} as const;
```

## 動作フロー

1. **アプリケーション起動時**
   - `useEffect`（370行目）が実行される
   - `loadProxyStatus()`と`loadEngines()`が呼び出される
   - `proxyStatus`が`null`から実際の状態に更新される

2. **プロキシステータスの更新後**
   - `useEffect`（390行目）が`proxyStatus`の変更を検知
   - 1秒の遅延後、`autoStartProxy()`が実行される
   - `proxyStatus !== null && !proxyStatus.running`の場合、自動起動を試みる

3. **自動起動の試行**
   - `ipc_proxy_start`を呼び出し、デフォルト設定でプロキシを起動
   - 起動成功後、1秒後にステータスを更新
   - 起動失敗時は、エラーをログに記録するのみ

## 潜在的な問題点

### 1. タイミングの問題

現在の実装では、`proxyStatus`の変更を監視して自動起動を試みていますが、以下の問題があります：

- **問題**: `proxyStatus`が`null`から`{ running: false }`に更新されるまでのタイミングが不確実
- **現在の対策**: 1秒の遅延を設けているが、これでは不十分な場合がある可能性

### 2. より確実な実装方法

`loadProxyStatus()`の戻り値を直接使用する方が確実です：

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

## ChatTesterページでのエラー表示

**場所**: `src/pages/ChatTester.tsx:45-62`

**実装内容**:
- `getProxyEndpoint()`が`null`を返す場合、エラーメッセージを表示
- これは正常な動作だが、プロキシが自動起動されるまでの間、エラーが表示される可能性がある

**コード**:
```typescript
const loadProxyEndpoint = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const endpoint = await getProxyEndpoint();
    setProxyEndpoint(endpoint);
    if (!endpoint) {
      setError(t('chatTester.proxyNotRunning')); // 「プロキシが実行されていません」
    }
  } catch (err) {
    // ... エラーハンドリング ...
  } finally {
    setLoading(false);
  }
}, [handleProxyEndpointError]);
```

## まとめ

### 現在の実装の状態

✅ **実装済み**:
- プロキシステータスの読み込み機能
- プロキシ自動起動機能（`proxyStatus`の変更を監視）
- エラーハンドリング（自動起動失敗時はログに記録）

⚠️ **改善の余地**:
- タイミングの問題（1秒の遅延では不十分な場合がある）
- `loadProxyStatus()`の戻り値を直接使用する方が確実

### 推奨される改善

`loadProxyStatus()`の戻り値を直接使用して、より確実に自動起動を実装することを推奨します。

