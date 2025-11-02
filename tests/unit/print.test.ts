// FLM - 印刷ユーティリティのユニットテスト
// QA + FE 実装
// TEST-013-03: ユニットテスト追加

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { printElement, printPage, printSelector } from '../../src/utils/print';

// window.print をモック
const mockPrint = jest.fn();
const mockClose = jest.fn();
const mockWrite = jest.fn();
const mockDocumentClose = jest.fn();

interface MockWindow extends Partial<Window> {
  document: {
    write: jest.Mock;
    close: jest.Mock;
  };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  print: jest.Mock;
  close: jest.Mock;
}

describe('print.ts', () => {
  let mockWindow: MockWindow;

  beforeEach(() => {
    // window.printをモック
    window.print = mockPrint;
    
    // window.openをモック
    mockWindow = {
      document: {
        write: mockWrite,
        close: mockDocumentClose,
      },
      onload: null,
      onerror: null,
      print: mockPrint,
      close: mockClose,
    };
    
    window.open = jest.fn(() => mockWindow as Window);
    
    // タイマーをモック
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('printElement', () => {
    it('デフォルトオプションでbody全体を印刷する', async () => {
      document.body.innerHTML = '<div>テストコンテンツ</div>';
      
      const printPromise = printElement({});
      
      // ウィンドウが開かれることを確認
      expect(window.open).toHaveBeenCalledWith('', '_blank');
      
      // onloadが呼ばれるまで待つ
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      // タイマーを進める
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      // printが呼ばれることを確認
      expect(mockWindow.print).toHaveBeenCalled();
    });

    it('指定したセレクタの要素を印刷する', async () => {
      document.body.innerHTML = '<div id="target">ターゲット要素</div>';
      
      const printPromise = printElement({ targetElement: '#target' });
      
      expect(window.open).toHaveBeenCalled();
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      // document.writeにHTMLが書き込まれることを確認
      expect(mockWindow.document.write).toHaveBeenCalled();
    });

    it('カスタムタイトルを指定できる', async () => {
      document.body.innerHTML = '<div>コンテンツ</div>';
      
      const printPromise = printElement({ title: 'カスタムタイトル' });
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      // タイトルが含まれることを確認
      const writtenContent = mockWindow.document.write.mock.calls[0]?.[0];
      expect(writtenContent).toContain('カスタムタイトル');
    });

    it('beforePrintコールバックを実行する', async () => {
      const beforePrint = jest.fn();
      
      document.body.innerHTML = '<div>コンテンツ</div>';
      
      const printPromise = printElement({ beforePrint });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(beforePrint).toHaveBeenCalled();
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
    });

    it('afterPrintコールバックを実行する', async () => {
      const afterPrint = jest.fn();
      
      document.body.innerHTML = '<div>コンテンツ</div>';
      
      const printPromise = printElement({ afterPrint });
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      expect(afterPrint).toHaveBeenCalled();
    });

    it('ポップアップがブロックされた場合にエラーを処理する', async () => {
      (window.open as jest.Mock).mockReturnValue(null);
      
      document.body.innerHTML = '<div>コンテンツ</div>';
      
      // alertをモック
      const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      await printElement({});
      
      expect(mockAlert).toHaveBeenCalled();
      
      mockAlert.mockRestore();
    });

    it('存在しないセレクタの場合にエラーを処理する', async () => {
      document.body.innerHTML = '<div>コンテンツ</div>';
      
      const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      await printElement({ targetElement: '#nonexistent' });
      
      expect(mockAlert).toHaveBeenCalled();
      
      mockAlert.mockRestore();
    });
  });

  describe('printPage', () => {
    it('現在のページを印刷する', async () => {
      document.body.innerHTML = '<div>ページコンテンツ</div>';
      
      const printPromise = printPage();
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      expect(window.open).toHaveBeenCalled();
      expect(mockWindow.print).toHaveBeenCalled();
    });

    it('カスタムタイトルを指定できる', async () => {
      document.body.innerHTML = '<div>ページコンテンツ</div>';
      
      const printPromise = printPage('カスタムページタイトル');
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      const writtenContent = mockWindow.document.write.mock.calls[0]?.[0];
      expect(writtenContent).toContain('カスタムページタイトル');
    });
  });

  describe('printSelector', () => {
    it('指定したセレクタの要素を印刷する', async () => {
      document.body.innerHTML = '<div class="content">コンテンツ</div>';
      
      const printPromise = printSelector('.content');
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      expect(window.open).toHaveBeenCalled();
      expect(mockWindow.print).toHaveBeenCalled();
    });

    it('カスタムタイトルを指定できる', async () => {
      document.body.innerHTML = '<div class="content">コンテンツ</div>';
      
      const printPromise = printSelector('.content', 'セレクタタイトル');
      
      if (mockWindow.onload) {
        mockWindow.onload();
      }
      
      jest.advanceTimersByTime(500);
      
      await printPromise;
      
      const writtenContent = mockWindow.document.write.mock.calls[0]?.[0];
      expect(writtenContent).toContain('セレクタタイトル');
    });
  });
});
