// FLM - ダウンロード機能
// OS自動検出とダウンロードリンクの制御

/**
 * ダウンロード機能の初期化
 */
document.addEventListener('DOMContentLoaded', function() {
  initDownloadButtons();
  initDownloadCountdown();
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
      
      // ダウンロード追跡（将来の分析用）
      trackDownload(os);
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
 * ダウンロード追跡（将来の分析用）
 */
function trackDownload(os) {
  // 将来的にGoogle Analytics等のトラッキングコードを追加可能
  console.log(`Download initiated for OS: ${os}`);
  
  // ローカルストレージに記録（オプション）
  try {
    const downloads = JSON.parse(localStorage.getItem('flm_downloads') || '[]');
    downloads.push({
      os: os,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('flm_downloads', JSON.stringify(downloads));
  } catch (e) {
    // エラーは無視
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

