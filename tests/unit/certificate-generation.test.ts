// certificate-generation - 証明書自動生成機能の単体テスト

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ensureCertificateExists } from '../../src/backend/auth/certificate-generator.js';

/**
 * テスト用の一時ディレクトリ
 */
let testDataDir: string;
let testCertDir: string;

/**
 * 証明書自動生成機能単体テストスイート
 * 
 * テスト項目:
 * - 証明書の自動生成
 * - 証明書ファイルの存在確認
 * - 証明書ファイルの形式確認
 * - 既存証明書の再利用
 */
describe('Certificate Generation Unit Tests', () => {
  beforeAll(() => {
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('証明書自動生成機能単体テストを開始します');
    }
    
    testDataDir = path.join(os.tmpdir(), 'flm-test-certificates');
    testCertDir = path.join(testDataDir, 'certificates');
    process.env.FLM_DATA_DIR = testDataDir;
    
    if (!fs.existsSync(testCertDir)) {
      fs.mkdirSync(testCertDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('証明書自動生成機能単体テストを完了しました');
    }
    
    try {
      if (fs.existsSync(testCertDir)) {
        const files = fs.readdirSync(testCertDir);
        for (const file of files) {
          fs.unlinkSync(path.join(testCertDir, file));
        }
        fs.rmdirSync(testCertDir);
      }
      if (fs.existsSync(testDataDir)) {
        fs.rmdirSync(testDataDir);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
        console.warn('テスト用ファイルの削除に失敗:', err);
      }
    }
    
    delete process.env.FLM_DATA_DIR;
  });

  beforeEach(() => {
    // 各テスト前に証明書ディレクトリ内のファイルを削除
    try {
      if (fs.existsSync(testCertDir)) {
        const files = fs.readdirSync(testCertDir);
        for (const file of files) {
          fs.unlinkSync(path.join(testCertDir, file));
        }
      }
    } catch (err) {
      // ファイルが存在しない場合は無視
    }
  });

  /**
   * 証明書の自動生成テスト
   */
  describe('Certificate automatic generation', () => {
    it('should generate certificate and key files when they do not exist', async () => {
      const apiId = 'test-api-001';
      const port = 8080;
      
      // 証明書が存在しないことを確認
      const certPath = path.join(testCertDir, `${apiId}.pem`);
      const keyPath = path.join(testCertDir, `${apiId}.key`);
      expect(fs.existsSync(certPath)).toBe(false);
      expect(fs.existsSync(keyPath)).toBe(false);
      
      // 証明書を生成
      const result = await ensureCertificateExists(apiId, port);
      
      // 証明書ファイルが生成されたことを確認
      expect(result.certPath).toBe(certPath);
      expect(result.keyPath).toBe(keyPath);
      expect(fs.existsSync(result.certPath)).toBe(true);
      expect(fs.existsSync(result.keyPath)).toBe(true);
    }, 30000); // OpenSSLの実行に時間がかかる可能性があるため、タイムアウトを30秒に設定

    it('should generate PEM format certificate', async () => {
      const apiId = 'test-api-002';
      const port = 8080;
      
      const result = await ensureCertificateExists(apiId, port);
      
      // 証明書ファイルがPEM形式であることを確認
      const certContent = fs.readFileSync(result.certPath, 'utf-8');
      expect(certContent).toContain('-----BEGIN CERTIFICATE-----');
      expect(certContent).toContain('-----END CERTIFICATE-----');
      
      // 秘密鍵ファイルがPEM形式であることを確認
      const keyContent = fs.readFileSync(result.keyPath, 'utf-8');
      expect(keyContent).toContain('-----BEGIN');
      expect(keyContent).toContain('-----END');
    }, 30000);

    it('should generate certificate with non-zero file size', async () => {
      const apiId = 'test-api-003';
      const port = 8080;
      
      const result = await ensureCertificateExists(apiId, port);
      
      // ファイルサイズが0より大きいことを確認
      const certStats = fs.statSync(result.certPath);
      const keyStats = fs.statSync(result.keyPath);
      
      expect(certStats.size).toBeGreaterThan(0);
      expect(keyStats.size).toBeGreaterThan(0);
    }, 30000);

    it('should reuse existing certificate when it already exists', async () => {
      const apiId = 'test-api-004';
      const port = 8080;
      
      // 初回生成
      const result1 = await ensureCertificateExists(apiId, port);
      const firstCertContent = fs.readFileSync(result1.certPath, 'utf-8');
      const firstKeyContent = fs.readFileSync(result1.keyPath, 'utf-8');
      
      // 既存証明書の再利用
      const result2 = await ensureCertificateExists(apiId, port);
      const secondCertContent = fs.readFileSync(result2.certPath, 'utf-8');
      const secondKeyContent = fs.readFileSync(result2.keyPath, 'utf-8');
      
      // 同じパスを返すことを確認
      expect(result1.certPath).toBe(result2.certPath);
      expect(result1.keyPath).toBe(result2.keyPath);
      
      // 同じ内容であることを確認（再生成されていない）
      expect(firstCertContent).toBe(secondCertContent);
      expect(firstKeyContent).toBe(secondKeyContent);
    }, 30000);
  });

  /**
   * 証明書ディレクトリの作成テスト
   */
  describe('Certificate directory creation', () => {
    it('should create certificate directory if it does not exist', async () => {
      const apiId = 'test-api-005';
      const port = 8080;
      
      // ディレクトリを削除
      if (fs.existsSync(testCertDir)) {
        fs.rmSync(testCertDir, { recursive: true, force: true });
      }
      expect(fs.existsSync(testCertDir)).toBe(false);
      
      // 証明書を生成（ディレクトリも自動作成される）
      await ensureCertificateExists(apiId, port);
      
      // ディレクトリが作成されたことを確認
      expect(fs.existsSync(testCertDir)).toBe(true);
    }, 30000);
  });

  /**
   * 複数API IDの証明書生成テスト
   */
  describe('Multiple API certificate generation', () => {
    it('should generate separate certificates for different API IDs', async () => {
      const apiId1 = 'test-api-006';
      const apiId2 = 'test-api-007';
      const port = 8080;
      
      // 2つの異なるAPI IDで証明書を生成
      const result1 = await ensureCertificateExists(apiId1, port);
      const result2 = await ensureCertificateExists(apiId2, port);
      
      // 異なるパスを返すことを確認
      expect(result1.certPath).not.toBe(result2.certPath);
      expect(result1.keyPath).not.toBe(result2.keyPath);
      
      // 両方の証明書ファイルが存在することを確認
      expect(fs.existsSync(result1.certPath)).toBe(true);
      expect(fs.existsSync(result1.keyPath)).toBe(true);
      expect(fs.existsSync(result2.certPath)).toBe(true);
      expect(fs.existsSync(result2.keyPath)).toBe(true);
    }, 60000); // 2つの証明書生成のため、タイムアウトを60秒に設定
  });

  /**
   * ポート番号の処理テスト
   */
  describe('Port number handling', () => {
    it('should generate certificate for different ports', async () => {
      const apiId = 'test-api-008';
      const port1 = 8080;
      const port2 = 9000;
      
      // 異なるポートで証明書を生成（同じAPI IDでも別の証明書として扱う）
      // 注意: 現在の実装では、API IDのみが証明書名に使用されるため、
      // 同じAPI IDでは同じ証明書が再利用される
      const result1 = await ensureCertificateExists(apiId, port1);
      
      // 同じAPI IDでは同じ証明書が再利用される
      const result2 = await ensureCertificateExists(apiId, port2);
      
      expect(result1.certPath).toBe(result2.certPath);
      expect(result1.keyPath).toBe(result2.keyPath);
    }, 30000);
  });
});

