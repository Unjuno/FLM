# クイックテスト実行ガイド

## ✅ 修正済みテスト（Tauri不要）

以下のテストはすぐに実行できます：

```bash
# 単体テスト
npm test -- tests/unit/database.test.ts
npm test -- tests/unit/api-commands.test.ts
npm test -- tests/unit/web-download.test.ts

# すべての単体テスト
npm test -- tests/unit
```

## 🔧 Tauriアプリが必要なテスト

以下のテストを実行するには、Tauriアプリケーションを起動する必要があります：

### 手順

1. **ターミナル1**: Tauriアプリを起動
   ```bash
   npm run tauri:dev
   ```
   - アプリのウィンドウが表示されるまで待つ（約10-20秒）

2. **ターミナル2**: テストを実行
   ```bash
   # F001 API作成機能テスト
   npm test -- tests/integration/f001-api-creation.test.ts
   
   # マルチエンジン対応機能テスト
   npm test -- tests/integration/multi-engine.test.ts
   
   # すべての統合テスト
   npm run test:integration
   ```

## 🚀 自動テスト実行スクリプト

`run-tests-with-tauri.ps1`スクリプトを使用すると、自動的にTauriアプリの起動を確認してテストを実行します：

```powershell
.\run-tests-with-tauri.ps1
```

## 📊 現在のテスト状況

### 成功しているテスト ✅

- `tests/unit/database.test.ts`: 10 passed
- `tests/unit/api-commands.test.ts`: 8 passed  
- `tests/unit/web-download.test.ts`: 通過
- `tests/integration/certificate-auto-generation.test.ts`: 証明書自動生成機能（Tauri不要）

### Tauriアプリ起動が必要なテスト ⚠️

- `tests/integration/f001-api-creation.test.ts` - F001 API作成機能
- `tests/integration/f003-api-management.test.ts` - F003 API管理機能
- `tests/integration/f004-model-management.test.ts` - F004 モデル管理機能
- `tests/integration/f006-log-display.test.ts` - F006 ログ表示機能
- `tests/integration/f007-performance-monitoring.test.ts` - F007 パフォーマンス監視機能
- `tests/integration/multi-engine.test.ts` - マルチエンジン対応機能
- `tests/e2e/*.test.ts` - E2Eテスト

## 🔍 トラブルシューティング

### エラー: "window is not defined"

**原因**: Tauriアプリが起動していない

**解決方法**:
1. `npm run tauri:dev`でアプリを起動
2. ウィンドウが表示されるまで待つ
3. テストを再実行

### エラー: "Tauri command not found"

**原因**: IPCコマンドが登録されていない

**解決方法**:
- `src-tauri/src/lib.rs`を確認してコマンドが登録されているか確認

### Ollamaエラー

**原因**: Ollamaが起動していない、またはモデルがダウンロードされていない

**解決方法**:
```bash
# Ollamaが起動しているか確認
ollama list

# 必要なモデルをダウンロード
ollama pull llama3:8b
```

---

**最終更新**: 2024年

