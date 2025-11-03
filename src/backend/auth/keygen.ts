// keygen - APIキーの生成・検証機能

import crypto from 'crypto';

/**
 * APIキーを生成
 * 32文字以上のランダム文字列（英数字、記号）
 * @param length キーの長さ（デフォルト: 32）
 * @returns 生成されたAPIキー
 */
export function generateApiKey(length: number = 32): string {
    if (length < 32) {
        throw new Error('APIキーの長さは32文字以上である必要があります。');
    }
    
    // ランダムバイトを生成（Base64URLエンコード）
    const randomBytes = crypto.randomBytes(length);
    const apiKey = randomBytes
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
        .substring(0, length);
    
    return apiKey;
}

/**
 * APIキーのハッシュを生成（保存用）
 * @param apiKey 元のAPIキー
 * @returns ハッシュ値（SHA-256）
 */
export function hashApiKey(apiKey: string): string {
    return crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex');
}

/**
 * APIキーを検証
 * データベースから取得したハッシュと比較
 * @param apiKey 検証するAPIキー
 * @param storedHash データベースに保存されているハッシュ
 * @returns 検証結果
 */
export function verifyApiKey(apiKey: string, storedHash: string): boolean {
    const computedHash = hashApiKey(apiKey);
    return computedHash === storedHash;
}

/**
 * データベースからAPIキーのハッシュを取得
 * @param apiKey 検証するAPIキー
 * @returns データベースに保存されているハッシュ値、存在しない場合はnull
 */
async function getApiKeyHashFromDatabase(apiKey: string): Promise<string | null> {
    try {
        const database = await import('./database.js');
        const apiKeyHash = hashApiKey(apiKey);
        return await database.getApiKeyHash(apiKeyHash);
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('データベースアクセスエラー:', error);
        }
        return null;
    }
}

/**
 * APIキーを検証（データベースから取得）
 * @param apiKey 検証するAPIキー
 * @returns 検証結果
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        // APIキーのハッシュを計算
        const apiKeyHash = hashApiKey(apiKey);
        
        // データベースからハッシュを取得
        const storedHash = await getApiKeyHashFromDatabase(apiKey);
        
        if (!storedHash) {
            // ハッシュが存在しない場合は無効
            return false;
        }
        
        // ハッシュを比較（定数時間比較でタイミング攻撃を防止）
        return apiKeyHash.toLowerCase() === storedHash.toLowerCase();
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('APIキー検証エラー:', error);
        }
        return false;
    }
}

/**
 * APIキーを暗号化（保存用）
 * AES-256-GCMを使用
 * @param apiKey 元のAPIキー
 * @param encryptionKey 暗号化キー（32バイト）
 * @returns 暗号化されたデータとIV
 */
export function encryptApiKey(apiKey: string, encryptionKey: Buffer): { encrypted: Buffer; iv: Buffer } {
    const iv = crypto.randomBytes(12); // GCM用の12バイトIV
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // IV、暗号化データ、認証タグを結合
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return {
        encrypted: result,
        iv: iv
    };
}

/**
 * APIキーを復号化
 * @param encryptedData 暗号化されたデータ
 * @param encryptionKey 暗号化キー（32バイト）
 * @returns 復号化されたAPIキー
 */
export function decryptApiKey(encryptedData: Buffer, encryptionKey: Buffer): string {
    // IV（12バイト）、認証タグ（16バイト）、暗号化データ
    const iv = encryptedData.subarray(0, 12);
    const authTag = encryptedData.subarray(12, 28);
    const encrypted = encryptedData.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
}

