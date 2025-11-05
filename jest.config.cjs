/**
 * Jest設定ファイル
 * テストフレームワークの設定
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/unit/**/*.test.ts',
        '<rootDir>/tests/setup/**/*.test.ts'
      ],
      testPathIgnorePatterns: [
        '/tests/unit/print.test.ts',
        '/tests/unit/pdfExport.test.ts',
        '/tests/unit/Select.test.tsx',
        '/tests/unit/LogStatistics.test.tsx',
        '/tests/integration/',
        '/tests/e2e/',
        '/tests/performance/'
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            moduleResolution: 'node',
          },
        }],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^(.+)\\.js$': '$1',
      },
    },
    {
      displayName: 'jsdom',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/unit/print.test.ts',
        '<rootDir>/tests/unit/pdfExport.test.ts',
        '<rootDir>/tests/unit/**/*.test.tsx',
        '<rootDir>/tests/integration/**/*.test.ts',
        '<rootDir>/tests/performance/**/*.test.ts',
        '<rootDir>/tests/accessibility/**/*.test.tsx',
        '<rootDir>/tests/api/**/*.test.ts',
        '<rootDir>/tests/security/**/*.test.ts'
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: '<rootDir>/tsconfig.test.json',
        }],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^(.+)\\.js$': '$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/tests/setup/cssMock.js',
      },
      globals: {
        'import.meta': {
          env: {
            DEV: false,
          },
        },
      },
      // Tauri APIのモック設定を確実に適用
      setupFiles: ['<rootDir>/tests/setup/tauri-mock.ts'],
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            moduleResolution: 'node',
          },
        }],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^(.+)\\.js$': '$1',
      },
    },
  ],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(.+)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/tests/setup/tauri-mock.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  testTimeout: 10000,
};

