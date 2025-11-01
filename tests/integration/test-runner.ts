/**
 * FLM - 統合テストランナー
 * 
 * フェーズ4: QAエージェント (QA) 実装
 * 統合テストスイートの実行とレポート生成
 */

/**
 * 統合テスト実行用のヘルパー関数
 * Jestの設定と統合して使用
 */
export const runIntegrationTests = async () => {
  console.log('統合テストスイートを開始します...');
  
  // テストファイルのリスト
  const testFiles = [
    'tests/integration/f001-api-creation.test.ts',
    'tests/integration/f003-api-management.test.ts',
    'tests/integration/f004-model-management.test.ts',
  ];
  
  return testFiles;
};

