# ProxyService 実装 KYK（危険予知活動）

> Status: KYK Complete | Date: 2025-11-21

## 1. 実装範囲の確認

### 実装対象
- `ProxyService::start()` - AxumベースのHTTP(S)プロキシサーバー起動
- `ProxyService::stop()` - プロキシインスタンスの停止
- `ProxyService::status()` - 実行中のプロキシインスタンスの状態取得
- `flm proxy start/stop/status` コマンド実装
- プロキシ統合テスト実装

### 依存関係
- `flm-core`: Domain層（ProxyService, ProxyConfig, ProxyHandle）
- `flm-proxy`: Axumサーバー実装（ProxyController実装）
- `flm-cli`: CLIコマンド実装

## 2. 危険予知活動（KYK）

### 🔴 高リスク項目

#### 2.1 ランタイム再入問題
**問題**: 
- AxumサーバーをTokioランタイム内で起動する際、`block_on`によるランタイム再入が発生する可能性
- `ProxyController::start()`が同期的なメソッドだが、Axumサーバーは非同期で動作

**影響**: 
- ランタイム再入エラーでプロキシ起動に失敗
- テスト実行時にpanic

**対策**: 
- `ProxyController`を非同期トレイト（`async-trait`）に変更するか、`spawn`で別タスクで実行
- `ProxyService`も非同期メソッドに変更
- テストは`#[tokio::test(flavor = "multi_thread")]`を使用

#### 2.2 ポート競合
**問題**: 
- 既に使用中のポートでプロキシを起動しようとするとエラー
- 複数のプロキシインスタンスが同じポートを使用する可能性

**影響**: 
- プロキシ起動失敗
- ユーザーエクスペリエンスの低下

**対策**: 
- ポート使用状況を事前にチェック（`TcpListener::bind`で確認）
- `ProxyError::PortInUse`を適切に返す
- `ProxyRepository::list_active_handles()`で既存インスタンスを確認

#### 2.3 リソースリーク
**問題**: 
- プロキシ停止時にAxumサーバーが適切にシャットダウンされない
- バックグラウンドタスクが残る可能性

**影響**: 
- メモリリーク
- ポートが解放されない

**対策**: 
- `axum::Server`の`shutdown`シグナルを適切に処理
- `ProxyHandle`に`shutdown_tx`を保存し、`stop()`時に送信
- リソースのクリーンアップを確実に実行

### 🟡 中リスク項目

#### 2.4 TLS証明書管理
**問題**: 
- `dev-selfsigned`モードで証明書生成が必要
- `https-acme`モードでACME証明書取得が必要（90秒タイムアウト）
- 証明書ファイルのパス管理が複雑

**影響**: 
- 証明書生成失敗でプロキシ起動に失敗
- ACME取得タイムアウトで起動が遅延

**対策**: 
- 証明書生成を別モジュールに分離
- ACME取得は非同期で実行し、タイムアウトを適切に処理
- 証明書パスは`ProxyConfig`に含めず、OS標準パスを使用

#### 2.5 認証・ポリシー適用の順序
**問題**: 
- 認証→ポリシー→ルーティングの順序が崩れるとセキュリティリスク
- ミドルウェアの適用順序が重要

**影響**: 
- セキュリティホール
- 不正アクセス

**対策**: 
- ミドルウェアの適用順序を厳守（Auth → Policy → Router）
- テストで順序を検証

#### 2.6 ストリーミング処理
**問題**: 
- SSEストリーミングの実装が複雑
- エラーハンドリングが困難
- ストリームの中断処理

**影響**: 
- ストリーミングが正常に動作しない
- リソースリーク

**対策**: 
- `axum::response::Sse`を使用
- エラー時は`data: {"error": ...}`を送出
- ストリームの適切なクリーンアップ

### 🟢 低リスク項目

#### 2.7 エラーハンドリング
**問題**: 
- 様々なエラーケースの処理
- エラーメッセージの適切な返却

**影響**: 
- デバッグが困難
- ユーザーエクスペリエンスの低下

**対策**: 
- `ProxyError`を適切に使用
- エラーログを詳細に記録
- ユーザーフレンドリーなエラーメッセージ

#### 2.8 テスト実装
**問題**: 
- プロキシサーバーの統合テストが複雑
- ポート競合の回避
- 非同期処理のテスト

**影響**: 
- テストが不安定
- リグレッションの検出が困難

