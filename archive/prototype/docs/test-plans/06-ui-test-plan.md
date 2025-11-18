# UIテスト計画書（GUI Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: UIテスト（GUI Test）
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

UIテストは、ボタン・フォーム・画面遷移などのUI要素の動作を検証するテストです。ユーザーインターフェースが期待通りに動作し、適切なフィードバックを提供することを確認します。

### 1.2 対象範囲

- ボタンの動作確認
- フォームの入力とバリデーション
- 画面遷移の確認
- モーダル・ダイアログの動作
- エラーメッセージの表示
- ローディング状態の表示
- レスポンシブデザインの確認

### 1.3 テストフレームワーク

- **フレームワーク**: Jest + React Testing Library
- **推奨ツール**: Autify、Testim、Ranorex（ノーコードツール）
- **現状**: Jest + jsdom（基本的なUIテスト）

---

## 2. テスト対象とテスト項目

### 2.1 ボタンの動作確認

#### 2.1.1 基本ボタン

**対象コンポーネント**: `src/components/common/`、各ページコンポーネント

**テスト項目**:
- ボタンのクリックイベント
- ボタンの有効/無効状態
- ローディング状態の表示
- ボタンのラベル表示

**テスト例**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/common/Button';

describe('Button Component', () => {
  it('should handle click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByText('Click me');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

#### 2.1.2 ナビゲーションボタン

**対象コンポーネント**: `src/components/navigation/`

**テスト項目**:
- ナビゲーションボタンのクリック
- アクティブ状態の表示
- 画面遷移の確認

### 2.2 フォームの入力とバリデーション

#### 2.2.1 テキスト入力フィールド

**対象コンポーネント**: `src/components/forms/Input.tsx`

**テスト項目**:
- テキスト入力の動作
- プレースホルダーの表示
- バリデーションエラーの表示
- 必須フィールドの表示

**テスト例**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../components/forms/Input';

describe('Input Component', () => {
  it('should handle text input', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} placeholder="Enter text" />);
    
    const input = screen.getByPlaceholderText('Enter text');
    fireEvent.change(input, { target: { value: 'test' } });
    
    expect(handleChange).toHaveBeenCalled();
  });
});
```

#### 2.2.2 選択フィールド

**対象コンポーネント**: `src/components/forms/Select.tsx`

**テスト項目**:
- 選択肢の表示
- 選択の動作
- デフォルト値の設定

**既存テストファイル**: `tests/unit/Select.test.tsx`

#### 2.2.3 チェックボックス・ラジオボタン

**対象コンポーネント**: 
- `src/components/forms/Checkbox.tsx`
- `src/components/forms/Radio.tsx`

**テスト項目**:
- チェック/アンチェックの動作
- 選択状態の表示
- グループ選択の動作（ラジオボタン）

#### 2.2.4 スイッチ

**対象コンポーネント**: `src/components/forms/Switch.tsx`

**テスト項目**:
- スイッチのオン/オフ動作
- 状態の表示

### 2.3 画面遷移の確認

#### 2.3.1 ルーティング

**対象ファイル**: `src/App.tsx`

**テスト項目**:
- 各ルートへの遷移
- パラメータ付きルートの動作
- 404エラーページの表示

#### 2.3.2 ナビゲーションメニュー

**対象コンポーネント**: `src/components/navigation/Navigation.tsx`

**テスト項目**:
- メニュー項目のクリック
- アクティブ状態の表示
- 画面遷移の確認

### 2.4 モーダル・ダイアログの動作

#### 2.4.1 モーダル表示

**テスト項目**:
- モーダルの表示
- モーダルの閉じる操作
- 背景クリックでの閉じる操作
- エスケープキーでの閉じる操作

#### 2.4.2 確認ダイアログ

**テスト項目**:
- 確認ダイアログの表示
- 確認ボタンの動作
- キャンセルボタンの動作

### 2.5 エラーメッセージの表示

#### 2.5.1 フォームバリデーションエラー

**対象コンポーネント**: `src/components/common/ErrorMessage.tsx`

**テスト項目**:
- エラーメッセージの表示
- エラーメッセージのスタイル
- 複数エラーの表示

#### 2.5.2 APIエラーメッセージ

**テスト項目**:
- APIエラーの表示
- ネットワークエラーの表示
- タイムアウトエラーの表示

### 2.6 ローディング状態の表示

#### 2.6.1 ローディングインジケーター

**テスト項目**:
- ローディング状態の表示
- ローディング中の操作無効化
- ローディング完了後の状態遷移

### 2.7 レスポンシブデザインの確認

#### 2.7.1 画面サイズ対応

**テスト項目**:
- デスクトップサイズでの表示
- タブレットサイズでの表示
- モバイルサイズでの表示（将来対応）

---

## 3. テスト実装方針

### 3.1 React Testing Libraryの使用

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

describe('Component Test', () => {
  it('should render correctly', () => {
    render(
      <BrowserRouter>
        <YourComponent />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### 3.2 モックの使用

- Tauri APIのモック（`tests/setup/tauri-mock.ts`）
- ルーターのモック
- イベントハンドラーのモック

### 3.3 スナップショットテスト

```typescript
import { render } from '@testing-library/react';
import { YourComponent } from './YourComponent';

