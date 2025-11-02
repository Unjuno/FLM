# F001 API作成機能テストの実行方法

## 📋 テストファイル

`tests/integration/f001-api-creation.test.ts`

## ✅ 正常に動作するかを確認する方法

### 方法1: Tauriアプリケーションを起動してテスト実行（推奨）

この統合テストは実際のTauriアプリケーションが必要です。

#### 手順

1. **ターミナル1**: Tauriアプリケーションを起動
   ```bash
   npm run tauri:dev
   ```
   - アプリが完全に起動するまで待つ（ウィンドウが表示されるまで）
   - データベースの初期化などが完了するまで約10-20秒

2. **ターミナル2**: テストを実行
   ```bash
   # 特定のテストファイルのみ実行
   npm test -- tests/integration/f001-api-creation.test.ts

   # または、すべての統合テストを実行
   npm run test:integration
   ```

#### 確認ポイント

✅ **正常に動作している場合**:
- テストが実行され、すべてのテストケースが成功
- `PASS` と表示される
- エラーメッセージがない

❌ **エラーが発生する場合**:
- `Error: invoke is not a function` → Tauriアプリが起動していない
- `Error: Tauri command not found` → IPCコマンドが登録されていない
- `Error: Ollama not running` → Ollamaが起動していない

### 方法2: 単体テストで基本構造を確認（軽量）

モックを使用した軽量なテスト（Tauriアプリ不要）

```bash
npm test -- tests/unit/api-commands.test.ts
```

このテストは実際のIPC呼び出しをせず、データ構造の検証のみを行います。

### 方法3: テストの構造を確認（コードレビュー）

テストファイルの内容を確認して、以下の点をチェック：

1. **テストケースが適切に定義されているか**
   - `describe` ブロックでテストスイートが整理されている
   - `it` ブロックで個別のテストケースが定義されている

2. **エラーハンドリングが適切か**
   - `try-catch` でエラーを捕捉している
   - クリーンアップ処理（`afterAll`）が実装されている

3. **タイムアウト設定が適切か**
   - 長時間かかるテストにはタイムアウトが設定されている（例: `30000`）

## 🔍 テストの内容

このテストは以下の機能を検証します：

1. **API作成の基本フロー**
   - 有効な設定でAPIを作成できる
   - 認証なしでAPIを作成できる
   - ポート番号の範囲検証

2. **モデル一覧取得**
   - 利用可能なモデル一覧を取得できる
   - Ollama未起動時のエラーハンドリング

3. **データ永続化**
   - API設定がデータベースに保存される
   - 作成したAPIが一覧に表示される

4. **APIキー生成・暗号化**
   - 異なるAPIで異なるAPIキーが生成される
   - APIキーを取得できる

5. **エラーハンドリング**
   - 重複ポート番号の処理
   - 無効なモデル名の処理

## 📊 テスト結果の確認

### 正常な実行結果の例

```
PASS  tests/integration/f001-api-creation.test.ts
  F001: API作成機能 統合テスト
    API作成の基本フロー
      ✓ should create API with valid configuration (2500ms)
      ✓ should create API without authentication (2100ms)
      ✓ should validate port number range (500ms)
    ...
    
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        15.234 s
```

### エラーが発生した場合の確認事項

1. **Tauriアプリケーションが起動しているか**
   - `npm run tauri:dev` で起動しているか確認

2. **Ollamaが起動しているか**
   ```bash
   ollama list
   ```
   - コマンドが実行できれば起動している

3. **必要なモデルがダウンロードされているか**
   ```bash
   ollama pull llama3:8b
   ```

4. **データベースが初期化されているか**
   - Tauriアプリ起動時に自動的に初期化される
   - `%APPDATA%/FLM/flm.db` が作成されているか確認

## 🛠️ トラブルシューティング

### エラー: "invoke is not a function"

**原因**: Tauriアプリが起動していない、または`@tauri-apps/api`が正しくインポートされていない

**解決方法**:
1. Tauriアプリを起動: `npm run tauri:dev`
2. アプリが完全に起動するまで待つ

### エラー: "Tauri command 'create_api' not found"

**原因**: IPCコマンドが`src-tauri/src/lib.rs`に登録されていない

**解決方法**:
- `src-tauri/src/lib.rs`を確認してコマンドが登録されているか確認
- コマンドが定義されているファイル（`src-tauri/src/commands/api.rs`）が正しくインポートされているか確認

### エラー: "Port already in use"

**原因**: テストで使用するポートが既に使用されている

**解決方法**:
- テストのポート番号を変更（8080, 8081, 8082など）
- または、既存のAPIを停止

### タイムアウトエラー

**原因**: テストの実行時間がタイムアウト時間を超えている

**解決方法**:
- テストのタイムアウト時間を延長:
  ```typescript
  it('test name', async () => {
    // テストコード
  }, 30000); // 30秒に延長
  ```

---

**作成日**: 2024年  
**対象**: F001 API作成機能統合テスト

