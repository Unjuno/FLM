// apiCodeGenerator - API呼び出し用サンプルコード生成ユーティリティ

import type { ApiInfo } from '../types/api';
import { API_ENDPOINTS, SAMPLE_DATA } from '../constants/config';

/**
 * サンプルコード生成オプション
 */
export interface SampleCodeOptions {
  /** API情報 */
  apiInfo: ApiInfo;
  /** APIキー（オプション） */
  apiKey?: string;
  /** エンドポイントパス（デフォルト: '/v1/chat/completions'） */
  endpointPath?: string;
  /** モデル名（デフォルト: apiInfo.model_name） */
  modelName?: string;
  /** サンプルメッセージ（デフォルト: 'こんにちは'） */
  sampleMessage?: string;
}

/**
 * curl形式のサンプルコードを生成
 */
export function generateCurlCode(options: SampleCodeOptions): string {
  const {
    apiInfo,
    apiKey,
    endpointPath = API_ENDPOINTS.CHAT_COMPLETIONS,
    modelName,
    sampleMessage = SAMPLE_DATA.MESSAGE,
  } = options;

  const endpoint = apiInfo.endpoint;
  const model = modelName || apiInfo.model_name;
  const authHeader = apiKey ? `-H "Authorization: Bearer ${apiKey}" \\` : '';

  return `curl ${endpoint}${endpointPath} \\
  -H "Content-Type: application/json" \\
  ${authHeader}
  -d '{
    "model": "${model}",
    "messages": [
      {"role": "user", "content": "${sampleMessage}"}
    ]
  }'`;
}

/**
 * Python形式のサンプルコードを生成
 */
export function generatePythonCode(options: SampleCodeOptions): string {
  const {
    apiInfo,
    apiKey,
    endpointPath = API_ENDPOINTS.CHAT_COMPLETIONS,
    modelName,
    sampleMessage = SAMPLE_DATA.MESSAGE,
  } = options;

  const endpoint = apiInfo.endpoint;
  const model = modelName || apiInfo.model_name;
  const authHeader = apiKey ? `    "Authorization": "Bearer ${apiKey}",` : '';

  return `import requests

url = "${endpoint}${endpointPath}"
headers = {
    "Content-Type": "application/json"${authHeader ? `,\n${authHeader}` : ''}
}

data = {
    "model": "${model}",
    "messages": [
        {"role": "user", "content": "${sampleMessage}"}
    ]
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`;
}

/**
 * JavaScript形式のサンプルコードを生成
 */
export function generateJavaScriptCode(options: SampleCodeOptions): string {
  const {
    apiInfo,
    apiKey,
    endpointPath = API_ENDPOINTS.CHAT_COMPLETIONS,
    modelName,
    sampleMessage = SAMPLE_DATA.MESSAGE,
  } = options;

  const endpoint = apiInfo.endpoint;
  const model = modelName || apiInfo.model_name;
  const authHeader = apiKey ? `    "Authorization": "Bearer ${apiKey}",` : '';

  return `const response = await fetch("${endpoint}${endpointPath}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"${authHeader ? `,\n${authHeader}` : ''}
  },
  body: JSON.stringify({
    model: "${model}",
    messages: [
      { role: "user", content: "${sampleMessage}" }
    ]
  })
});

const data = await response.json();
console.log(data);`;
}

/**
 * サンプルコードを生成（言語指定）
 */
export function generateSampleCode(
  language: 'curl' | 'python' | 'javascript',
  options: SampleCodeOptions
): string {
  switch (language) {
    case 'curl':
      return generateCurlCode(options);
    case 'python':
      return generatePythonCode(options);
    case 'javascript':
      return generateJavaScriptCode(options);
    default:
      return '';
  }
}

