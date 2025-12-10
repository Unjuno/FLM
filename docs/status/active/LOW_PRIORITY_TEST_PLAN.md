# 低優先度テスト実装計画

> Updated: 2025-02-01 | Status: Planning | Priority: Low (Post-Release)

## 概要

リリース後に実装可能な低優先度テストの実装計画です。これらはリリース前に必須ではありませんが、長期的な品質向上のために推奨されます。

## 1. E2Eテストの追加（実際のTauriアプリケーション）

### 現状
- ✅ **CLI E2Eテスト**: `crates/apps/flm-cli/tests/e2e_test.rs` に3テスト存在
- ⏳ **TauriアプリE2Eテスト**: 未実装
- 📝 **計画書**: `archive/prototype/docs/test-plans/05-e2e-test-plan.md` に詳細な計画が存在

### 実装計画

#### 1.1 テストフレームワークの選定
- **推奨**: Playwright または Tauri Test Runner
- **理由**: TauriアプリケーションのE2Eテストに適している
- **代替案**: Spectron（Electron向けだが参考になる）

#### 1.2 テストシナリオ
1. **アプリケーション起動**
   - Tauriアプリの起動確認
   - 初期画面の表示確認

2. **エンジン検出フロー**
   - エンジン検出の実行
   - 検出結果の表示確認
   - モデルリストの取得

3. **プロキシ起動フロー**
   - プロキシの起動
   - プロキシ状態の確認
   - プロキシの停止

4. **チャット送信フロー**
   - チャット画面の表示
   - メッセージの送信
   - レスポンスの受信

5. **セキュリティ機能フロー**
   - APIキーの作成
   - セキュリティポリシーの設定
   - IPブロックリストの管理

#### 1.3 実装ファイル
- `tests/e2e/tauri-app.test.ts` - メインのE2Eテスト
- `tests/e2e/helpers.ts` - テストヘルパー関数
- `tests/e2e/fixtures.ts` - テストフィクスチャ

#### 1.4 必要な依存関係
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@tauri-apps/cli": "^2"
  }
}
```

### 推定実装時間
- セットアップ: 4-6時間
- テスト実装: 8-12時間
- **合計**: 12-18時間

---

## 2. アクセシビリティテスト

### 現状
- ⏳ **アクセシビリティテスト**: 未実装
- 📝 **計画書**: `archive/prototype/docs/test-plans/11-accessibility-test-plan.md` に詳細な計画が存在
- ✅ **ARIA属性**: 一部のコンポーネントで使用されている（`Sidebar.tsx`など）

### 実装計画

#### 2.1 テストツールの選定
- **推奨**: `@axe-core/react` + `jest-axe`
- **理由**: React Testing Libraryと統合しやすい
- **追加ツール**: Pa11y（CI/CD統合用）

#### 2.2 テスト項目

##### 2.2.1 ARIA属性のテスト
- `aria-label`の使用確認
- `aria-labelledby`の使用確認
- `aria-describedby`の使用確認
- `aria-live`の使用確認
- `role`属性の適切な使用

##### 2.2.2 キーボードナビゲーションのテスト
- Tabキーでのナビゲーション
- Shift+Tabでの逆方向ナビゲーション
- Enterキーでのボタン操作
- Spaceキーでのボタン操作
- Escキーでのモーダル閉じる操作

##### 2.2.3 色のコントラストのテスト
- テキストと背景のコントラスト比（WCAG AA: 4.5:1）
- 大きなテキストのコントラスト比（WCAG AA: 3:1）

##### 2.2.4 セマンティックHTMLのテスト
- 適切なHTML要素の使用（`<button>`、`<nav>`、`<main>`など）
- 見出しレベルの適切な使用（`<h1>`～`<h6>`）

#### 2.3 実装ファイル
- `tests/accessibility/aria.test.tsx` - ARIA属性のテスト
- `tests/accessibility/keyboard.test.tsx` - キーボードナビゲーションのテスト
- `tests/accessibility/contrast.test.tsx` - 色のコントラストのテスト
- `tests/accessibility/semantic.test.tsx` - セマンティックHTMLのテスト

#### 2.4 必要な依存関係
```json
{
  "devDependencies": {
    "@axe-core/react": "^4.8.0",
    "jest-axe": "^7.0.0",
    "pa11y": "^7.0.0"
  }
}
```

### 推定実装時間
- セットアップ: 2-3時間
- テスト実装: 6-8時間
- **合計**: 8-11時間

---

## 3. 負荷テスト

### 現状
- ✅ **パフォーマンステスト**: `crates/services/flm-proxy/tests/performance_test.rs` に5テスト存在
- ✅ **CI負荷テスト**: `scripts/ci-proxy-load.sh` と `.github/workflows/ci-proxy-load.yml` が存在
- ⏳ **包括的な負荷テスト**: 限定的

### 実装計画

#### 3.1 テストツールの選定
- **推奨**: k6 または wrk2
- **理由**: 既にCI/CDで使用されている
- **追加ツール**: Grafana（メトリクス可視化）

#### 3.2 テストシナリオ

##### 3.2.1 高負荷リクエスト処理
- 100 req/min の持続的な負荷
- 500 req/min のピーク負荷
- 1000 req/min のストレステスト

##### 3.2.2 同時接続数のテスト
- 10同時接続
- 50同時接続
- 100同時接続

##### 3.2.3 メモリリーク検出
- 長時間実行（1時間以上）
- メモリ使用量の監視
- メモリリークの検出

##### 3.2.4 レイテンシテスト
- P50レイテンシの測定
- P95レイテンシの測定
- P99レイテンシの測定

#### 3.3 実装ファイル
- `scripts/load-test/k6-basic.js` - 基本的な負荷テスト
- `scripts/load-test/k6-stress.js` - ストレステスト
- `scripts/load-test/k6-memory.js` - メモリリーク検出テスト
- `.github/workflows/ci-load-test.yml` - CI/CD統合

#### 3.4 必要な依存関係
```json
{
  "devDependencies": {
    "k6": "^0.47.0"
  }
}
```

### 推定実装時間
- セットアップ: 3-4時間
- テスト実装: 6-8時間
- **合計**: 9-12時間

---

## 実装優先順位

### Phase 1（リリース後1-2週間）
1. **アクセシビリティテスト**（優先度: 高）
   - WCAG準拠は法的要件になる可能性がある
   - 実装が比較的簡単

2. **負荷テストの拡張**（優先度: 中）
   - 既存のインフラを活用できる
   - パフォーマンス問題の早期発見

### Phase 2（リリース後1ヶ月）
3. **TauriアプリE2Eテスト**（優先度: 中）
   - セットアップが複雑
   - 長期的な保守性向上

---

## 結論

これらのテストはリリース後に実装可能で、長期的な品質向上に貢献します。リリース前には必須ではありませんが、段階的に実装することを推奨します。

## 参考

- `archive/prototype/docs/test-plans/05-e2e-test-plan.md` - E2Eテスト計画書
- `archive/prototype/docs/test-plans/11-accessibility-test-plan.md` - アクセシビリティテスト計画書
- `docs/guides/TEST_STRATEGY.md` - テスト戦略
- `scripts/ci-proxy-load.sh` - 既存の負荷テストスクリプト

