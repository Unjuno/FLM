# 単体テスト計画書（Unit Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: 単体テスト（Unit Test）
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

単体テストは、個々の関数やモジュールの動作を独立して検証するテストです。各コンポーネントやユーティリティ関数が期待通りに動作することを確認し、バグを早期に発見することを目的とします。

### 1.2 対象範囲

- ユーティリティ関数（`src/utils/`）
- フック（`src/hooks/`）
- 個別のコンポーネント（`src/components/`）
- バックエンドコマンド（`src-tauri/src/`）
- 型定義とバリデーション（`src/types/`）

### 1.3 テストフレームワーク

- **フロントエンド**: Jest + ts-jest
- **バックエンド（Rust）**: 標準の`#[test]`属性

---

## 2. 既存の実装状況

### 2.1 既存の単体テストファイル

以下の単体テストが既に実装されています：

- `tests/unit/api-commands.test.ts` - APIコマンドの単体テスト
- `tests/unit/database.test.ts` - データベース操作の単体テスト
- `tests/unit/ipc.test.ts` - IPC通信の単体テスト
- `tests/unit/certificate-generation.test.ts` - 証明書生成の単体テスト
- `tests/unit/timing-safe-equal.test.ts` - タイミング安全な比較の単体テスト
- `tests/unit/auth-f005.test.ts` - 認証機能の単体テスト
- `tests/unit/ollama-auto-start.test.ts` - Ollama自動起動の単体テスト
- `tests/unit/web-download.test.ts` - Webダウンロードの単体テスト
- `tests/unit/pdfExport.test.ts` - PDFエクスポートの単体テスト
- `tests/unit/print.test.ts` - 印刷機能の単体テスト
- `tests/unit/Select.test.tsx` - Selectコンポーネントの単体テスト
- `tests/unit/LogStatistics.test.tsx` - LogStatisticsコンポーネントの単体テスト

---

## 3. テスト対象とテスト項目

### 3.1 ユーティリティ関数（`src/utils/`）

#### 3.1.1 フォーマッター関数

**対象ファイル**: `src/utils/formatters.ts`

**テスト項目**:
- `formatBytes()`: バイト数を読みやすい形式に変換
  - 正常系: 0バイト、1KB、1MB、1GB、1TBの変換
  - 境界値: 1023バイト、1024バイト、1025バイト
  - 異常系: 負の値、NaN、無限大
- `formatDate()`: 日付をフォーマット
  - 正常系: 有効な日付文字列の変換
  - 異常系: 無効な日付文字列、null、undefined
- `formatDuration()`: 経過時間をフォーマット
  - 正常系: 秒、分、時間の変換
  - 境界値: 0秒、60秒、3600秒

#### 3.1.2 Tauri通信関数

**対象ファイル**: `src/utils/tauri.ts`

**テスト項目**:
- `safeInvoke()`: 安全なIPC呼び出し
  - 正常系: 成功時の戻り値の検証
  - 異常系: エラー発生時のエラーハンドリング
  - タイムアウト: 長時間かかる処理のタイムアウト処理

#### 3.1.3 ロガー関数

**対象ファイル**: `src/utils/logger.ts`

**テスト項目**:
- `logger.info()`: 情報ログの出力
- `logger.error()`: エラーログの出力
- `logger.warn()`: 警告ログの出力
- ログレベルの制御

### 3.2 フック（`src/hooks/`）

#### 3.2.1 useOllamaProcess

**対象ファイル**: `src/hooks/useOllama.ts`

**テスト項目**:
- Ollamaプロセスの起動状態の管理
- 自動起動機能の動作確認
- エラー状態のハンドリング

#### 3.2.2 useKeyboardShortcuts

**対象ファイル**: `src/hooks/useKeyboardShortcuts.ts`

**テスト項目**:
- キーボードショートカットの登録
- ショートカット実行時の動作確認
- コンポーネントアンマウント時のクリーンアップ

### 3.3 コンポーネント（`src/components/`）

#### 3.3.1 フォームコンポーネント

**対象ファイル**: `src/components/forms/`

**テスト項目**:
- `Input.tsx`: テキスト入力の動作確認
- `Select.tsx`: 選択肢の表示と選択
- `Checkbox.tsx`: チェックボックスの状態管理
- `Radio.tsx`: ラジオボタンの状態管理
- `Switch.tsx`: スイッチの状態管理
- `Textarea.tsx`: テキストエリアの動作確認

