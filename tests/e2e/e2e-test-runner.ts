// e2e-test-runner - E2Eテストランナー

export const runE2ETests = async () => {
  if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
    console.log('E2Eテストスイートを開始します...');
  }
  
  // E2Eテストファイルのリスト
  const testFiles = [
    'tests/e2e/api-creation-flow.test.ts',
  ];
  
  return testFiles;
};

