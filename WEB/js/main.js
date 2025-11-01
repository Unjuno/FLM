// FLM - メインJavaScript
// 公式Webサイトのメイン機能

// DOMContentLoaded後に実行
document.addEventListener('DOMContentLoaded', function() {
  // モバイルメニューのトグル
  initMobileMenu();
  
  // OS自動検出とダウンロードリンクの設定
  initDownloadDetection();
  
  // スムーススクロール
  initSmoothScroll();
  
  // アクティブなナビゲーションリンクの設定
  initActiveNavigation();
  
  // フェードインアニメーション
  initFadeInAnimations();
});

/**
 * モバイルメニューの初期化
 */
function initMobileMenu() {
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  
  if (mobileMenuToggle && navLinks) {
    mobileMenuToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      const isActive = navLinks.classList.contains('active');
      mobileMenuToggle.setAttribute('aria-expanded', isActive);
      mobileMenuToggle.innerHTML = isActive ? '✕' : '☰';
    });
    
    // リンククリック時にメニューを閉じる
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        navLinks.classList.remove('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
        mobileMenuToggle.innerHTML = '☰';
      });
    });
  }
}

/**
 * OS自動検出とダウンロードリンクの設定
 */
function initDownloadDetection() {
  const downloadButtons = document.querySelectorAll('[data-os-detect]');
  
  if (downloadButtons.length === 0) return;
  
  // OS検出
  const os = detectOS();
  
  // 各ダウンロードボタンにOS情報を設定
  downloadButtons.forEach(button => {
    const downloadLink = button.getAttribute('href') || '#';
    
    // OS別のダウンロードリンクを設定（実際の実装時は適切なリンクに置き換え）
    const osLinks = {
      windows: downloadLink.replace('[OS]', 'windows'),
      macos: downloadLink.replace('[OS]', 'macos'),
      linux: downloadLink.replace('[OS]', 'linux'),
    };
    
    // 検出したOSに対応するリンクを設定
    if (osLinks[os]) {
      button.href = osLinks[os];
    }
    
    // ボタンテキストを更新
    const osName = {
      windows: 'Windows版をダウンロード',
      macos: 'macOS版をダウンロード',
      linux: 'Linux版をダウンロード',
    };
    
    if (osName[os]) {
      const buttonText = button.querySelector('.btn-text') || button;
      if (buttonText.textContent.includes('ダウンロード')) {
        buttonText.textContent = osName[os];
      }
    }
  });
  
  // OS検出結果を表示
  const osDisplay = document.querySelector('[data-os-display]');
  if (osDisplay) {
    const osDisplayName = {
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux',
    };
    osDisplay.textContent = osDisplayName[os] || 'あなたのOS';
  }
}

/**
 * OS検出関数
 * @returns {string} 'windows', 'macos', 'linux', または 'unknown'
 */
function detectOS() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const platform = navigator.platform || '';
  
  // Windows
  if (/win/i.test(platform) || /windows/i.test(userAgent)) {
    return 'windows';
  }
  
  // macOS
  if (/mac/i.test(platform) || /macintosh/i.test(userAgent)) {
    return 'macos';
  }
  
  // Linux
  if (/linux/i.test(platform) || /linux/i.test(userAgent)) {
    return 'linux';
  }
  
  // Android
  if (/android/i.test(userAgent)) {
    return 'android';
  }
  
  // iOS
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'ios';
  }
  
  return 'unknown';
}

/**
 * スムーススクロールの初期化
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '#!') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

/**
 * アクティブなナビゲーションリンクの設定
 */
function initActiveNavigation() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a');
  
  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    if (linkPath === currentPath || 
        (currentPath === '/' && linkPath === '/index.html')) {
      link.classList.add('active');
    }
  });
}

/**
 * フェードインアニメーションの初期化
 */
function initFadeInAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // アニメーション対象要素を監視
  document.querySelectorAll('.card, .section').forEach(el => {
    observer.observe(el);
  });
}

