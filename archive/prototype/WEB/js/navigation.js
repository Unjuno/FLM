// FLM - ナビゲーション制御
// 公式Webサイトのナビゲーション機能

/**
 * ナビゲーションの初期化
 */
document.addEventListener('DOMContentLoaded', function() {
  initScrollNavigation();
  initBreadcrumbs();
});

/**
 * スクロール時のナビゲーション処理
 */
function initScrollNavigation() {
  const header = document.querySelector('header');
  let lastScroll = 0;
  
  if (!header) return;
  
  window.addEventListener('scroll', function() {
    const currentScroll = window.pageYOffset;
    
    // スクロール時にヘッダーのスタイルを変更（オプション）
    if (currentScroll > 100) {
      header.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    } else {
      header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.12)';
    }
    
    lastScroll = currentScroll;
  });
}

/**
 * パンくずリストの初期化
 */
function initBreadcrumbs() {
  const breadcrumbs = document.querySelector('.breadcrumbs');
  if (!breadcrumbs) return;
  
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/').filter(part => part && !part.includes('.html'));
  
  if (pathParts.length === 0) {
    breadcrumbs.style.display = 'none';
    return;
  }
  
  // パンくずリストを生成
  let breadcrumbHTML = '<a href="/index.html">ホーム</a>';
  
  pathParts.forEach((part, index) => {
    const isLast = index === pathParts.length - 1;
    const partName = part.charAt(0).toUpperCase() + part.slice(1);
    
    if (isLast) {
      breadcrumbHTML += ` <span class="separator">›</span> <span class="current">${partName}</span>`;
    } else {
      breadcrumbHTML += ` <span class="separator">›</span> <a href="/${part}.html">${partName}</a>`;
    }
  });
  
  breadcrumbs.innerHTML = breadcrumbHTML;
}

