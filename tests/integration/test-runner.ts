// test-runner - 統合テストランナー

export const runIntegrationTests = async () => {
  if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
    console.log('統合テストスイートを開始します...');
  }
  
  // テストファイルのリスト
  const testFiles = [
    'tests/integration/f001-api-creation.test.ts',
    'tests/integration/f003-api-management.test.ts',
    'tests/integration/f004-model-management.test.ts',
  ];
  
  return testFiles;
};

