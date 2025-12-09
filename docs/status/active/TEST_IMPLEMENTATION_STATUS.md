# テスト実装状況

> Status: Active | Updated: 2025-01-28

## 概要

TypeScript/React側のテスト環境をセットアップし、主要なコンポーネントとサービスのテストを実装しました。

## テスト環境

- **テストフレームワーク**: Vitest 1.0.4
- **テストライブラリ**: React Testing Library 14.1.2
- **環境**: jsdom
- **カバレッジ**: v8

## 実装済みテスト

### 1. サービス層のテスト

#### `src/services/__tests__/chatTester.test.ts`
- `fetchChatModels`: モデルリストの取得テスト
  - 正常なレスポンスの処理
  - HTTPエラーの処理
  - ネットワークエラーの処理
- `sendChatCompletion`: チャット完了リクエストのテスト
  - APIキー付きリクエスト
  - APIキーなしリクエスト
  - HTTPエラーの処理
- `getProxyEndpoint`: プロキシエンドポイント取得のテスト
  - プロキシ実行中のエンドポイント取得
  - プロキシ停止時のnull返却
  - ポートからURL構築

#### `src/services/__tests__/security.test.ts`
- `fetchAuditLogs`: 監査ログの取得テスト
  - 正常なレスポンスの処理
  - フィルター適用
  - データの正規化
- `fetchIntrusionAttempts`: 侵入検知イベントの取得テスト
  - 正常なレスポンスの処理
  - フィルター適用
  - データの正規化
- `fetchAnomalyDetections`: 異常検知イベントの取得テスト
  - 正常なレスポンスの処理
  - フィルター適用
  - データの正規化
- `fetchBlockedIps`: ブロックされたIPの取得テスト
  - 正常なレスポンスの処理
  - データの正規化
- `unblockIp`: IPブロック解除のテスト
- `clearTemporaryBlocks`: 一時ブロック一括解除のテスト

### 2. ページコンポーネントのテスト

#### `src/pages/__tests__/Home.test.tsx`
- ホームページのレンダリング
- プロキシステータスの表示（実行中/停止中）
- エンジン検出結果の表示
- プロキシ起動/停止ボタンの動作
- ナビゲーション機能
- エラーメッセージの表示
- プロキシモードのフォーマット
- エンジンステータスのフォーマット

#### `src/pages/__tests__/ChatTester.test.tsx`
- Chat Testerページのレンダリング
- プロキシ未実行時のエラー表示
- モデルリストの読み込み
- モデル読み込み失敗時のエラー表示
- メッセージ入力機能
- チャット完了リクエストの送信

#### `src/pages/__tests__/SecurityEvents.test.tsx`
- セキュリティイベントページのレンダリング
- タブ切り替え機能（監査ログ/侵入検知/異常検知）
- アクティブタブの表示切り替え
- タブのアクティブ状態の管理

#### `src/pages/__tests__/IpBlocklistManagement.test.tsx`
- IPブロックリスト管理ページのレンダリング
- ブロックされたIPの表示
- IPブロック解除機能
- 一時ブロック一括解除機能
- 確認ダイアログの表示
- エラーハンドリング
- 永続ブロックと一時ブロックの分類表示

### 3. 共通コンポーネントのテスト

#### `src/components/common/__tests__/ErrorMessage.test.tsx`
- エラーメッセージの表示
- 閉じるボタンの動作
- 詳細情報の表示/非表示

#### `src/components/common/__tests__/LoadingSpinner.test.tsx`
- ローディングスピナーの表示
- カスタムメッセージの表示
- サイズ指定（small/medium/large）

#### `src/components/common/__tests__/SuccessMessage.test.tsx`
- 成功メッセージの表示
- 閉じるボタンの動作
- 自動消去機能

#### `src/components/common/__tests__/ConfirmDialog.test.tsx`
- 確認ダイアログの表示
- 確認/キャンセルボタンの動作
- オーバーレイクリック時の動作
- カスタムテキストの使用
- 危険アクションのスタイル適用

### 3.5. レイアウトコンポーネントのテスト

#### `src/components/layout/__tests__/AppLayout.test.tsx`
- アプリケーションレイアウトのレンダリング
- 子要素の表示
- カスタムクラス名の適用

#### `src/components/layout/__tests__/Sidebar.test.tsx`
- サイドバーのレンダリング
- 折りたたみ機能
- ナビゲーション機能
- アクティブ状態の管理

### 3.6. セキュリティコンポーネントのテスト

#### `src/components/security/__tests__/AuditLogsView.test.tsx`
- 監査ログビューのレンダリング
- 監査ログの表示
- フィルター機能
- エラーハンドリング

#### `src/components/security/__tests__/IntrusionEventsView.test.tsx`
- 侵入検知イベントビューのレンダリング
- 侵入検知イベントの表示
- フィルター機能
- エラーハンドリング

#### `src/components/security/__tests__/AnomalyEventsView.test.tsx`
- 異常検知イベントビューのレンダリング
- 異常検知イベントの表示
- フィルター機能
- エラーハンドリング

#### `src/components/common/__tests__/ConfirmDialog.test.tsx`
- 確認ダイアログの表示
- 確認ボタンの動作
- キャンセルボタンの動作
- オーバーレイクリック時の動作
- カスタムテキストの使用
- 危険アクションのスタイル適用

### 4. ユーティリティ関数のテスト

