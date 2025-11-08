// OllamaDownload - Ollamaダウンロード進捗表示UIコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OllamaDownload } from '../../src/components/common/OllamaDownload';

// useOllamaDownloadをモック
const mockDownloadStatus = jest.fn();
const mockProgress = jest.fn();
const mockError = jest.fn();
const mockDownload = jest.fn();
const mockReset = jest.fn();

jest.mock('../../src/hooks/useOllama', () => ({
  useOllamaDownload: () => ({
    downloadStatus: mockDownloadStatus(),
    progress: mockProgress(),
    error: mockError(),
    download: mockDownload,
    reset: mockReset,
  }),
}));

describe('OllamaDownload.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadStatus.mockReturnValue('idle');
    mockProgress.mockReturnValue(null);
    mockError.mockReturnValue(null);
  });

  describe('初期状態（idle）', () => {
    it('ダウンロードプロンプトを表示する', () => {
      render(<OllamaDownload />);
      expect(screen.getByText('Ollamaをダウンロード')).toBeInTheDocument();
      expect(
        screen.getByText(/Ollamaが見つかりませんでした/i)
      ).toBeInTheDocument();
    });

    it('ダウンロード開始ボタンを表示する', () => {
      render(<OllamaDownload />);
      const button = screen.getByRole('button', { name: /ダウンロード開始/i });
      expect(button).toBeInTheDocument();
    });

    it('ダウンロード開始ボタンをクリックするとdownload関数を呼び出す', () => {
      render(<OllamaDownload />);
      const button = screen.getByRole('button', { name: /ダウンロード開始/i });
      fireEvent.click(button);
      expect(mockDownload).toHaveBeenCalledTimes(1);
    });

    it('プラットフォームを指定してダウンロードを開始する', () => {
      render(<OllamaDownload platform="windows" />);
      const button = screen.getByRole('button', { name: /ダウンロード開始/i });
      fireEvent.click(button);
      expect(mockDownload).toHaveBeenCalledWith('windows');
    });
  });

  describe('ダウンロード中（downloading）', () => {
    beforeEach(() => {
      mockDownloadStatus.mockReturnValue('downloading');
      mockProgress.mockReturnValue({
        downloaded_bytes: 1000000,
        total_bytes: 5000000,
        speed_bytes_per_sec: 1000000,
        progress: 20,
        status: 'downloading',
        message: null,
      });
    });

    it('ダウンロード進捗を表示する', () => {
      render(<OllamaDownload />);
      expect(screen.getByText(/ダウンロード中/i)).toBeInTheDocument();
    });

    it('進捗パーセンテージを表示する', () => {
      render(<OllamaDownload />);
      // 20%の進捗（1000000 / 5000000）
      expect(screen.getByText(/20|%|パーセント/i)).toBeInTheDocument();
    });

    it('ダウンロード速度を表示する', () => {
      render(<OllamaDownload />);
      expect(screen.getByText(/MB\/s|KB\/s|B\/s/i)).toBeInTheDocument();
    });

    it('残り時間を表示する（計算可能な場合）', () => {
      render(<OllamaDownload />);
      // 残り4MB、速度1MB/s = 4秒
      // 複数の要素が見つかる可能性があるため、queryAllByTextを使用
      const timeElements = screen.queryAllByText(/秒|分|残り/i);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe('ダウンロード完了（completed）', () => {
    beforeEach(() => {
      mockDownloadStatus.mockReturnValue('completed');
      mockProgress.mockReturnValue({
        downloaded_bytes: 5000000,
        total_bytes: 5000000,
        speed_bytes_per_sec: 0,
        progress: 100,
        status: 'completed',
        message: null,
      });
    });

    it('完了メッセージを表示する', () => {
      render(<OllamaDownload />);
      expect(screen.getByText('ダウンロード完了')).toBeInTheDocument();
    });

    it('onCompleteコールバックを呼び出す', async () => {
      const onComplete = jest.fn();
      const { rerender } = render(<OllamaDownload onComplete={onComplete} />);

      // ステータスをcompletedに変更
      mockDownloadStatus.mockReturnValue('completed');
      rerender(<OllamaDownload onComplete={onComplete} />);

      await waitFor(
        () => {
          expect(onComplete).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('エラー状態', () => {
    beforeEach(() => {
      mockDownloadStatus.mockReturnValue('error');
      mockError.mockReturnValue('ダウンロードに失敗しました');
    });

    it('エラーメッセージを表示する', () => {
      render(<OllamaDownload />);
      expect(
        screen.getByText('ダウンロードに失敗しました')
      ).toBeInTheDocument();
    });

    it('リトライボタンを表示する', () => {
      render(<OllamaDownload />);
      const retryButton = screen.getByRole('button', {
        name: /再試行|リトライ/i,
      });
      expect(retryButton).toBeInTheDocument();
    });

    it('リトライボタンをクリックするとresetとdownloadを呼び出す', () => {
      render(<OllamaDownload />);
      const retryButton = screen.getByRole('button', {
        name: /再試行|リトライ/i,
      });
      fireEvent.click(retryButton);
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(mockDownload).toHaveBeenCalledTimes(1);
    });

    it('onErrorコールバックを呼び出す', async () => {
      const onError = jest.fn();
      const { rerender } = render(<OllamaDownload onError={onError} />);

      // ステータスをerrorに変更
      mockDownloadStatus.mockReturnValue('error');
      mockError.mockReturnValue('エラーメッセージ');
      rerender(<OllamaDownload onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('エラーメッセージ');
      });
    });
  });

  describe('進捗計算', () => {
    it('進捗が0%の場合、0%を表示する', () => {
      mockDownloadStatus.mockReturnValue('downloading');
      mockProgress.mockReturnValue({
        downloaded_bytes: 0,
        total_bytes: 1000000,
        speed_bytes_per_sec: 0,
        progress: 0,
        status: 'downloading',
        message: null,
      });

      const { container } = render(<OllamaDownload />);
      const percentageElement = container.querySelector('.progress-percentage');
      expect(percentageElement).toBeInTheDocument();
      expect(percentageElement?.textContent).toContain('0');
    });

    it('進捗が100%の場合、100%を表示する', () => {
      mockDownloadStatus.mockReturnValue('downloading');
      mockProgress.mockReturnValue({
        downloaded_bytes: 1000000,
        total_bytes: 1000000,
        speed_bytes_per_sec: 0,
        progress: 100,
        status: 'downloading',
        message: null,
      });

      const { container } = render(<OllamaDownload />);
      const percentageElement = container.querySelector('.progress-percentage');
      expect(percentageElement).toBeInTheDocument();
      expect(percentageElement?.textContent).toContain('100');
    });

    it('速度が0の場合、残り時間を計算中と表示する', () => {
      mockDownloadStatus.mockReturnValue('downloading');
      mockProgress.mockReturnValue({
        downloaded_bytes: 1000000,
        total_bytes: 5000000,
        speed_bytes_per_sec: 0,
        progress: 20,
        status: 'downloading',
        message: null,
      });

      render(<OllamaDownload />);
      expect(screen.getByText(/計算中|待機/i)).toBeInTheDocument();
    });
  });
});
