// FLM - ダウンロード機能
// OS自動検出とダウンロードリンクの制御

/**
 * ダウンロード機能の初期化
 */
document.addEventListener('DOMContentLoaded', function() {
  initDownloadButtons();
  initDownloadCountdown();
  // GitHub Releases APIから最新リリース情報を取得
  fetchLatestRelease();
});

/**
 * ダウンロードボタンの初期化
 */
function initDownloadButtons() {
  const downloadButtons = document.querySelectorAll('.download-button, [data-download]');
  
  downloadButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      // ダウンロード開始前の確認（オプション）
      const os = detectOS();
      const osSupport = ['windows', 'macos', 'linux'];
      
      if (!osSupport.includes(os)) {
        e.preventDefault();
        alert('お使いのOSは現在サポートされていません。Windows、macOS、またはLinuxをご利用ください。');
        return;
      }
      
      // ダウンロード追跡（オプトイン方式、非同期）
      trackDownload(os).catch(err => {
        console.error('ダウンロード追跡エラー:', err);
      });
    });
  });
}

/**
 * OS検出（main.jsと同じ関数を共有）
 */
function detectOS() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const platform = navigator.platform || '';
  
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

/**
 * ダウンロード追跡の同意を確認
 */
function checkTrackingConsent() {
  const consent = localStorage.getItem('flm_tracking_consent');
  if (consent === null) {
    // 初回訪問時は同意を求める
    return showTrackingConsentDialog();
  }
  return consent === 'true';
}

/**
 * ダウンロード追跡の同意ダイアログを表示
 */
function showTrackingConsentDialog() {
  return new Promise((resolve) => {
    // 既にダイアログが表示されている場合はスキップ
    if (document.getElementById('tracking-consent-dialog')) {
      resolve(false);
      return;
    }

    const dialog = document.createElement('div');
    dialog.id = 'tracking-consent-dialog';
    dialog.className = 'tracking-consent-dialog';
    dialog.innerHTML = `
      <div class="tracking-consent-content">
        <h3>プライバシー設定</h3>
        <p>
          ダウンロード統計の収集にご協力いただけますか？<br>
          収集される情報：OS情報、ダウンロード日時（ローカルストレージに保存）
        </p>
        <p class="tracking-consent-note">
          <a href="privacy.html" target="_blank">プライバシーポリシー</a>をご確認ください。
        </p>
        <div class="tracking-consent-buttons">
          <button class="btn btn-primary" id="tracking-consent-accept">同意する</button>
          <button class="btn btn-secondary" id="tracking-consent-decline">拒否する</button>
        </div>
      </div>
    `;
    
    // スタイルを追加
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const content = dialog.querySelector('.tracking-consent-content');
    content.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 8px;
      max-width: 500px;
      margin: 1rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    const buttons = dialog.querySelector('.tracking-consent-buttons');
    buttons.style.cssText = `
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      justify-content: flex-end;
    `;
    
    const note = dialog.querySelector('.tracking-consent-note');
    note.style.cssText = `
      font-size: 0.875rem;
      color: #666;
      margin-top: 1rem;
    `;
    
    // イベントリスナー
    dialog.querySelector('#tracking-consent-accept').addEventListener('click', () => {
      localStorage.setItem('flm_tracking_consent', 'true');
      dialog.remove();
      resolve(true);
    });
    
    dialog.querySelector('#tracking-consent-decline').addEventListener('click', () => {
      localStorage.setItem('flm_tracking_consent', 'false');
      dialog.remove();
      resolve(false);
    });
    
    document.body.appendChild(dialog);
  });
}

/**
 * ダウンロード追跡（オプトイン方式）
 */
