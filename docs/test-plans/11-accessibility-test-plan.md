# アクセシビリティテスト計画書（Accessibility Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: アクセシビリティテスト
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

アクセシビリティテストは、視覚・聴覚・操作支援の対応を確認するテストです。WCAG（Web Content Accessibility Guidelines）に準拠し、すべてのユーザーがアプリケーションを利用できることを確認します。

### 1.2 対象範囲

- キーボード操作の対応
- スクリーンリーダーの対応
- 色のコントラスト
- フォーカス管理
- ARIA属性の使用
- 画像の代替テキスト
- フォームのラベル付け

### 1.3 テストツール

- **自動化ツール**: axe-core、Pa11y、WAVE
- **手動テスト**: キーボード操作、スクリーンリーダー
- **現状**: 要実装

---

## 2. テスト対象とテスト項目

### 2.1 キーボード操作の対応

#### 2.1.1 キーボードナビゲーション

**テスト項目**:
- Tabキーでのナビゲーション
- Shift+Tabでの逆方向ナビゲーション
- Enterキーでのボタン操作
- Spaceキーでのボタン操作
- 矢印キーでの選択操作
- Escキーでのモーダル閉じる操作

**テスト例**:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YourComponent } from './YourComponent';

describe('Keyboard Navigation', () => {
  it('should navigate with Tab key', async () => {
    const user = userEvent.setup();
    render(<YourComponent />);
    
    const firstButton = screen.getByRole('button', { name: 'First' });
    const secondButton = screen.getByRole('button', { name: 'Second' });
    
    firstButton.focus();
    await user.tab();
    
    expect(secondButton).toHaveFocus();
  });
});
```

#### 2.1.2 フォーカス管理

**テスト項目**:
- フォーカス可能な要素のフォーカス表示
- フォーカストラップ（モーダル内）
- フォーカスの復元（モーダル閉じる後）

### 2.2 スクリーンリーダーの対応

#### 2.2.1 ARIA属性

**テスト項目**:
- `aria-label`の使用
- `aria-labelledby`の使用
- `aria-describedby`の使用
- `aria-live`の使用
- `role`属性の使用

**テスト例**:
```typescript
describe('ARIA Attributes', () => {
  it('should have proper aria-label', () => {
    render(<Button aria-label="Close dialog">×</Button>);
    
    const button = screen.getByRole('button', { name: 'Close dialog' });
    expect(button).toHaveAttribute('aria-label', 'Close dialog');
  });
});
```

#### 2.2.2 セマンティックHTML

**テスト項目**:
- 適切なHTML要素の使用（`<button>`、`<nav>`、`<main>`など）
- 見出しレベルの適切な使用（`<h1>`～`<h6>`）
- リストの適切な使用（`<ul>`、`<ol>`）

### 2.3 色のコントラスト

#### 2.3.1 コントラスト比

**テスト項目**:
- テキストと背景のコントラスト比（WCAG AA: 4.5:1、WCAG AAA: 7:1）
- 大きなテキストのコントラスト比（WCAG AA: 3:1、WCAG AAA: 4.5:1）
- 非テキストコンテンツのコントラスト比（WCAG AA: 3:1）

**テストツール**: axe-core、Pa11y、WAVE

### 2.4 画像の代替テキスト

#### 2.4.1 alt属性

**テスト項目**:
- 装飾画像の`alt=""`
- 意味のある画像の適切な`alt`テキスト
- 複雑な画像の`aria-describedby`の使用

**テスト例**:
```typescript
describe('Image Alt Text', () => {
  it('should have alt text for meaningful images', () => {
    render(<img src="logo.png" alt="FLM Logo" />);
    
    const image = screen.getByAltText('FLM Logo');
    expect(image).toBeInTheDocument();
  });
  
  it('should have empty alt for decorative images', () => {
    render(<img src="decoration.png" alt="" />);
    
    const image = screen.getByAltText('');
    expect(image).toBeInTheDocument();
  });
});
```

### 2.5 フォームのラベル付け

#### 2.5.1 フォームラベル

**テスト項目**:
- すべての入力フィールドにラベルが関連付けられている
- `label`要素の使用
- `aria-label`または`aria-labelledby`の使用

**テスト例**:
```typescript
describe('Form Labels', () => {
  it('should have associated label', () => {
    render(
      <form>
        <label htmlFor="username">Username</label>
        <input id="username" type="text" />
      </form>
    );
    
    const input = screen.getByLabelText('Username');
    expect(input).toBeInTheDocument();
  });
});
```

### 2.6 エラーメッセージのアクセシビリティ

#### 2.6.1 エラー通知

**テスト項目**:
- エラーメッセージの`aria-live`属性
- エラーメッセージの`aria-errormessage`属性
- エラーフィールドの`aria-invalid`属性

---

## 3. テスト実装方針

### 3.1 axe-coreの使用

**インストール**:
```bash
npm install --save-dev @axe-core/react jest-axe
```

**テスト例**:
```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { YourComponent } from './YourComponent';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<YourComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### 3.2 Pa11yの使用

