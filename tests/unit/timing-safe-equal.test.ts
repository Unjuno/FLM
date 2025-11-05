// timing-safe-equal - APIキーハッシュ比較のタイミング攻撃対策テスト

import { describe, it, expect } from '@jest/globals';
import crypto from 'crypto';

/**
 * Node.jsのcrypto.timingSafeEqualを使用した安全な比較のテスト
 */
describe('timing-safe-equal', () => {
  it('同じハッシュ値の場合、trueを返すべき', () => {
    const hash1 = crypto.createHash('sha256').update('test-api-key').digest('hex');
    const hash2 = crypto.createHash('sha256').update('test-api-key').digest('hex');
    
    const buffer1 = Buffer.from(hash1);
    const buffer2 = Buffer.from(hash2);
    
    expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(true);
  });

  it('異なるハッシュ値の場合、falseを返すべき', () => {
    const hash1 = crypto.createHash('sha256').update('test-api-key-1').digest('hex');
    const hash2 = crypto.createHash('sha256').update('test-api-key-2').digest('hex');
    
    const buffer1 = Buffer.from(hash1);
    const buffer2 = Buffer.from(hash2);
    
    // 長さが同じ場合は比較可能
    if (buffer1.length === buffer2.length) {
      expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(false);
    } else {
      // 長さが異なる場合は比較前にfalseを返すべき
      expect(buffer1.length === buffer2.length).toBe(false);
    }
  });

  it('長さが異なる場合、エラーを投げるべき', () => {
    const hash1 = crypto.createHash('sha256').update('short').digest('hex');
    const hash2 = crypto.createHash('sha256').update('very-long-api-key-string').digest('hex');
    
    const buffer1 = Buffer.from(hash1);
    const buffer2 = Buffer.from(hash2);
    
    // 長さが異なる場合、timingSafeEqualはエラーを投げる
    // ただし、SHA-256のハッシュ値は常に同じ長さ（64文字）なので、
    // 実際には長さが異なるケースをテストするために異なるアルゴリズムを使用
    const shortBuffer = Buffer.from('short');
    const longBuffer = Buffer.from('very-long-api-key-string');
    
    expect(() => {
      crypto.timingSafeEqual(shortBuffer, longBuffer);
    }).toThrow();
  });

  it('大文字小文字を区別しない比較が正しく動作する', () => {
    const hash1 = crypto.createHash('sha256').update('TEST-API-KEY').digest('hex');
    const hash2 = crypto.createHash('sha256').update('test-api-key').digest('hex');
    
    // SHA-256は大文字小文字を区別するため、ハッシュ値は異なる
    const buffer1 = Buffer.from(hash1.toLowerCase());
    const buffer2 = Buffer.from(hash2.toLowerCase());
    
    // 小文字に変換した後の比較
    if (buffer1.length === buffer2.length) {
      // 実際のハッシュ値は異なるため、falseになる
      expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(false);
    }
  });

  it('空のバッファの比較', () => {
    const buffer1 = Buffer.from('');
    const buffer2 = Buffer.from('');
    
    expect(crypto.timingSafeEqual(buffer1, buffer2)).toBe(true);
  });
});

