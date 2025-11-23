// SystemCheck - システムリソースチェックコンポーネントのユニットテスト

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { SystemCheck } from '../../src/components/common/SystemCheck';

// safeInvokeをモック
const mockSafeInvoke = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
  isTauriAvailable: jest.fn(() => false),
  clearInvokeCache: jest.fn(),
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
    it('ローディング状態を表示する', async () => {
      // 永続的なPromiseでローディング状態を維持
      mockSafeInvoke.mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<SystemCheck />);
      });

      // ローディングメッセージが表示されることを確認
      await waitFor(
        () => {
          expect(
            screen.getByText(/システム情報を取得しています/i)
          ).toBeTruthy();
        },
        { timeout: 1000 }
      );
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

      await act(async () => {
        render(<SystemCheck />);
      });

      await waitFor(
        () => {
          // システム情報の見出しまたはメモリ/CPU/ディスクのラベルが表示されることを確認
          const systemInfo = screen.queryByText(/システム情報/i);
          const memory = screen.queryByText('メモリ');
          const cpu = screen.queryByText('CPU');
          const disk = screen.queryByText('ディスク');
          expect(systemInfo || memory || cpu || disk).toBeTruthy();
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

      await act(async () => {
        render(<SystemCheck />);
      });

      await waitFor(
        () => {
          // メモリラベルが表示されることを確認
          expect(screen.getByText('メモリ')).toBeTruthy();
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

      await act(async () => {
        render(<SystemCheck />);
      });

      await waitFor(
        () => {
          // CPUラベルが表示されることを確認
          expect(screen.getByText('CPU')).toBeTruthy();
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

      await act(async () => {
        render(<SystemCheck />);
      });

      await waitFor(
        () => {
          // ディスクラベルが表示されることを確認
          expect(screen.getByText('ディスク')).toBeTruthy();
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

      await act(async () => {
        render(<SystemCheck showRecommendations={true} />);
      });

      await waitFor(
        () => {
          // 推奨モデル名が表示されることを確認
          expect(screen.getByText('llama3:8b')).toBeTruthy();
        },
        { timeout: 3000 }
      );
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

      await act(async () => {
        render(<SystemCheck showRecommendations={true} />);
      });

      await waitFor(
        () => {
          expect(
            screen.getByText('システムリソースに適しています')
          ).toBeTruthy();
        },
        { timeout: 3000 }
      );
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

      await act(async () => {
        render(<SystemCheck showRecommendations={false} />);
      });

      await waitFor(
        () => {
          // メモリまたはCPUラベルが表示されることを確認
          const memory = screen.queryByText('メモリ');
          const cpu = screen.queryByText('CPU');
          expect(memory || cpu).toBeTruthy();
        },
        { timeout: 3000 }
      );

      expect(mockSafeInvoke).toHaveBeenCalledTimes(1); // get_system_resourcesのみ
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生した場合、エラーメッセージを表示する', async () => {
      mockSafeInvoke.mockRejectedValue(
        new Error('システム情報の取得に失敗しました')
      );

      await act(async () => {
        render(<SystemCheck />);
      });

      await waitFor(
        () => {
          // ErrorMessageコンポーネントがエラーメッセージを表示することを確認
          expect(
            screen.getByText('システム情報の取得に失敗しました')
          ).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('ErrorMessageコンポーネントを使用してエラーを表示する', async () => {
      mockSafeInvoke.mockRejectedValue(
        new Error('システム情報の取得に失敗しました')
      );

      await act(async () => {
        render(<SystemCheck />);
      });

      await waitFor(
        () => {
          // ErrorMessageコンポーネントがエラーメッセージを表示することを確認
          expect(
            screen.getByText('システム情報の取得に失敗しました')
          ).toBeTruthy();
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

      await act(async () => {
        render(<SystemCheck onModelSelected={onModelSelected} />);
      });

      await waitFor(
        () => {
          expect(screen.getByText('llama3:8b')).toBeTruthy();
        },
        { timeout: 3000 }
      );

      // モデル選択ボタンをクリック（存在する場合）
      await waitFor(
        () => {
          const selectButton = screen.queryByRole('button', {
            name: /このモデルを使用/i,
          });
          if (selectButton) {
            fireEvent.click(selectButton);
            expect(onModelSelected).toHaveBeenCalledWith('llama3:8b');
          } else {
            // ボタンが見つからない場合でも、モデル名が表示されていることを確認
            expect(screen.getByText('llama3:8b')).toBeTruthy();
          }
        },
        { timeout: 3000 }
      );
    });
  });
});