**インストール**:
```bash
npm install --save-dev pa11y
```

**実行方法**:
```bash
# HTMLファイルのテスト
npx pa11y http://localhost:3000

# ファイルのテスト
npx pa11y file:///path/to/file.html
```

### 3.3 WAVEの使用

- [WAVE Browser Extension](https://wave.webaim.org/extension/)をインストール
- ブラウザでページを開いてWAVEを実行
- アクセシビリティの問題を確認

---

## 4. WCAG準拠レベル

### 4.1 WCAG 2.1レベルA（最小要件）

**必須項目**:
- キーボード操作の対応
- 画像の代替テキスト
- フォームのラベル付け
- セマンティックHTML

### 4.2 WCAG 2.1レベルAA（推奨）

**推奨項目**:
- 色のコントラスト（4.5:1）
- フォーカス表示
- エラーメッセージの明確化
- ナビゲーションの一貫性

### 4.3 WCAG 2.1レベルAAA（最適）

**最適項目**:
- 色のコントラスト（7:1）
- 手話通訳
- 拡大機能のサポート

**目標**: WCAG 2.1レベルAAに準拠

---

## 5. テスト実装優先順位

### 優先度: 高

1. **キーボード操作の対応**
   - すべてのインタラクティブ要素のキーボード操作
   - 要実装

2. **フォームのラベル付け**
   - すべての入力フィールドのラベル
   - 要実装

3. **ARIA属性の使用**
   - 適切なARIA属性の設定
   - 要実装

### 優先度: 中

4. **色のコントラスト**
   - テキストと背景のコントラスト比
   - 要実装

5. **画像の代替テキスト**
   - すべての画像のalt属性
   - 要実装

### 優先度: 低

6. **スクリーンリーダーの詳細テスト**
   - 実際のスクリーンリーダーでのテスト
   - 要実装

---

## 6. テスト実行方法

### 6.1 axe-coreでのテスト

```bash
# すべてのアクセシビリティテストを実行
npm test -- --testPathPattern="accessibility"

# 特定のコンポーネントのテスト
npm test -- YourComponent.test.tsx
```

### 6.2 Pa11yでのテスト

```bash
# ローカルサーバーを起動
npm run dev

# 別のターミナルでPa11yを実行
npx pa11y http://localhost:3000
```

### 6.3 WAVEでのテスト

1. WAVE Browser Extensionをインストール
2. アプリケーションをブラウザで開く
3. WAVEを実行
4. アクセシビリティの問題を確認

---

## 7. 手動テスト

### 7.1 キーボード操作テスト

**テスト項目**:
- すべての機能をキーボードのみで操作できること
- フォーカスが視覚的に確認できること
- 論理的な順序でナビゲーションできること

### 7.2 スクリーンリーダーテスト

**推奨ツール**:
- **Windows**: NVDA、JAWS
- **macOS**: VoiceOver
- **Linux**: Orca

**テスト項目**:
- すべてのコンテンツが読み上げられること
- 適切な順序で読み上げられること
- インタラクティブ要素が識別できること

### 7.3 色のコントラストテスト

**テストツール**:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)

**テスト項目**:
- すべてのテキストがコントラスト比4.5:1以上であること
- 大きなテキストがコントラスト比3:1以上であること

---

## 8. アクセシビリティ改善の指針

### 8.1 コンポーネント開発時の考慮事項

- キーボード操作を最初から考慮
- セマンティックHTMLの使用
- ARIA属性の適切な使用
- 色だけで情報を伝えない

### 8.2 デザイン時の考慮事項

- コントラスト比の確保
- フォーカス表示のデザイン
- テキストサイズの適切な設定

---

## 9. CI/CDへの統合

### 9.1 自動実行

- プルリクエスト作成時に自動実行
- アクセシビリティ違反の検出

### 9.2 アクセシビリティレポート

- アクセシビリティテスト結果のレポート
- 違反の通知

---

## 10. トラブルシューティング

### 10.1 よくある問題

**問題**: axe-coreの警告が多すぎる
- **解決策**: 段階的に修正、重要な問題から対応

**問題**: キーボード操作が機能しない
- **解決策**: `tabIndex`の確認、フォーカス管理の実装

---

## 11. 参考資料

- [WCAG 2.1公式ドキュメント](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core公式ドキュメント](https://github.com/dequelabs/axe-core)
- [Pa11y公式ドキュメント](https://pa11y.org/)
- [WAVE公式ドキュメント](https://wave.webaim.org/)
- [React Accessibility公式ドキュメント](https://react.dev/learn/accessibility)

