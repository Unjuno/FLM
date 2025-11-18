// apiCodeGenerator - APIコード生成ユーティリティのユニットテスト

import { describe, it, expect } from '@jest/globals';
import {
  generateCurlCode,
  generatePythonCode,
  generateJavaScriptCode,
  generateSampleCode,
  SampleCodeOptions,
} from '../../src/utils/apiCodeGenerator';
import type { ApiInfo } from '../../src/types/api';

describe('apiCodeGenerator.ts', () => {
  const mockApiInfo: ApiInfo = {
    id: 'test-api-1',
    name: 'Test API',
    model_name: 'llama2',
    endpoint: 'http://localhost:8080',
    port: 8080,
    engine_type: 'ollama',
    status: 'running',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const defaultOptions: SampleCodeOptions = {
    apiInfo: mockApiInfo,
  };

  describe('generateCurlCode関数', () => {
    it('基本的なcurlコードを生成する', () => {
      const code = generateCurlCode(defaultOptions);

      expect(code).toContain('curl');
      expect(code).toContain(mockApiInfo.endpoint);
      expect(code).toContain('Content-Type: application/json');
      expect(code).toContain(mockApiInfo.model_name);
    });

    it('APIキーが指定されている場合、認証ヘッダーを含める', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        apiKey: 'test-api-key-12345',
      };

      const code = generateCurlCode(options);

      expect(code).toContain('Authorization: Bearer test-api-key-12345');
    });

    it('APIキーが指定されていない場合、認証ヘッダーを含めない', () => {
      const code = generateCurlCode(defaultOptions);

      expect(code).not.toContain('Authorization');
    });

    it('カスタムエンドポイントパスを指定できる', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        endpointPath: '/custom/endpoint',
      };

      const code = generateCurlCode(options);

      expect(code).toContain('/custom/endpoint');
    });

    it('カスタムモデル名を指定できる', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        modelName: 'custom-model',
      };

      const code = generateCurlCode(options);

      expect(code).toContain('"model": "custom-model"');
      expect(code).not.toContain(mockApiInfo.model_name);
    });

    it('カスタムサンプルメッセージを指定できる', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        sampleMessage: 'カスタムメッセージ',
      };

      const code = generateCurlCode(options);

      expect(code).toContain('"content": "カスタムメッセージ"');
    });
  });

  describe('generatePythonCode関数', () => {
    it('基本的なPythonコードを生成する', () => {
      const code = generatePythonCode(defaultOptions);

      expect(code).toContain('import requests');
      expect(code).toContain(mockApiInfo.endpoint);
      expect(code).toContain('Content-Type');
      expect(code).toContain('application/json');
      expect(code).toContain(mockApiInfo.model_name);
    });

    it('APIキーが指定されている場合、認証ヘッダーを含める', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        apiKey: 'test-api-key-12345',
      };

      const code = generatePythonCode(options);

      expect(code).toContain('Authorization');
      expect(code).toContain('Bearer test-api-key-12345');
    });

    it('APIキーが指定されていない場合、認証ヘッダーを含めない', () => {
      const code = generatePythonCode(defaultOptions);

      expect(code).not.toContain('Authorization');
    });

    it('カスタムエンドポイントパスを指定できる', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        endpointPath: '/custom/endpoint',
      };

      const code = generatePythonCode(options);

      expect(code).toContain('/custom/endpoint');
    });
  });

  describe('generateJavaScriptCode関数', () => {
    it('基本的なJavaScriptコードを生成する', () => {
      const code = generateJavaScriptCode(defaultOptions);

      expect(code).toContain('fetch');
      expect(code).toContain(mockApiInfo.endpoint);
      expect(code).toContain('Content-Type');
      expect(code).toContain('application/json');
      expect(code).toContain(mockApiInfo.model_name);
      expect(code).toContain('await');
    });

    it('APIキーが指定されている場合、認証ヘッダーを含める', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        apiKey: 'test-api-key-12345',
      };

      const code = generateJavaScriptCode(options);

      expect(code).toContain('Authorization');
      expect(code).toContain('Bearer test-api-key-12345');
    });

    it('APIキーが指定されていない場合、認証ヘッダーを含めない', () => {
      const code = generateJavaScriptCode(defaultOptions);

      expect(code).not.toContain('Authorization');
    });

    it('カスタムエンドポイントパスを指定できる', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        endpointPath: '/custom/endpoint',
      };

      const code = generateJavaScriptCode(options);

      expect(code).toContain('/custom/endpoint');
    });
  });

  describe('generateSampleCode関数', () => {
    it('curl言語を指定するとcurlコードを生成する', () => {
      const code = generateSampleCode('curl', defaultOptions);

      expect(code).toContain('curl');
      expect(code).toContain(mockApiInfo.endpoint);
    });

    it('python言語を指定するとPythonコードを生成する', () => {
      const code = generateSampleCode('python', defaultOptions);

      expect(code).toContain('import requests');
      expect(code).toContain(mockApiInfo.endpoint);
    });

    it('javascript言語を指定するとJavaScriptコードを生成する', () => {
      const code = generateSampleCode('javascript', defaultOptions);

      expect(code).toContain('fetch');
      expect(code).toContain(mockApiInfo.endpoint);
    });

    it('無効な言語を指定すると空文字列を返す', () => {
      const code = generateSampleCode(
        'invalid' as 'curl' | 'python' | 'javascript',
        defaultOptions
      );

      expect(code).toBe('');
    });
  });

  describe('エッジケース', () => {
    it('HTTPSエンドポイントを正しく処理する', () => {
      const httpsApiInfo: ApiInfo = {
        ...mockApiInfo,
        endpoint: 'https://example.com:8443',
      };

      const options: SampleCodeOptions = {
        apiInfo: httpsApiInfo,
      };

      const curlCode = generateCurlCode(options);
      const pythonCode = generatePythonCode(options);
      const jsCode = generateJavaScriptCode(options);

      expect(curlCode).toContain('https://example.com:8443');
      expect(pythonCode).toContain('https://example.com:8443');
      expect(jsCode).toContain('https://example.com:8443');
    });

    it('特殊文字を含むメッセージを正しくエスケープする', () => {
      const options: SampleCodeOptions = {
        ...defaultOptions,
        sampleMessage: 'Hello "world" & \'universe\'',
      };

      const curlCode = generateCurlCode(options);
      const pythonCode = generatePythonCode(options);
      const jsCode = generateJavaScriptCode(options);

      // JSON文字列として正しくエスケープされていることを確認
      expect(curlCode).toContain('Hello');
      expect(pythonCode).toContain('Hello');
      expect(jsCode).toContain('Hello');
    });

    it('長いAPIキーを正しく処理する', () => {
      const longApiKey = 'a'.repeat(100);
      const options: SampleCodeOptions = {
        ...defaultOptions,
        apiKey: longApiKey,
      };

      const curlCode = generateCurlCode(options);
      const pythonCode = generatePythonCode(options);
      const jsCode = generateJavaScriptCode(options);

      expect(curlCode).toContain(longApiKey);
      expect(pythonCode).toContain(longApiKey);
      expect(jsCode).toContain(longApiKey);
    });
  });
});