#### `src/utils/__tests__/formatters.test.ts`
- `formatDateTime`: 日時フォーマット
- `formatDate`: 日付フォーマット
- `formatProxyMode`: プロキシモードのフォーマット（文字列/オブジェクト対応）
- `formatEngineStatus`: エンジンステータスのフォーマット（文字列/オブジェクト対応、レイテンシー/理由の表示）

#### `src/utils/__tests__/tauri.test.ts`
- `isTauriAvailable`: Tauri環境の検出
- `safeInvoke`: Tauriコマンドの安全な実行
  - Tauri未利用時のエラー処理
  - CLIエラーの拡張エラー情報
  - ネットワークエラーの処理
  - その他のエラーの処理
- `extractCliError`: CLIエラー情報の抽出

#### `src/utils/__tests__/timeout.test.ts`
- `setTimeoutRef`: タイムアウトの設定とrefへの保存
- `clearTimeoutRef`: タイムアウトのクリア
- `clearAllTimeouts`: すべてのタイムアウトのクリア

### 5. アプリケーションのテスト

#### `src/__tests__/App.test.tsx`
- メインアプリケーションコンポーネントのレンダリング
- ルーティング機能
- AppLayoutラッパー
- Suspense設定

#### `src/__tests__/routes.test.tsx`
- ルート定義の構造検証
- 各ルートの存在確認
- ルートパスの検証

## テスト実行コマンド

```bash
# ウォッチモードでテスト実行
npm test

# 一度だけテスト実行
npm run test:run

# UIモードでテスト実行
npm run test:ui

# カバレッジ付きでテスト実行
npm run test:coverage
```

## テストファイル構成

```
src/
├── services/
│   └── __tests__/
│       ├── chatTester.test.ts
│       └── security.test.ts
├── pages/
│   └── __tests__/
│       ├── Home.test.tsx
│       ├── ChatTester.test.tsx
│       ├── SecurityEvents.test.tsx
│       └── IpBlocklistManagement.test.tsx
├── components/
│   ├── common/
│   │   └── __tests__/
│   │       ├── ErrorMessage.test.tsx
│   │       ├── LoadingSpinner.test.tsx
│   │       ├── SuccessMessage.test.tsx
│   │       └── ConfirmDialog.test.tsx
│   ├── layout/
│   │   └── __tests__/
│   │       ├── AppLayout.test.tsx
│   │       └── Sidebar.test.tsx
│   └── security/
│       └── __tests__/
│           ├── AuditLogsView.test.tsx
│           ├── IntrusionEventsView.test.tsx
│           └── AnomalyEventsView.test.tsx
├── __tests__/
│   ├── App.test.tsx
│   └── routes.test.tsx
└── utils/
    └── __tests__/
        ├── formatters.test.ts
        ├── tauri.test.ts
        └── timeout.test.ts
```

## モック設定

### Tauri API モック
- `@tauri-apps/api/core`: `invoke`関数をモック
- `@tauri-apps/plugin-dialog`: `open`, `save`関数をモック
- `@tauri-apps/plugin-opener`: `open`関数をモック
- `window.__TAURI__`: グローバルオブジェクトをモック

### その他のモック
- `fetch`: グローバルfetchをモック
- `react-router-dom`: `useNavigate`をモック

### 6. IPCコマンドの統合テスト

#### `src/__tests__/ipc.integration.test.ts`
- `ipc_detect_engines`: エンジン検出のテスト
  - freshフラグ付き/なしの検出
  - CLIエラーの処理
- `ipc_list_models`: モデル一覧取得のテスト
  - 全モデル一覧取得
  - 特定エンジンのモデル一覧取得
- `ipc_proxy_start`: プロキシ起動のテスト
  - 最小設定での起動
  - 完全設定での起動
  - エラーハンドリング
- `ipc_proxy_status`: プロキシステータス取得のテスト
  - 実行中/停止中のステータス取得
- `ipc_proxy_stop`: プロキシ停止のテスト
  - ポート指定での停止
  - handle_id指定での停止
  - 無効なリクエストの処理
- `ipc_api_keys`: APIキー管理のテスト
  - 一覧取得、作成、取り消し
- `ipc_config`: 設定管理のテスト
  - 一覧取得、値取得、値設定
- `ipc_security`: セキュリティ機能のテスト
  - セキュリティポリシーの取得/設定
  - 監査ログの取得
- `get_platform`: プラットフォーム情報取得のテスト

## 今後の拡張予定

### 優先度: 高
- [x] `ChatTester.tsx`のテスト ✅
- [x] `SecurityEvents.tsx`のテスト ✅
- [x] `IpBlocklistManagement.tsx`のテスト ✅
- [x] IPCコマンドの統合テスト ✅

### 優先度: 中
- [x] `AppLayout.tsx`のテスト ✅
- [x] `Sidebar.tsx`のテスト ✅
- [x] `security.ts`サービスのテスト ✅
- [x] `ConfirmDialog.tsx`のテスト ✅

### 優先度: 低
- [ ] E2Eテストの追加
- [ ] Rust側のIPCコマンド実装のテスト

## 注意事項

1. **Tauri環境**: テストはTauri環境外で実行されるため、すべてのTauri APIはモックされています
2. **非同期処理**: `waitFor`を使用して非同期のUI更新を待機
3. **タイマー**: `SuccessMessage`の自動消去テストでは`vi.useFakeTimers()`を使用

## 参考

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Documentation](https://testing-library.com/react)
- [Testing Strategy](./TEST_STRATEGY.md)
