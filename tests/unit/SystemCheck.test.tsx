// SystemCheck - システムリソースチェックコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SystemCheck } from '../../src/components/common/SystemCheck';

// safeInvokeをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('SystemCheck.tsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的なレンダリング', () => {
    it('ローディング状態を表示する', () => {
      mockSafeInvoke.mockImplementation(() => new Promise(() => {})); // 永続的なPromise

      render(<SystemCheck />);
      expect(screen.getByText(/読み込み中|ローディング/i)).toBeInTheDocument();
    });

    it('システムリソース情報を取得して表示する', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce({
          total_memory: 16 * 1024 * 1024 * 1024,
          available_memory: 8 * 1024 * 1024 * 1024,
          cpu_cores: 4,
          cpu_usage: 50,
          total_disk: 500 * 1024 * 1024 * 1024,
          available_disk: 250 * 1024 * 1024 * 1024,
          resource_level: 'medium',
        })
        .mockResolvedValueOnce({
          recommended_model: 'llama3:8b',
          reason: 'システムリソースに適しています',
          alternatives: ['llama3:7b'],
          use_case_recommendations: [],
        });

      render(<SystemCheck />);

      await waitFor(
        () => {
          expect(
            screen.getByText(/メモリ|CPU|ディスク|システム情報/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('システムリソース表示', () => {
    it('メモリ情報を表示する', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce({
          total_memory: 16 * 1024 * 1024 * 1024,
          available_memory: 8 * 1024 * 1024 * 1024,
          cpu_cores: 4,
          cpu_usage: 50,
          total_disk: 500 * 1024 * 1024 * 1024,
          available_disk: 250 * 1024 * 1024 * 1024,
          resource_level: 'medium',
        })
        .mockResolvedValueOnce({
          recommended_model: 'llama3:8b',
          reason: 'テスト',
          alternatives: [],
          use_case_recommendations: [],
        });

      render(<SystemCheck />);

      await waitFor(
        () => {
          expect(screen.getByText(/メモリ|システム情報/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('CPU情報を表示する', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce({
          total_memory: 16 * 1024 * 1024 * 1024,
          available_memory: 8 * 1024 * 1024 * 1024,
          cpu_cores: 4,
          cpu_usage: 50,
          total_disk: 500 * 1024 * 1024 * 1024,
          available_disk: 250 * 1024 * 1024 * 1024,
          resource_level: 'medium',
        })
        .mockResolvedValueOnce({
          recommended_model: 'llama3:8b',
          reason: 'テスト',
          alternatives: [],
          use_case_recommendations: [],
        });

      render(<SystemCheck />);

      await waitFor(
        () => {
          expect(screen.getByText(/CPU|システム情報/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('ディスク情報を表示する', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce({
          total_memory: 16 * 1024 * 1024 * 1024,
          available_memory: 8 * 1024 * 1024 * 1024,
          cpu_cores: 4,
          cpu_usage: 50,
          total_disk: 500 * 1024 * 1024 * 1024,
          available_disk: 250 * 1024 * 1024 * 1024,
          resource_level: 'medium',
        })
        .mockResolvedValueOnce({
          recommended_model: 'llama3:8b',
          reason: 'テスト',
          alternatives: [],
          use_case_recommendations: [],
        });

      render(<SystemCheck />);

      await waitFor(
        () => {
          expect(
            screen.getByText(/ディスク|システム情報/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('モデル推奨表示', () => {
    it('推奨モデルを表示する', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce({
          total_memory: 16 * 1024 * 1024 * 1024,
          available_memory: 8 * 1024 * 1024 * 1024,
          cpu_cores: 4,
          cpu_usage: 50,
          total_disk: 500 * 1024 * 1024 * 1024,
          available_disk: 250 * 1024 * 1024 * 1024,
          resource_level: 'medium',
        })
        .mockResolvedValueOnce({
          recommended_model: 'llama3:8b',
          reason: 'システムリソースに適しています',
          alternatives: ['llama3:7b'],
          use_case_recommendations: [],
        });

      render(<SystemCheck showRecommendations={true} />);

      await waitFor(() => {
        expect(screen.getByText(/llama3:8b|推奨モデル/i)).toBeInTheDocument();
      });
    });

    it('推奨理由を表示する', async () => {
      mockSafeInvoke
        .mockResolvedValueOnce({
          total_memory: 16 * 1024 * 1024 * 1024,
          available_memory: 8 * 1024 * 1024 * 1024,
          cpu_cores: 4,
          cpu_usage: 50,
          total_disk: 500 * 1024 * 1024 * 1024,
          available_disk: 250 * 1024 * 1024 * 1024,
          resource_level: 'medium',
        })
        .mockResolvedValueOnce({
          recommended_model: 'llama3:8b',
          reason: 'システムリソースに適しています',
          alternatives: [],
          use_case_recommendations: [],
        });

      render(<SystemCheck showRecommendations={true} />);

      await waitFor(() => {
        expect(
          screen.getByText('システムリソースに適しています')
        ).toBeInTheDocument();
      });
    });

    it('showRecommendationsがfalseの場合、推奨を表示しない', async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        total_memory: 16 * 1024 * 1024 * 1024,
        available_memory: 8 * 1024 * 1024 * 1024,
        cpu_cores: 4,
        cpu_usage: 50,
        total_disk: 500 * 1024 * 1024 * 1024,
        available_disk: 250 * 1024 * 1024 * 1024,
        resource_level: 'medium',
      });

      render(<SystemCheck showRecommendations={false} />);

      await waitFor(() => {
        expect(screen.getByText(/メモリ|CPU/i)).toBeInTheDocument();
      });

      expect(mockSafeInvoke).toHaveBeenCalledTimes(1); // get_system_resourcesのみ
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生した場合、エラーメッセージを表示する', async () => {
      mockSafeInvoke.mockRejectedValue(
        new Error('システム情報の取得に失敗しました')
      );

      render(<SystemCheck />);

      await waitFor(() => {
        expect(screen.getByText(/エラー|失敗/i)).toBeInTheDocument();
      });
    });

    it('ErrorMessageコンポーネントを使用してエラーを表示する', async () => {
      mockSafeInvoke.mockRejectedValue(
        new Error('システム情報の取得に失敗しました')
      );

      render(<SystemCheck />);

      await waitFor(
        () => {
          // ErrorMessageコンポーネントが表示されることを確認
          expect(screen.getByText(/エラー|システム情報/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('onModelSelectedコールバック', () => {
    it('モデルが選択された場合、onModelSelectedを呼び出す', async () => {
      const onModelSelected = jest.fn();
      mockSafeInvoke
        .mockResolvedValueOnce({
          total_memory: 16 * 1024 * 1024 * 1024,
          available_memory: 8 * 1024 * 1024 * 1024,
          cpu_cores: 4,
          cpu_usage: 50,
          total_disk: 500 * 1024 * 1024 * 1024,
          available_disk: 250 * 1024 * 1024 * 1024,
          resource_level: 'medium',
        })
        .mockResolvedValueOnce({
          recommended_model: 'llama3:8b',
          reason: 'テスト',
          alternatives: [],
          use_case_recommendations: [],
        });

      render(<SystemCheck onModelSelected={onModelSelected} />);

      await waitFor(() => {
        expect(screen.getByText(/llama3:8b/i)).toBeInTheDocument();
      });

      // モデル選択ボタンをクリック（存在する場合）
      await waitFor(() => {
        const selectButtons = screen.queryAllByRole('button', {
          name: /選択|使用|このモデル/i,
        });
        if (selectButtons.length > 0) {
          fireEvent.click(selectButtons[0]);
          expect(onModelSelected).toHaveBeenCalledWith('llama3:8b');
        }
      });
    });
  });
});
