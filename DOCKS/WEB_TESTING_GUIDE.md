# WEBサイト機能のテスト方法ガイド

**目的**: WEBサイトのJavaScript機能（特にダウンロードページ）をテストする方法を説明

---

## 📋 一般的なWEBサイトテストの種類

### 1. **静的解析テスト（Static Analysis）**
- HTML構造の検証
- CSSの存在確認
- JavaScriptファイルの存在確認
- **メリット**: 簡単、高速
- **既存**: `tests/e2e/f008-website.test.ts` で実装済み

### 2. **単体テスト（Unit Test）**
- JavaScript関数の個別テスト
- モックを使った外部APIテスト
- **メリット**: 高速、詳細なテスト
- **必要なもの**: jsdom、fetchモック

### 3. **E2Eテスト（End-to-End Test）**
- 実際のブラウザでの動作確認
- Playwright、Puppeteer、Selenium等を使用
- **メリット**: 実環境に近い
- **デメリット**: 時間がかかる、設定が複雑

### 4. **手動テスト（Manual Test）**
- ブラウザで直接確認
- **メリット**: 簡単、視覚的確認
- **デメリット**: 再現性が低い、時間がかかる

---

## 🛠️ 実装方法

### 方法1: 単体テスト（Jest + jsdom）

**必要なパッケージ**:
```bash
npm install --save-dev jest-environment-jsdom @testing-library/jest-dom
```

**Jest設定の更新** (`jest.config.js`):
```javascript
module.exports = {
  // ...
  testEnvironment: 'jsdom',  // 'node' → 'jsdom' に変更（またはプロジェクト別に設定）
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  // ...
};
```

**テスト例**:
```javascript
// tests/unit/web-download.test.js
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// DOM環境を模擬
const { JSDOM } = require('jsdom');

describe('ダウンロード機能のテスト', () => {
  let dom;
  let window;
  let document;
  
  beforeEach(() => {
    // HTMLを読み込んでDOMを作成
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="latest-version">読み込み中...</div>
          <div id="release-date">-</div>
          <div data-os="windows" class="os-card"></div>
          <a class="download-button" data-download="windows"></a>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    
    // fetch APIをモック
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('OS検出機能が動作する', () => {
    // navigator.userAgentを設定
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });
    
    // detectOS関数をテスト（関数をロード）
    const detectOS = () => {
      const userAgent = navigator.userAgent;
      if (/windows/i.test(userAgent)) return 'windows';
      if (/mac/i.test(userAgent)) return 'macos';
      if (/linux/i.test(userAgent)) return 'linux';
      return 'unknown';
    };
    
    expect(detectOS()).toBe('windows');
  });
  
  it('GitHub Releases APIから最新リリースを取得できる', async () => {
    // モックレスポンス
    const mockRelease = {
      tag_name: 'v1.0.0',
      published_at: '2024-01-01T00:00:00Z',
      assets: [
        {
          name: 'FLM-1.0.0.msi',
          size: 52428800,
          browser_download_url: 'https://github.com/Unjuno/FLM/releases/download/v1.0.0/FLM-1.0.0.msi'
        }
      ]
    };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRelease
    });
    
    // テスト実行
    const response = await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest');
    const release = await response.json();
    
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/Unjuno/FLM/releases/latest',
      expect.any(Object)
    );
    expect(release.tag_name).toBe('v1.0.0');
    expect(release.assets).toHaveLength(1);
  });
  
  it('プラットフォーム別アセットを分類できる', () => {
    const assets = [
      { name: 'FLM-1.0.0.msi' },
      { name: 'FLM-1.0.0.dmg' },
      { name: 'FLM-1.0.0.AppImage' }
    ];
    
    const categorized = {
      windows: assets.find(a => a.name.endsWith('.msi')),
      macos: assets.find(a => a.name.endsWith('.dmg')),
      linux: assets.find(a => a.name.endsWith('.AppImage'))
    };
    
    expect(categorized.windows).toBeDefined();
    expect(categorized.macos).toBeDefined();
    expect(categorized.linux).toBeDefined();
  });
  
  it('エラー時にエラーメッセージを表示する', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    
    try {
      await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest');
      fail('エラーが発生するはず');
    } catch (error) {
      expect(error.message).toBe('Network error');
    }
  });
});
```

---

### 方法2: Playwright E2Eテスト（推奨）

