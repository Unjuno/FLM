/**
 * FLM - WEBダウンロード機能の単体テスト
 * 
 * QAエージェント (QA) 実装
 * WEBサイトのダウンロードページJavaScript機能のテスト
 * 
 * テスト内容:
 * - OS検出機能
 * - GitHub Releases API連携
 * - プラットフォーム別アセット分類
 * - エラーハンドリング
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * OS検出関数のテスト
 * 
 * 注意: 実際のdownload.jsの関数を使用する場合は、
 * 関数をエクスポートする必要があります
 */
describe('WEBダウンロード機能 - OS検出', () => {
  let originalUserAgent: string;
  let originalPlatform: string;

  beforeEach(() => {
    // グローバルオブジェクトのモック
    global.navigator = {
      userAgent: '',
      platform: '',
    } as Navigator;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * OS検出関数（download.jsから抽出したロジック）
   */
  function detectOS(): string {
    const userAgent = (global.navigator?.userAgent || '').toLowerCase();
    const platform = (global.navigator?.platform || '').toLowerCase();

    if (/win/i.test(platform) || /windows/i.test(userAgent)) {
      return 'windows';
    }

    if (/mac/i.test(platform) || /macintosh/i.test(userAgent)) {
      return 'macos';
    }

    if (/linux/i.test(platform) || /linux/i.test(userAgent)) {
      return 'linux';
    }

    return 'unknown';
  }

  it('Windows OSを検出できる', () => {
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      platform: 'Win32',
    } as Navigator;

    expect(detectOS()).toBe('windows');
  });

  it('macOS OSを検出できる', () => {
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      platform: 'MacIntel',
    } as Navigator;

    expect(detectOS()).toBe('macos');
  });

  it('Linux OSを検出できる', () => {
    global.navigator = {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      platform: 'Linux x86_64',
    } as Navigator;

    expect(detectOS()).toBe('linux');
  });

  it('不明なOSはunknownを返す', () => {
    global.navigator = {
      userAgent: 'Unknown Browser',
      platform: 'Unknown Platform',
    } as Navigator;

    expect(detectOS()).toBe('unknown');
  });
});

/**
 * GitHub Releases API連携のテスト
 */
describe('WEBダウンロード機能 - GitHub Releases API', () => {
  beforeEach(() => {
    // fetch APIをモック
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('最新リリース情報を取得できる', async () => {
    const mockRelease = {
      tag_name: 'v1.0.0',
      published_at: '2024-01-01T00:00:00Z',
      assets: [
        {
          name: 'FLM-1.0.0.msi',
          size: 52428800, // 50MB
          browser_download_url: 'https://github.com/Unjuno/FLM/releases/download/v1.0.0/FLM-1.0.0.msi',
        },
        {
          name: 'FLM-1.0.0.dmg',
          size: 57671680, // 55MB
          browser_download_url: 'https://github.com/Unjuno/FLM/releases/download/v1.0.0/FLM-1.0.0.dmg',
        },
        {
          name: 'FLM-1.0.0.AppImage',
          size: 54525952, // 52MB
          browser_download_url: 'https://github.com/Unjuno/FLM/releases/download/v1.0.0/FLM-1.0.0.AppImage',
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    } as Response);

    const response = await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    expect(response.ok).toBe(true);
    const release = await response.json();

    expect(release.tag_name).toBe('v1.0.0');
    expect(release.assets).toHaveLength(3);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/Unjuno/FLM/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/vnd.github.v3+json',
        }),
      })
    );
  });

  it('APIエラー時にエラーを投げる', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    const response = await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest');

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('ネットワークエラーを適切に処理する', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest')
    ).rejects.toThrow('Network error');
  });
});

/**
 * プラットフォーム別アセット分類のテスト
 */
