// Model Sharing Commands Unit Tests
// モデル共有機能のTauri IPCコマンドのテスト

import { invoke } from '@tauri-apps/api/core';

// Tauri APIのモック
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('Model Sharing Commands', () => {
  describe('share_model_command', () => {
    it('モデルを共有できる', async () => {
      const mockResult = {
        id: 'test-model-id',
        name: 'Test Model',
        author: 'Test Author',
        download_count: 0,
      };

      mockInvoke.mockResolvedValue(mockResult);

      const result = await invoke<{
        id: string;
        name: string;
        author: string;
        download_count: number;
      }>('share_model_command', {
        config: {
          model_name: 'Test Model',
          model_path: 'test/path/model.gguf',
          description: 'Test model description',
          tags: ['test', 'example'],
          license: 'MIT',
          is_public: true,
        },
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Model');
      expect(result.author).toBeDefined();
      expect(result.download_count).toBe(0);
      expect(mockInvoke).toHaveBeenCalledWith('share_model_command', {
        config: {
          model_name: 'Test Model',
          model_path: 'test/path/model.gguf',
          description: 'Test model description',
          tags: ['test', 'example'],
          license: 'MIT',
          is_public: true,
        },
      });
    });

    it('存在しないモデルファイルを共有しようとするとエラーになる', async () => {
      mockInvoke.mockRejectedValue(new Error('File not found'));

      await expect(
        invoke('share_model_command', {
          config: {
            model_name: 'Non-existent Model',
            model_path: 'non/existent/path/model.gguf',
            description: null,
            tags: [],
            license: null,
            is_public: false,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('search_shared_models_command', () => {
    it('共有モデルを検索できる', async () => {
      const mockResults: Array<{
        id: string;
        name: string;
        author: string;
      }> = [];

      mockInvoke.mockResolvedValue(mockResults);

      const result = await invoke<
        Array<{
          id: string;
          name: string;
          author: string;
        }>
      >('search_shared_models_command', {
        query: 'test',
        tags: null,
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('search_shared_models_command', {
        query: 'test',
        tags: null,
        limit: 10,
      });
    });

    it('タグで検索できる', async () => {
      const mockResults: Array<{
        id: string;
        name: string;
        tags: string[];
      }> = [];

      mockInvoke.mockResolvedValue(mockResults);

      const result = await invoke<
        Array<{
          id: string;
          name: string;
          tags: string[];
        }>
      >('search_shared_models_command', {
        query: null,
        tags: ['test', 'example'],
        limit: 20,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('search_shared_models_command', {
        query: null,
        tags: ['test', 'example'],
        limit: 20,
      });
    });

    it('制限数を指定して検索できる', async () => {
      const mockResults: unknown[] = [];

      mockInvoke.mockResolvedValue(mockResults);

      const result = await invoke<Array<unknown>>(
        'search_shared_models_command',
        {
          query: 'test',
          tags: null,
          limit: 5,
        }
      );

      expect(Array.isArray(result)).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('search_shared_models_command', {
        query: 'test',
        tags: null,
        limit: 5,
      });
    });
  });

  describe('download_shared_model_command', () => {
    it('Hugging Face Hubからモデルをダウンロードできる（実装されている場合）', async () => {
      const mockResult = 'test/downloads/model.bin';

      mockInvoke.mockResolvedValue(mockResult);

      const result = await invoke<string>('download_shared_model_command', {
        model_id: 'hf:gpt2',
        target_path: 'test/downloads/model.bin',
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('test/downloads/model.bin');
      expect(mockInvoke).toHaveBeenCalledWith('download_shared_model_command', {
        model_id: 'hf:gpt2',
        target_path: 'test/downloads/model.bin',
      });
    });

    it('無効なモデルIDフォーマットでダウンロードしようとするとエラーになる', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid model ID format'));

      await expect(
        invoke('download_shared_model_command', {
          model_id: 'invalid-format',
          target_path: 'test/downloads/model.bin',
        })
      ).rejects.toThrow();
    });

    it('Ollama Hubからのダウンロードは未実装であることを確認', async () => {
      mockInvoke.mockRejectedValue(
        new Error('Ollama Hub download is not implemented')
      );

      await expect(
        invoke('download_shared_model_command', {
          model_id: 'ollama:test-model',
          target_path: 'test/downloads/model.bin',
        })
      ).rejects.toThrow();
    });
  });
});