describe('Component Snapshot', () => {
  it('should match snapshot', () => {
    const { container } = render(<YourComponent />);
    expect(container).toMatchSnapshot();
  });
});
```

---

## 4. テスト実装優先順位

### 優先度: 高

1. **フォームコンポーネント**
   - 入力フィールドの動作確認
   - バリデーションエラーの表示
   - 既に一部実装済み（`Select.test.tsx`）

2. **ボタンの動作確認**
   - クリックイベントの動作
   - ローディング状態の表示

3. **エラーメッセージの表示**
   - エラーメッセージの表示確認

### 優先度: 中

4. **画面遷移の確認**
   - ルーティングの動作確認
   - ナビゲーションメニューの動作

5. **モーダル・ダイアログの動作**
   - モーダルの表示と閉じる操作

### 優先度: 低

6. **レスポンシブデザインの確認**
   - 様々な画面サイズでの表示確認

---

## 5. テスト実行方法

### 5.1 UIテストを実行

```bash
# すべてのUIテストを実行
npm test -- tests/unit --testPathPattern="\.(tsx|jsx)$"

# 特定のコンポーネントのテストを実行
npm test -- tests/unit/Select.test.tsx
```

### 5.2 ウォッチモードで実行

```bash
npm run test:watch -- tests/unit
```

### 5.3 カバレッジレポートを生成

```bash
npm run test:coverage -- tests/unit
```

---

## 6. ノーコードツールの活用（オプション）

### 6.1 Autify

- ビジュアルなテスト作成
- 自動テストの実行
- 回帰テストの自動化

### 6.2 Testim

- AIを活用したテスト作成
- メンテナンスの自動化
- CI/CDへの統合

### 6.3 Ranorex

- デスクトップアプリケーションのテスト
- コード生成と手動編集の組み合わせ

---

## 7. テスト品質基準

### 7.1 テストの品質指標

- **網羅性**: 主要なUI要素を網羅していること
- **再現性**: 同じ条件下で常に同じ結果が得られること
- **明確性**: テストの意図が明確であること
- **保守性**: コード変更に伴いテストも容易に更新できること

### 7.2 テスト結果の評価基準

- **合格**: すべてのテスト項目が期待通りに動作すること
- **不合格**: 1つ以上のテスト項目が期待通りに動作しないこと

---

## 8. CI/CDへの統合

### 8.1 自動実行

- プルリクエスト作成時に自動実行
- マージ前に必須チェック（オプション）

### 8.2 ビジュアルリグレッションテスト

- スクリーンショットの比較
- 見た目の変更の検出

---

## 9. トラブルシューティング

### 9.1 よくある問題

**問題**: コンポーネントがレンダリングされない
- **解決策**: 必要なプロバイダー（Router、ThemeProviderなど）を確認

**問題**: イベントが発火しない
- **解決策**: `fireEvent`の代わりに`userEvent`を使用

**問題**: 非同期処理のテストが失敗する
- **解決策**: `waitFor`を使用して非同期処理を待機

---

## 10. 参考資料

- [React Testing Library公式ドキュメント](https://testing-library.com/react)
- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- 既存のUIテストファイル（`tests/unit/Select.test.tsx`、`tests/unit/LogStatistics.test.tsx`）
- [Autify公式ドキュメント](https://docs.autify.com/)
- [Testim公式ドキュメント](https://help.testim.io/)