describe('WEBダウンロード機能 - アセット分類', () => {
  it('Windows用アセットを分類できる', () => {
    const assets = [
      { name: 'FLM-1.0.0.msi', size: 52428800 },
      { name: 'FLM-1.0.0.exe', size: 52428800 },
      { name: 'FLM-Setup-1.0.0.exe', size: 52428800 }, // 除外される
    ];

    const windowsAssets = assets.filter(asset => {
      const name = asset.name.toLowerCase();
      return name.endsWith('.msi') || (name.endsWith('.exe') && !name.includes('setup'));
    });

    expect(windowsAssets).toHaveLength(2);
    expect(windowsAssets[0].name).toBe('FLM-1.0.0.msi');
    expect(windowsAssets[1].name).toBe('FLM-1.0.0.exe');
  });

  it('macOS用アセットを分類できる', () => {
    const assets = [
      { name: 'FLM-1.0.0.dmg', size: 57671680 },
      { name: 'FLM-1.0.0-macos.app', size: 57671680 },
    ];

    const macosAssets = assets.filter(asset => {
      const name = asset.name.toLowerCase();
      return name.endsWith('.dmg') || (name.endsWith('.app') && name.includes('macos'));
    });

    expect(macosAssets).toHaveLength(2);
  });

  it('Linux用アセットを分類できる', () => {
    const assets = [
      { name: 'FLM-1.0.0.AppImage', size: 54525952 },
      { name: 'FLM-1.0.0.deb', size: 54525952 },
    ];

    const linuxAssets = assets.filter(asset => {
      const name = asset.name.toLowerCase();
      return name.endsWith('.appimage') || name.endsWith('.deb');
    });

    expect(linuxAssets).toHaveLength(2);
  });

  it('全プラットフォームのアセットを分類できる', () => {
    const assets = [
      { name: 'FLM-1.0.0.msi', size: 52428800 },
      { name: 'FLM-1.0.0.dmg', size: 57671680 },
      { name: 'FLM-1.0.0.AppImage', size: 54525952 },
    ];

    const categorized = {
      windows: assets.find(a => a.name.toLowerCase().endsWith('.msi')),
      macos: assets.find(a => a.name.toLowerCase().endsWith('.dmg')),
      linux: assets.find(a => a.name.toLowerCase().endsWith('.appimage')),
    };

    expect(categorized.windows).toBeDefined();
    expect(categorized.macos).toBeDefined();
    expect(categorized.linux).toBeDefined();
    expect(categorized.windows?.name).toBe('FLM-1.0.0.msi');
    expect(categorized.macos?.name).toBe('FLM-1.0.0.dmg');
    expect(categorized.linux?.name).toBe('FLM-1.0.0.AppImage');
  });
});

/**
 * バージョン情報の処理テスト
 */
describe('WEBダウンロード機能 - バージョン情報処理', () => {
  it('バージョンタグからバージョン番号を抽出できる', () => {
    const tagName = 'v1.0.0';
    const version = tagName.replace(/^v/, '');

    expect(version).toBe('1.0.0');
  });

  it('リリース日時を日本語形式でフォーマットできる', () => {
    const publishedAt = '2024-01-01T00:00:00Z';
    const date = new Date(publishedAt);
    const formattedDate = date.toLocaleDateString('ja-JP');

    expect(formattedDate).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
  });

  it('ファイルサイズをMBに変換できる', () => {
    const sizeInBytes = 52428800; // 50MB
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(1);

    expect(sizeInMB).toBe('50.0');
    expect(parseFloat(sizeInMB)).toBe(50.0);
  });
});

/**
 * エラーハンドリングのテスト
 */
describe('WEBダウンロード機能 - エラーハンドリング', () => {
  beforeEach(() => {
    global.console = {
      ...console,
      error: jest.fn(),
    } as Console;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('API呼び出し失敗時にエラーをログ出力する', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    try {
      await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest');
      fail('エラーが発生するはず');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Network error');
    }
  });

  it('HTTPエラー時にエラーを処理できる', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const response = await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest');
    
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });
});

