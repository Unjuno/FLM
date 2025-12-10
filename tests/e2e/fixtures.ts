// Test fixtures for E2E tests

export const testFixtures = {
  // Test engine configuration
  testEngine: {
    id: 'ollama',
    name: 'Ollama',
  },
  
  // Test proxy configuration
  testProxy: {
    mode: 'local-http',
    port: 8080,
  },
  
  // Test API key configuration
  testApiKey: {
    label: 'E2E Test Key',
  },
  
  // Test security policy
  testSecurityPolicy: {
    rate_limit: {
      rpm: 100,
      burst: 10,
    },
    ip_whitelist: [],
    ip_blocklist: [],
  },
  
  // Test model profile
  testModelProfile: {
    engine: 'ollama',
    model: 'llama2',
    parameters: {
      temperature: 0.7,
      max_tokens: 100,
    },
  },
};

/**
 * Get a unique test label
 */
export function getUniqueTestLabel(prefix: string = 'E2E Test'): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Create test proxy configuration
 */
export function createTestProxyConfig(port: number = 8080) {
  return {
    mode: 'local-http',
    port,
  };
}

/**
 * Create test security policy
 */
export function createTestSecurityPolicy() {
  return {
    rate_limit: {
      rpm: 100,
      burst: 10,
    },
  };
}

