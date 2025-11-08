// print - 印刷ユーティリティのユニットテスト

/**
 * @jest-environment jsdom
 * 注意: このテストはwindow.print()を使用するため、jsdom環境が必要です
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { printElement, printPage, printSelector } from '../../src/utils/print';

// window.print をモック
const mockPrint = jest.fn();
const mockClose = jest.fn();
const mockWrite = jest.fn();
const mockDocumentClose = jest.fn();

interface MockWindow {
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
    // モック関数をリセット
    mockPrint.mockClear();
    mockClose.mockClear();
    mockWrite.mockClear();
    mockDocumentClose.mockClear();

    // window.printをモック
    window.print = mockPrint;

    // window.openをモック（printElement内でonloadが設定されるため、参照を保持）
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

    // window.openが返すWindowオブジェクトは、mockWindowへの参照を持つ
    window.open = jest.fn(() => {
      // printElement内でonloadが設定されるため、同じオブジェクト参照を返す
      return mockWindow as unknown as Window;
    });

    // タイマーをモック
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('printElement', () => {
    it('デフォルトオプションでbody全体を印刷する', async () => {
      document.body.innerHTML = '<div>テストコンテンツ</div>';

      // printElementは非同期関数だが、内部の同期処理（window.open, document.write, onload設定）は即座に実行される
      const printPromise = printElement({});

      // ウィンドウが開かれることを確認（printElement内で同期的に実行される）
      expect(window.open).toHaveBeenCalledWith('', '_blank');

      // document.writeが呼ばれたことを確認（printElement内で同期的に実行される）
      expect(mockWindow.document.write).toHaveBeenCalled();

      // onloadが設定されていることを確認（printElement内でdocument.writeの後に設定される）
      // 注意: printElement内でprintWindow.onloadが設定されるため、mockWindow.onloadも設定される
      expect(mockWindow.onload).not.toBeNull();
      expect(typeof mockWindow.onload).toBe('function');

      // onloadを実行して印刷処理を開始
      if (mockWindow.onload) {
        mockWindow.onload();
      }

      // タイマーを進める（PRINT_DELAY_MS + WINDOW_CLOSE_DELAY_MS）
      jest.advanceTimersByTime(500); // PRINT_DELAY_MS
      jest.advanceTimersByTime(1000); // WINDOW_CLOSE_DELAY_MS

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

      // printElementは非同期関数だが、内部の同期処理（window.open, document.write, onload設定）は即座に実行される
      const printPromise = printElement({ title: 'カスタムタイトル' });

      // ウィンドウが開かれることを確認（printElement内で同期的に実行される）
      expect(window.open).toHaveBeenCalledWith('', '_blank');

      // document.writeが呼ばれたことを確認（printElement内で同期的に実行される）
      expect(mockWindow.document.write).toHaveBeenCalled();
      const writtenContent = mockWindow.document.write.mock.calls[0]?.[0];
      expect(writtenContent).toContain('カスタムタイトル');

      // onloadが設定されていることを確認（printElement内でdocument.writeの後に設定される）
      expect(mockWindow.onload).not.toBeNull();
      expect(typeof mockWindow.onload).toBe('function');

      // onloadを実行して印刷処理を開始
      if (mockWindow.onload) {
        mockWindow.onload();
      }

      // タイマーを進める（PRINT_DELAY_MS + WINDOW_CLOSE_DELAY_MS）
      jest.advanceTimersByTime(500); // PRINT_DELAY_MS
      jest.advanceTimersByTime(1000); // WINDOW_CLOSE_DELAY_MS

      await printPromise;
    });

    it('beforePrintコールバックを実行する', async () => {
      const beforePrint = jest.fn<() => void | Promise<void>>();

      document.body.innerHTML = '<div>コンテンツ</div>';

      const printPromise = printElement({ beforePrint });

      // beforePrintコールバックは同期的に実行されるため、即座にチェック
      // printElementは同期的にbeforePrintを呼び出すため、awaitは不要
      expect(beforePrint).toHaveBeenCalled();

      if (mockWindow.onload) {
        mockWindow.onload();
      }

      jest.advanceTimersByTime(500);

      await printPromise;
    });

    it('afterPrintコールバックを実行する', async () => {
      const afterPrint = jest.fn<() => void | Promise<void>>();

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
      const mockAlert = jest
        .spyOn(window, 'alert')
        .mockImplementation(() => {});

      await printElement({});

      expect(mockAlert).toHaveBeenCalled();

      mockAlert.mockRestore();
    });

    it('存在しないセレクタの場合にエラーを処理する', async () => {
      document.body.innerHTML = '<div>コンテンツ</div>';

      const mockAlert = jest
        .spyOn(window, 'alert')
        .mockImplementation(() => {});

      await printElement({ targetElement: '#nonexistent' });

      expect(mockAlert).toHaveBeenCalled();

      mockAlert.mockRestore();
    });
  });

  describe('printPage', () => {
    it('現在のページを印刷する', async () => {
      document.body.innerHTML = '<div>ページコンテンツ</div>';

      // printPageは非同期関数で、内部でprintElementを呼び出す
      // printElement内でbeforePrint（同期的、awaitされる）→ window.open → document.write → onload設定が実行される
      const printPromise = printPage();

      // printElement内でbeforePrintがawaitされるため、マイクロタスクキューが処理されるまで待つ
      // jest.useFakeTimers()を使っている場合、Promise.resolve()は即座に実行されるが、
      // 念のため複数のマイクロタスクを処理する
      await Promise.resolve();
      await Promise.resolve();

      // ウィンドウが開かれることを確認（printElement内で同期的に実行される）
      expect(window.open).toHaveBeenCalledWith('', '_blank');

      // document.writeが呼ばれたことを確認（printElement内で同期的に実行される）
      expect(mockWindow.document.write).toHaveBeenCalled();

      // onloadが設定されていることを確認（printElement内でdocument.writeの後に設定される）
      expect(mockWindow.onload).not.toBeNull();
      expect(typeof mockWindow.onload).toBe('function');

      // onloadを実行して印刷処理を開始
      if (mockWindow.onload) {
        mockWindow.onload();
      }

      jest.advanceTimersByTime(500); // PRINT_DELAY_MS
      jest.advanceTimersByTime(1000); // WINDOW_CLOSE_DELAY_MS

      await printPromise;

      expect(mockWindow.print).toHaveBeenCalled();
    });

    it('カスタムタイトルを指定できる', async () => {
      document.body.innerHTML = '<div>ページコンテンツ</div>';

      // printPageは非同期関数で、内部でprintElementを呼び出す
      // printElement内でbeforePrint（同期的、awaitされる）→ window.open → document.write → onload設定が実行される
      const printPromise = printPage('カスタムページタイトル');

      // printElement内でbeforePrintがawaitされるため、マイクロタスクキューが処理されるまで待つ
      // jest.useFakeTimers()を使っている場合、Promise.resolve()は即座に実行されるが、
      // 念のため複数のマイクロタスクを処理する
      await Promise.resolve();
      await Promise.resolve();

      // ウィンドウが開かれることを確認（printElement内で同期的に実行される）
      expect(window.open).toHaveBeenCalledWith('', '_blank');

      // document.writeが呼ばれたことを確認（printElement内で同期的に実行される）
      expect(mockWindow.document.write).toHaveBeenCalled();
      const writtenContent = mockWindow.document.write.mock.calls[0]?.[0];
      expect(writtenContent).toContain('カスタムページタイトル');

      // onloadが設定されていることを確認（printElement内でdocument.writeの後に設定される）
      expect(mockWindow.onload).not.toBeNull();
      expect(typeof mockWindow.onload).toBe('function');

      // onloadを実行して印刷処理を開始
      if (mockWindow.onload) {
        mockWindow.onload();
      }

      jest.advanceTimersByTime(500); // PRINT_DELAY_MS
      jest.advanceTimersByTime(1000); // WINDOW_CLOSE_DELAY_MS

      await printPromise;
    });
  });

  describe('printSelector', () => {
    it('指定したセレクタの要素を印刷する', async () => {
      document.body.innerHTML = '<div class="content">コンテンツ</div>';

      const printPromise = printSelector('.content');

      // document.writeが呼ばれるまで少し待つ（同期的に実行される）
      jest.advanceTimersByTime(0);

      if (mockWindow.onload) {
        mockWindow.onload();
      }

      jest.advanceTimersByTime(500); // PRINT_DELAY_MS
      jest.advanceTimersByTime(1000); // WINDOW_CLOSE_DELAY_MS

      await printPromise;

      expect(window.open).toHaveBeenCalled();
      expect(mockWindow.print).toHaveBeenCalled();
    });

    it('カスタムタイトルを指定できる', async () => {
      document.body.innerHTML = '<div class="content">コンテンツ</div>';

      const printPromise = printSelector('.content', 'セレクタタイトル');

      // document.writeが呼ばれるまで少し待つ（同期的に実行される）
      jest.advanceTimersByTime(0);

      // タイトルが含まれることを確認
      expect(mockWindow.document.write).toHaveBeenCalled();
      const writtenContent = mockWindow.document.write.mock.calls[0]?.[0];
      expect(writtenContent).toContain('セレクタタイトル');

      // onloadを呼んでからタイマーを進める
      if (mockWindow.onload) {
        mockWindow.onload();
      }

      jest.advanceTimersByTime(500); // PRINT_DELAY_MS
      jest.advanceTimersByTime(1000); // WINDOW_CLOSE_DELAY_MS

      await printPromise;
    });
  });
});
