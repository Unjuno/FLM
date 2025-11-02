# FLM - テスト実行ガイド

## 📋 テストの実行方法

### 前提条件

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **Ollamaが起動していること**（統合テスト・E2Eテストの場合）
   ```bash
   # Ollamaがインストールされていることを確認
   ollama --version
   
   # Ollamaが起動していることを確認（オプション）
   ollama list
   ```

### テストの種類と実行方法

#### 1. 単体テスト（Unit Tests）

モックを使用した軽量なテスト。Tauriアプリケーション不要。

```bash
# すべての単体テストを実行
npm test -- tests/unit

# 特定のテストファイルを実行
npm test -- tests/unit/api-commands.test.ts
```

#### 2. 統合テスト（Integration Tests）

**⚠️ 注意**: Tauriアプリケーションが起動している必要があります。

```bash
# 方法1: Tauriアプリを開発モードで起動してからテスト実行
npm run tauri:dev &
npm test -- tests/integration/f001-api-creation.test.ts

# 方法2: すべての統合テストを実行
npm run test:integration
```

**実行手順**:
1. 別のターミナルで `npm run tauri:dev` を実行してアプリを起動
2. アプリが完全に起動するまで待つ（データベース初期化など）
3. 別のターミナルで `npm run test:integration` を実行

#### 3. E2Eテスト（End-to-End Tests）

統合テストと同様に、Tauriアプリケーションが必要です。

```bash
npm run tauri:dev &
npm run test:e2e
```

### トラブルシューティング

#### エラー: "module is not defined in ES module scope"

Jest設定ファイルがESモジュールとして認識されています。
- `jest.config.cjs` が存在することを確認
- または、`package.json`の`"type": "module"`を削除（推奨しない）

#### エラー: "invoke is not a function" または "Tauri command not found"

**原因**: Tauriアプリケーションが起動していない

**解決方法**:
1. `npm run tauri:dev`でアプリを起動
2. アプリが完全に起動するまで待つ
3. 別のターミナルでテストを実行

#### エラー: "Ollama not running" または "Model not found"

**原因**: Ollamaが起動していない、またはモデルがダウンロードされていない

**解決方法**:
```bash
# Ollamaが起動しているか確認
ollama list

# 必要なモデルをダウンロード（例: llama3:8b）
ollama pull llama3:8b
```

#### タイムアウトエラー

テストのタイムアウト時間を延長：
```typescript
it('test name', async () => {
  // テストコード
}, 30000); // 30秒に延長
```

または、`jest.config.cjs`でグローバルタイムアウトを設定：
```javascript
testTimeout: 30000, // 30秒
```

### テスト実行のベストプラクティス

1. **開発中は単体テストを優先**
   - 実行が速い
   - Tauriアプリ不要

2. **統合テストは本番前に実行**
   - 実際の環境で動作確認
   - 時間がかかるため、CI/CDで自動実行推奨

3. **テストデータのクリーンアップ**
   - `afterAll`で作成したAPIやモデルを削除
   - テスト間での干渉を防止

### 推奨実行フロー

#### 開発時
```bash
# 1. 単体テストを実行（高速）
npm test -- tests/unit

# 2. 問題なければ統合テストを実行（Tauri起動が必要）
npm run tauri:dev &  # バックグラウンドで起動
sleep 10              # 起動を待つ
npm run test:integration
```

#### CI/CD時
```bash
# すべてのテストを実行
npm test
```

---

**最終更新**: 2024年