**対策**: 
- 一時ポートを使用
- テスト間でポートを共有しない
- 適切なクリーンアップ

## 3. テクニカルポイント

### 3.1 アーキテクチャ設計

```
ProxyService (flm-core)
  ├─ ProxyController (trait) → AxumProxyController (flm-proxy)
  └─ ProxyRepository (trait) → SqliteProxyRepository (flm-cli)
```

**設計方針**:
- `ProxyService`はDomain層（`flm-core`）に配置
- `ProxyController`はAdapter層（`flm-proxy`）で実装
- `ProxyRepository`はAdapter層（`flm-cli`）で実装

### 3.2 非同期処理の設計

**問題**: `ProxyController::start()`は同期的だが、Axumサーバーは非同期

**解決策**: 
- オプションA: `ProxyController`を非同期トレイトに変更（推奨）
- オプションB: `spawn`で別タスクで実行し、`ProxyHandle`に`JoinHandle`を保存

**推奨**: オプションA（`async-trait`を使用）

### 3.3 プロキシインスタンス管理

**設計**:
- `ProxyHandle`に`id`、`pid`、`port`、`mode`を保存
- `ProxyRepository::list_active_handles()`で実行中インスタンスを管理
- `stop()`時に`shutdown_tx`を送信してサーバーを停止

### 3.4 ミドルウェアの適用順序

```
Request → Auth Middleware → Policy Middleware → Router → Handler → Response
```

**実装順序**:
1. Auth Middleware: Bearer Token検証
2. Policy Middleware: IP/CORS/Rate Limit
3. Router: `/v1/*` or `/engine/*`
4. Handler: EngineService呼び出し

### 3.5 TLS証明書管理

**実装方針**:
- `dev-selfsigned`: 起動時に証明書生成（既存があれば再利用）
- `https-acme`: 非同期でACME証明書取得（タイムアウト90秒）
- 証明書パスはOS標準パス（`%ProgramData%\flm\certs`等）を使用

## 4. 段階的実装計画

### Phase 1: 基盤実装（安全）

1. **ProxyRepository実装** (`flm-cli`)
   - SQLiteベースの実装
   - `save_profile`, `load_profile`, `list_profiles`, `list_active_handles`
   - テスト実装

2. **ProxyController traitの非同期化** (`flm-core`)
   - `async-trait`を使用
   - `ProxyService`も非同期化

3. **ProxyService基本実装** (`flm-core`)
   - `new()`で依存関係を注入
   - `start()`, `stop()`, `status()`の基本構造

### Phase 2: Axumサーバー実装（中リスク）

4. **AxumProxyController実装** (`flm-proxy`)
   - `local-http`モードのみ実装
   - 基本的なルーティング（`/v1/models`のみ）
   - 認証ミドルウェア（APIキー検証）

5. **統合テスト実装**
   - プロキシ起動/停止テスト
   - 認証テスト

### Phase 3: 機能拡張（中リスク）

6. **ルーティング拡張**
   - `/v1/chat/completions`実装
   - `/v1/embeddings`実装
   - `/engine/:id/*`実装

7. **ポリシーミドルウェア**
   - IPホワイトリスト
   - CORS
   - レート制限

### Phase 4: TLS対応（高リスク）

8. **TLS証明書管理**
   - `dev-selfsigned`モード実装
   - `https-acme`モード実装（ACME取得）

9. **CLIコマンド実装**
   - `flm proxy start`
   - `flm proxy stop`
   - `flm proxy status`

## 5. 実装前チェックリスト

- [ ] `async-trait`がワークスペース依存に追加されているか
- [ ] `axum`, `tokio`, `tower-http`が`flm-proxy`に追加されているか
- [ ] `ProxyError`が適切に定義されているか
- [ ] `ProxyConfig`のバリデーションロジックが定義されているか
- [ ] テスト環境の準備（一時ポート、クリーンアップ）

## 6. 推奨実装順序

1. ✅ **KYK完了**（本ドキュメント）
2. ⏳ **Phase 1: 基盤実装**（安全）
3. ⏳ **Phase 2: Axumサーバー実装**（中リスク）
4. ⏳ **Phase 3: 機能拡張**（中リスク）
5. ⏳ **Phase 4: TLS対応**（高リスク）

---

**KYK実施者**: AI Assistant  
**KYK日時**: 2025-11-21  
**次のステップ**: Phase 1実装開始