**必要なパッケージ**:
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**設定ファイル** (`playwright.config.ts`):
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/web',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080', // ローカルサーバーまたはGitHub Pages URL
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'python -m http.server 8080',
    url: 'http://localhost:8080',
    cwd: 'WEB',
  },
});
```

**テスト例**:
```typescript
// tests/e2e/web/download.test.ts
import { test, expect } from '@playwright/test';

test.describe('ダウンロードページ', () => {
  test('ページが正常に読み込まれる', async ({ page }) => {
    await page.goto('/download.html');
    
    await expect(page.locator('h1')).toContainText('ダウンロード');
    await expect(page.locator('#latest-version')).toBeVisible();
  });
  
  test('最新バージョン情報が表示される', async ({ page }) => {
    // GitHub APIのモック（オプション）
    await page.route('**/api.github.com/repos/**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          tag_name: 'v1.0.0',
          published_at: '2024-01-01T00:00:00Z',
          assets: [
            {
              name: 'FLM-1.0.0.msi',
              size: 52428800,
              browser_download_url: 'https://example.com/FLM-1.0.0.msi'
            }
          ]
        })
      });
    });
    
    await page.goto('/download.html');
    
    // バージョンが表示されるまで待機
    await expect(page.locator('#latest-version')).not.toContainText('読み込み中...');
    await expect(page.locator('#latest-version')).toContainText('1.0.0');
  });
  
  test('OS自動検出が動作する', async ({ page, browserName }) => {
    // User-Agentを設定
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });
    
    await page.goto('/download.html');
    
    // Windowsが推奨として表示される
    const windowsCard = page.locator('[data-os="windows"]');
    await expect(windowsCard).toHaveClass(/recommended/);
  });
  
  test('ダウンロードボタンがクリック可能', async ({ page }) => {
    await page.goto('/download.html');
    
    const downloadButton = page.locator('.download-button').first();
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();
  });
  
  test('エラー時にエラーメッセージが表示される', async ({ page }) => {
    // API呼び出しを失敗させる
    await page.route('**/api.github.com/repos/**', route => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error'
      });
    });
    
    await page.goto('/download.html');
    
    // エラーメッセージが表示される
    await expect(page.locator('.release-error')).toBeVisible();
  });
});
```

---

### 方法3: 手動テストチェックリスト

**簡単な確認方法**:

1. **ローカルサーバーで起動**
   ```bash
   cd WEB
   python -m http.server 8080
   # または
   npx serve .
   ```

2. **ブラウザで確認**
   - Chrome DevToolsでコンソールエラーを確認
   - NetworkタブでAPI呼び出しを確認
   - レスポンシブデザインを確認（デベロッパーツール）

3. **確認項目**
   - [ ] ページが正常に読み込まれる
   - [ ] 最新バージョン情報が表示される
   - [ ] OS自動検出が動作する
   - [ ] ダウンロードボタンがクリック可能
   - [ ] エラー時にエラーメッセージが表示される

---

## 📊 テスト戦略の推奨

### 開発段階
1. **単体テスト** - JavaScript関数の動作確認（高速）
2. **手動テスト** - 視覚的確認

### CI/CD段階
1. **静的解析テスト** - HTML/CSS/JS構造の検証（既存）
2. **単体テスト** - APIモックを使ったテスト

### リリース前
1. **Playwright E2Eテスト** - 実ブラウザでの動作確認
2. **手動テスト** - 最終確認

---

## 🔧 実装の優先順位

### Phase 1: 基本的な単体テスト（推奨・簡単）
- ✅ Jest + jsdom環境の設定
- ✅ OS検出関数のテスト
- ✅ プラットフォーム分類関数のテスト

### Phase 2: APIモックテスト（推奨）
- ✅ fetch APIのモック
- ✅ GitHub Releases APIのモックレスポンス
- ✅ エラーハンドリングのテスト

### Phase 3: E2Eテスト（オプション・時間がある場合）
- 🔵 Playwrightの導入
- 🔵 実際のブラウザでのテスト

---

## 📝 まとめ

**一般的なWEBサイト機能のテスト方法**:

1. **静的解析** - ファイル構造・HTML構造 ✅ 既に実装済み
2. **単体テスト** - JavaScript関数の個別テスト ⚠️ 実装が必要
3. **E2Eテスト** - 実ブラウザでの動作確認 🔵 オプション
4. **手動テスト** - ブラウザで直接確認 ✅ いつでも可能

**推奨**: まずは**単体テスト（Jest + jsdom）**を実装し、時間がある場合に**Playwright E2Eテスト**を追加。