#### 3.3.2 共通コンポーネント

**対象ファイル**: `src/components/common/`

**テスト項目**:
- `ErrorBoundary.tsx`: エラー境界の動作確認
- `ErrorMessage.tsx`: エラーメッセージの表示
- `Notification.tsx`: 通知の表示と非表示
- `Tooltip.tsx`: ツールチップの表示

### 3.4 バックエンド（Rust）

**対象ファイル**: `src-tauri/src/`

**テスト項目**:
- API作成コマンド（`create_api`）
- API一覧取得コマンド（`list_apis`）
- API起動/停止コマンド（`start_api`, `stop_api`）
- データベース操作関数
- 証明書生成関数
- APIキー生成・検証関数

---

## 4. テスト実装方針

### 4.1 テストの構造

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('機能名', () => {
  beforeEach(() => {
    // テスト前の初期化処理
  });

  afterEach(() => {
    // テスト後のクリーンアップ処理
  });

  describe('サブ機能', () => {
    it('should do something', () => {
      // テストコード
      expect(result).toBe(expected);
    });
  });
});
```

### 4.2 モックの使用

- Tauri APIの呼び出しは`tests/setup/tauri-mock.ts`でモック化
- 外部API（Ollama APIなど）はモックを使用
- データベース操作はテスト用のインメモリデータベースを使用

### 4.3 テストカバレッジ目標

- **目標カバレッジ**: 80%以上
- **必須カバレッジ**: ユーティリティ関数、バリデーション関数は100%

---

## 5. テスト実行方法

### 5.1 すべての単体テストを実行

```bash
npm test -- tests/unit
```

### 5.2 ウォッチモードで実行

```bash
npm run test:watch -- tests/unit
```

### 5.3 カバレッジレポートを生成

```bash
npm run test:coverage -- tests/unit
```

### 5.4 特定のテストファイルを実行

```bash
npm test -- tests/unit/api-commands.test.ts
```

---

## 6. テスト実装優先順位

### 優先度: 高

1. **ユーティリティ関数**
   - `formatters.ts` - フォーマッター関数
   - `tauri.ts` - Tauri通信関数
   - `logger.ts` - ロガー関数

2. **バリデーション関数**
   - API設定のバリデーション
   - ポート番号のバリデーション
   - モデル名のバリデーション

3. **バックエンドコマンド**
   - API作成・削除コマンド
   - データベース操作コマンド

### 優先度: 中

4. **フォームコンポーネント**
   - 入力値の検証
   - エラーメッセージの表示

5. **フック**
   - 状態管理フック
   - イベントハンドリングフック

### 優先度: 低

6. **表示コンポーネント**
   - スタイリングの確認
   - レイアウトの確認

---

## 7. テスト品質基準

### 7.1 テストの品質指標

- **独立性**: 各テストは独立して実行可能であること
- **再現性**: 同じ条件下で常に同じ結果が得られること
- **明確性**: テストの意図が明確であること
- **保守性**: コード変更に伴いテストも容易に更新できること

### 7.2 テスト命名規則

- テスト名は日本語または英語で記述
- `should`を使った動作の記述を推奨
- 例: `should format bytes correctly`, `should handle invalid input gracefully`

---

## 8. CI/CDへの統合

### 8.1 自動実行

- プルリクエスト作成時に自動実行
- コミット時に自動実行（オプション）

### 8.2 カバレッジレポート

- カバレッジレポートをCI/CDにアップロード
- カバレッジが80%未満の場合は警告を表示

---

## 9. トラブルシューティング

### 9.1 よくある問題

**問題**: Tauri APIのモックが動作しない
- **解決策**: `tests/setup/tauri-mock.ts`が正しく読み込まれているか確認

**問題**: タイムアウトエラーが発生する
- **解決策**: テストのタイムアウト時間を延長（`jest.setTimeout(10000)`）

**問題**: モックが正しく動作しない
- **解決策**: `jest.clearAllMocks()`を`beforeEach`で実行

---

## 10. 参考資料

- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- [ts-jest公式ドキュメント](https://kulshekhar.github.io/ts-jest/)
- [Rustテストドキュメント](https://doc.rust-lang.org/book/ch11-00-testing.html)

