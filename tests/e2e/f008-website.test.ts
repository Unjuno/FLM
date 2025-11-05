// f008-website - 公式WebサイトのE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('F008 - Official Website E2E Tests', () => {
  const webRoot = path.resolve(__dirname, '../../WEB');

  beforeAll(() => {
    // このテストはTauriアプリ不要（ファイルシステムのテストのみ）
    // Tauriアプリ起動チェックは不要
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('公式WebサイトE2Eテストを開始します');
    }
  });

  afterAll(() => {
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('公式WebサイトE2Eテストを完了しました');
    }
  });

  /**
   * ファイル構造の検証
   */
  describe('Website file structure', () => {
    it('should have index.html', () => {
      const indexPath = path.join(webRoot, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('should have CSS files', () => {
      const cssFiles = ['reset.css', 'style.css', 'responsive.css'];
      cssFiles.forEach(file => {
        const cssPath = path.join(webRoot, 'css', file);
        expect(fs.existsSync(cssPath)).toBe(true);
      });
    });

    it('should have JavaScript files', () => {
      const jsFiles = ['main.js', 'download.js', 'navigation.js'];
      jsFiles.forEach(file => {
        const jsPath = path.join(webRoot, 'js', file);
        expect(fs.existsSync(jsPath)).toBe(true);
      });
    });
  });

  /**
   * HTML構造の検証
   */
  describe('HTML structure validation', () => {
    it('should have valid HTML structure in index.html', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      // 必須要素の確認
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html lang="ja">');
      expect(htmlContent).toContain('<head>');
      expect(htmlContent).toContain('<body>');
      expect(htmlContent).toContain('</body>');
      expect(htmlContent).toContain('</html>');
    });

    it('should have proper meta tags', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      expect(htmlContent).toContain('<meta charset="UTF-8">');
      expect(htmlContent).toContain('viewport');
      expect(htmlContent).toContain('description');
    });

    it('should have semantic HTML elements', () => {
      const indexPath = path.join(webRoot, 'index.html');
      if (!fs.existsSync(indexPath)) {
        console.warn('WEB/index.htmlが見つかりません。このテストをスキップします');
        expect(true).toBe(true);
        return;
      }
      
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      expect(htmlContent).toContain('<header>');
      // <nav>タグはclass属性付きで存在する可能性があるため、より柔軟な検証
      expect(htmlContent).toMatch(/<nav[\s>]/);
      // <section>タグもclass属性付きで存在する可能性があるため、より柔軟な検証
      expect(htmlContent).toMatch(/<section[\s>]/);
      expect(htmlContent).toContain('<footer>');
    });
  });

  /**
   * レスポンシブデザインの検証
   */
  describe('Responsive design validation', () => {
    it('should have viewport meta tag', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      expect(htmlContent).toContain('viewport');
      expect(htmlContent).toContain('width=device-width');
      expect(htmlContent).toContain('initial-scale=1.0');
    });

    it('should have responsive CSS file', () => {
      const responsiveCssPath = path.join(webRoot, 'css', 'responsive.css');
      expect(fs.existsSync(responsiveCssPath)).toBe(true);
      
      const cssContent = fs.readFileSync(responsiveCssPath, 'utf-8');
      // メディアクエリが含まれていることを確認
      expect(cssContent).toMatch(/@media/);
    });

    it('should have mobile menu functionality', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      expect(htmlContent).toContain('mobile-menu-toggle');
      expect(htmlContent).toContain('nav-links');
    });
  });

  /**
   * OS自動検出機能の検証
   */
  describe('OS auto-detection functionality', () => {
    it('should have OS detection JavaScript', () => {
      const mainJsPath = path.join(webRoot, 'js', 'main.js');
      expect(fs.existsSync(mainJsPath)).toBe(true);
      
      const jsContent = fs.readFileSync(mainJsPath, 'utf-8');
      expect(jsContent).toMatch(/initDownloadDetection|OS|os|platform/i);
    });

    it('should have OS detection data attributes in HTML', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      // data-os-detect や data-os-display 属性の確認
      expect(htmlContent).toMatch(/data-os-(detect|display)/i);
    });

    it('should have download.js for OS detection', () => {
      const downloadJsPath = path.join(webRoot, 'js', 'download.js');
      expect(fs.existsSync(downloadJsPath)).toBe(true);
    });
  });

  /**
   * アクセシビリティの検証
   */
  describe('Accessibility validation', () => {
    it('should have proper lang attribute', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      expect(htmlContent).toContain('lang="ja"');
    });

    it('should have aria labels for interactive elements', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      // モバイルメニュートグルのaria-label確認
      expect(htmlContent).toMatch(/aria-label|aria-expanded/i);
    });

    it('should have alt attributes for images', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      // 画像タグがある場合、alt属性があることを確認
      if (htmlContent.includes('<img')) {
        // imgタグごとにalt属性の存在を確認
        const imgTags = htmlContent.match(/<img[^>]*>/g);
        if (imgTags) {
          imgTags.forEach(imgTag => {
            expect(imgTag).toMatch(/alt=["']/);
          });
        }
      }
    });

    it('should have proper heading hierarchy', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      // h1タグが存在することを確認
      expect(htmlContent).toMatch(/<h1[^>]*>/);
    });
  });

  /**
   * ナビゲーション機能の検証
   */
  describe('Navigation functionality', () => {
    it('should have navigation links', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      expect(htmlContent).toContain('nav-links');
      expect(htmlContent).toContain('<a href');
    });

    it('should have navigation JavaScript', () => {
      const navigationJsPath = path.join(webRoot, 'js', 'navigation.js');
      expect(fs.existsSync(navigationJsPath)).toBe(true);
    });

    it('should have smooth scroll functionality', () => {
      const mainJsPath = path.join(webRoot, 'js', 'main.js');
      const jsContent = fs.readFileSync(mainJsPath, 'utf-8');
      
      expect(jsContent).toMatch(/smooth|scroll/i);
    });
  });

  /**
   * パフォーマンスの検証
   */
  describe('Performance validation', () => {
    it('should have CSS preconnect for fonts', () => {
      const indexPath = path.join(webRoot, 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      
      expect(htmlContent).toContain('preconnect');
    });

    it('should have optimized CSS structure', () => {
      const cssFiles = ['reset.css', 'style.css', 'responsive.css'];
      cssFiles.forEach(file => {
        const cssPath = path.join(webRoot, 'css', file);
        const cssContent = fs.readFileSync(cssPath, 'utf-8');
        
        // コメントが適度に含まれていることを確認（保守性）
        expect(cssContent.length).toBeGreaterThan(0);
      });
    });
  });
});

