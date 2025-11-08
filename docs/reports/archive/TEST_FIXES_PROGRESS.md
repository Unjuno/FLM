# テスト修正進捗レポート

**更新日**: 2025年1月  
**目的**: 統合テストファイルの修正進捗を記録

## 修正完了ファイル（6ファイル）

### ✅ 完了済み
1. `tests/integration/f001-api-creation.test.ts` ✅
2. `tests/integration/f002-api-usage.test.ts` ✅
3. `tests/integration/f003-api-management.test.ts` ✅
4. `tests/integration/f004-model-management.test.ts` ✅
5. `tests/integration/f005-authentication.test.ts` ✅（一部修正中）
6. `tests/integration/f006-log-display.test.ts` ✅（一部修正中）

## 修正内容

### 1. 固定待機時間の削除
- `setTimeout`を`waitForApiStart()`や`waitForApiStop()`に置き換え

### 2. テストヘルパー関数の使用
- `createTestApi()`を使用
- `cleanupTestApis()`を使用

### 3. デバッグログの統一
- `console.log`/`console.warn`を`debug.ts`の関数に置き換え

### 4. エラーハンドリングの統一
- `handleTauriAppNotRunningError()`を使用

## 残りのファイル（11ファイル）

以下のファイルにも同様の修正が必要です：

1. `tests/integration/f007-performance-monitoring.test.ts`
2. `tests/integration/f008-log-deletion.test.ts`
3. `tests/integration/f010-error-handling.test.ts`
4. `tests/integration/api-integration.test.ts`
5. `tests/integration/auth-proxy.test.ts`
6. `tests/integration/certificate-auto-generation.test.ts`
7. `tests/integration/certificate-generation.test.ts`
8. `tests/integration/certificate-integration.test.ts`
9. `tests/integration/multi-engine.test.ts`
10. `tests/integration/ollama-auto-start.test.ts`
11. `tests/integration/ollama-install.test.ts`
12. `tests/integration/ollama-installation.test.ts`
13. `tests/integration/performance-monitoring.test.ts`
14. `tests/integration/settings-integration.test.tsx`

## 次のステップ

残りのファイルにも同様の修正を適用します。

