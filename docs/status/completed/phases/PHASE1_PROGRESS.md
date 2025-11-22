# Phase 1 実装進捗レポート

> Status: In Progress | Date: 2025-01-27

## 完了項目

### ✅ Adapter層
- [x] `ConfigRepository` の実装（SQLite接続、`config.db` 操作）
- [x] `SecurityRepository` の実装（SQLite接続、`security.db` 操作）
- [x] `EngineRepository` の実装（エンジン登録管理、キャッシュ機能） - **新規完了**
- [x] `EngineProcessController` の実装（エンジン検出ロジック） - **新規完了**
- [x] `HttpClient` の実装（reqwestベース） - **新規完了**

### ✅ Service層
- [x] `ConfigService` の実装
- [x] `SecurityService` の実装
- [x] `EngineService::detect_engines()` の実装 - **新規完了**

### ✅ CLI基本コマンド
- [x] `flm config get/set/list`
- [x] `flm api-keys create/list/revoke/rotate`
- [x] `flm engines detect` - **新規完了**

### ✅ テスト
- [x] 統合テスト（ConfigService, SecurityService）
- [x] CLIコマンドテスト（実際のCLI実行）
- [x] EngineRepository / ProcessController 単体テスト

## 進行中

### 🔄 EngineRepository実装
- [x] SQLite接続とマイグレーション
- [x] エンジン状態キャッシュ機能（`engines_cache`テーブル）
- [x] エンジン登録管理（メモリ内）
- [ ] TTLチェック実装（キャッシュ有効期限）

## 次のステップ

1. **flm-engine-ollama実装**（LlmEngineトレイト）
   - Ollama API実装
   - モデル一覧取得
   - チャット機能（同期/ストリーム）と埋め込み
2. **EngineService::list_models()実装**
   - EngineRepositoryキャッシュ活用
   - CLI出力フォーマット（text/json）整備
3. **CLI: `flm models list` 実装**
   - `--engine` / `--fresh` オプション
   - JSON構造の固定化（CIスナップショット）

---

**更新日**: 2025-01-27  
**次のマイルストーン**: flm-engine-ollama実装完了

