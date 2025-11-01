/**
 * FLM - プロジェクト初期化確認テスト
 * 
 * フェーズ1: QAエージェント (QA) 実装
 * プロジェクト初期化の確認と検証
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * プロジェクト構造の検証テスト
 */
describe('Project Initialization Verification', () => {
  const projectRoot = path.resolve(__dirname, '../../');

  /**
   * 必須ディレクトリの存在確認
   */
  describe('Required directories', () => {
    it('should have src directory', () => {
      const srcDir = path.join(projectRoot, 'src');
      expect(fs.existsSync(srcDir)).toBe(true);
    });

    it('should have src-tauri directory', () => {
      const tauriDir = path.join(projectRoot, 'src-tauri');
      expect(fs.existsSync(tauriDir)).toBe(true);
    });

    it('should have src-tauri/src directory', () => {
      const tauriSrcDir = path.join(projectRoot, 'src-tauri/src');
      expect(fs.existsSync(tauriSrcDir)).toBe(true);
    });
  });

  /**
   * 必須ファイルの存在確認
   */
  describe('Required files', () => {
    it('should have package.json', () => {
      const packageJson = path.join(projectRoot, 'package.json');
      expect(fs.existsSync(packageJson)).toBe(true);
    });

    it('should have tauri.conf.json', () => {
      const tauriConfig = path.join(projectRoot, 'src-tauri/tauri.conf.json');
      expect(fs.existsSync(tauriConfig)).toBe(true);
    });

    it('should have Cargo.toml', () => {
      const cargoToml = path.join(projectRoot, 'src-tauri/Cargo.toml');
      expect(fs.existsSync(cargoToml)).toBe(true);
    });

    it('should have src/main.tsx', () => {
      const mainTsx = path.join(projectRoot, 'src/main.tsx');
      expect(fs.existsSync(mainTsx)).toBe(true);
    });

    it('should have src-tauri/src/main.rs', () => {
      const mainRs = path.join(projectRoot, 'src-tauri/src/main.rs');
      expect(fs.existsSync(mainRs)).toBe(true);
    });
  });

  /**
   * 設定ファイルの内容確認
   */
  describe('Configuration files', () => {
    it('should have valid package.json structure', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
    });

    it('should have required dependencies in package.json', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('@tauri-apps/api');
    });

    it('should have valid tauri.conf.json structure', () => {
      const tauriConfigPath = path.join(projectRoot, 'src-tauri/tauri.conf.json');
      const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf-8'));

      expect(tauriConfig).toHaveProperty('build');
      expect(tauriConfig).toHaveProperty('tauri');
    });

    it('should have valid Cargo.toml structure', () => {
      const cargoTomlPath = path.join(projectRoot, 'src-tauri/Cargo.toml');
      const cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');

      expect(cargoToml).toContain('[package]');
      expect(cargoToml).toContain('name = "flm"');
      expect(cargoToml).toContain('tauri');
    });
  });

  /**
   * プロジェクト構造の検証
   */
  describe('Project structure', () => {
    it('should have correct TypeScript configuration', () => {
      const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
      expect(fs.existsSync(tsConfigPath)).toBe(true);
    });

    it('should have vite configuration', () => {
      const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
      expect(fs.existsSync(viteConfigPath)).toBe(true);
    });

    it('should have App.tsx component', () => {
      const appTsx = path.join(projectRoot, 'src/App.tsx');
      expect(fs.existsSync(appTsx)).toBe(true);
    });
  });
});