async function trackDownload(os) {
  // ユーザーの同意を確認
  const hasConsent = await checkTrackingConsent();
  
  if (!hasConsent) {
    // 同意がない場合は追跡しない
    console.log('ダウンロード追跡はスキップされました（ユーザーが同意していません）');
    return;
  }
  
  // 将来的にGoogle Analytics等のトラッキングコードを追加可能
  console.log(`Download initiated for OS: ${os}`);
  
  // ローカルストレージに記録（同意がある場合のみ）
  try {
    const downloads = JSON.parse(localStorage.getItem('flm_downloads') || '[]');
    downloads.push({
      os: os,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('flm_downloads', JSON.stringify(downloads));
  } catch (e) {
    // エラーは無視
    console.error('ダウンロード追跡の保存に失敗しました:', e);
  }
}

/**
 * ダウンロードカウントダウンの初期化（将来の機能）
 */
function initDownloadCountdown() {
  // 将来的にリリース日時のカウントダウン機能を追加可能
  const countdownElement = document.querySelector('.download-countdown');
  if (!countdownElement) return;
  
  // 実装例（必要に応じて）
}

/**
 * システム要件のチェック（将来の機能）
 */
function checkSystemRequirements() {
  const os = detectOS();
  const requirements = {
    windows: {
      minOS: 'Windows 10',
      ram: '4GB',
      storage: '500MB',
    },
    macos: {
      minOS: 'macOS 11.0',
      ram: '4GB',
      storage: '500MB',
    },
    linux: {
      minOS: 'Ubuntu 20.04',
      ram: '4GB',
      storage: '500MB',
    },
  };
  
  return requirements[os] || null;
}

/**
 * GitHub Releases APIから最新リリース情報を取得
 */
async function fetchLatestRelease() {
  try {
    // GitHub Releases APIから最新リリースを取得
    const response = await fetch('https://api.github.com/repos/Unjuno/FLM/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const release = await response.json();
    
    // プラットフォーム別アセットを分類
    const assets = {
      windows: null,
      macos: null,
      linux: null
    };
    
    release.assets.forEach(asset => {
      const name = asset.name.toLowerCase();
      
      // Windows用アセット（.msi または .exe）
      if (name.endsWith('.msi') || (name.endsWith('.exe') && !name.includes('setup'))) {
        assets.windows = asset;
      }
      // macOS用アセット（.dmg）
      else if (name.endsWith('.dmg') || (name.endsWith('.app') && name.includes('macos'))) {
        assets.macos = asset;
      }
      // Linux用アセット（.AppImage または .deb）
      else if (name.endsWith('.appimage') || name.endsWith('.deb')) {
        assets.linux = asset;
      }
    });
    
    // バージョン情報を表示
    updateReleaseInfo(release, assets);
    
    // ダウンロードリンクを更新
    updateDownloadLinks(assets);
    
  } catch (error) {
    console.error('リリース情報の取得に失敗しました:', error);
    
    // エラー時はデフォルト表示を維持
    showReleaseError();
  }
}

/**
 * リリース情報をページに表示
 */
function updateReleaseInfo(release, assets) {
  const version = release.tag_name.replace(/^v/, ''); // 'v1.0.0' -> '1.0.0'
  const releaseDate = new Date(release.published_at).toLocaleDateString('ja-JP');
  
  // バージョン情報を更新
  document.querySelectorAll('.info-value').forEach(el => {
    if (el.textContent.includes('1.0.0')) {
      el.textContent = version;
    }
  });
  
  // リリース日時を表示（存在する場合）
  const releaseDateEl = document.getElementById('release-date');
  if (releaseDateEl) {
    releaseDateEl.textContent = releaseDate;
  }
  
  // 各プラットフォームのファイル情報を更新
  updatePlatformInfo('windows', assets.windows, version);
  updatePlatformInfo('macos', assets.macos, version);
  updatePlatformInfo('linux', assets.linux, version);
}

/**
 * プラットフォーム別のファイル情報を更新
 */
function updatePlatformInfo(platform, asset, version) {
  if (!asset) return;
  
  const detailsEl = document.getElementById(`${platform}-details`);
  if (!detailsEl) return;
  
  // ファイル名を更新
  const fileNameEl = detailsEl.querySelector('.info-item:nth-child(1) .info-value');
  if (fileNameEl) {
    fileNameEl.textContent = asset.name;
  }
  
  // バージョンを更新
  const versionEl = detailsEl.querySelector('.info-item:nth-child(2) .info-value');
  if (versionEl) {
    versionEl.textContent = version;
  }
  
  // ファイルサイズを更新
  const sizeEl = detailsEl.querySelector('.info-item:nth-child(3) .info-value');
  if (sizeEl) {
    const sizeMB = (asset.size / (1024 * 1024)).toFixed(1);
    sizeEl.textContent = `約 ${sizeMB} MB`;
  }
  
  // ダウンロードボタンのhrefを更新
  const downloadBtn = detailsEl.querySelector('.download-button');
  if (downloadBtn) {
    downloadBtn.href = asset.browser_download_url;
    downloadBtn.setAttribute('data-download-url', asset.browser_download_url);
  }
}

/**
 * ダウンロードリンクを更新
 */
function updateDownloadLinks(assets) {
  // 各プラットフォームのダウンロードボタンにURLを設定
  ['windows', 'macos', 'linux'].forEach(platform => {
    const asset = assets[platform];
    if (!asset) return;
    
    const buttons = document.querySelectorAll(`[data-download="${platform}"], [data-os="${platform}"]`);
    buttons.forEach(btn => {
      if (btn.tagName === 'A') {
        btn.href = asset.browser_download_url;
        btn.setAttribute('data-download-url', asset.browser_download_url);
      }
    });
  });
  
  // OS自動検出による推奨ダウンロード
  const detectedOS = detectOS();
  if (detectedOS !== 'unknown' && assets[detectedOS]) {
    highlightRecommendedOS(detectedOS);
  }
}

/**
 * 検出されたOSをハイライト表示
 */
function highlightRecommendedOS(os) {
  const osCard = document.querySelector(`[data-os="${os}"]`);
  if (osCard) {
    osCard.classList.add('recommended');
    
    // 推奨バッジを追加
    if (!osCard.querySelector('.recommended-badge')) {
      const badge = document.createElement('span');
      badge.className = 'recommended-badge';
      badge.textContent = '推奨';
      badge.style.cssText = `
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: var(--primary-color);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.75rem;
        font-weight: 600;
      `;
      osCard.style.position = 'relative';
      osCard.appendChild(badge);
    }
  }
}

/**
 * リリース情報取得エラー時の表示
 */
function showReleaseError() {
  // エラー表示（必要に応じて）
  const errorMsg = document.createElement('div');
  errorMsg.className = 'release-error';
  errorMsg.style.cssText = `
    padding: 1rem;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    margin: 1rem 0;
    color: #c33;
  `;
  errorMsg.textContent = '最新バージョン情報の取得に失敗しました。GitHubリリースページから直接ダウンロードしてください。';
  
  const downloadSection = document.querySelector('.download-section');
  if (downloadSection) {
    downloadSection.insertBefore(errorMsg, downloadSection.firstChild);
  }
}

