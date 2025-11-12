// env-validation - 環境変数の型検証
// 環境変数の型と範囲を検証して、不正な値を防ぎます

/**
 * 環境変数の検証結果
 */
interface ValidationResult {
  valid: boolean;
  value: string | number | boolean | null;
  error?: string;
}

/**
 * 文字列型の環境変数を検証
 * @param key 環境変数名
 * @param defaultValue デフォルト値（オプション）
 * @param allowedValues 許可される値のリスト（オプション）
 * @returns 検証結果
 */
export function validateStringEnv(
  key: string,
  defaultValue?: string,
  allowedValues?: string[]
): ValidationResult {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return { valid: true, value: defaultValue };
    }
    return {
      valid: false,
      value: null,
      error: `環境変数 ${key} が設定されていません`,
    };
  }

  if (allowedValues && !allowedValues.includes(value)) {
    return {
      valid: false,
      value: null,
      error: `環境変数 ${key} の値 "${value}" は許可されていません。許可される値: ${allowedValues.join(', ')}`,
    };
  }

  return { valid: true, value };
}

/**
 * 数値型の環境変数を検証
 * @param key 環境変数名
 * @param defaultValue デフォルト値（オプション）
 * @param min 最小値（オプション）
 * @param max 最大値（オプション）
 * @returns 検証結果
 */
export function validateNumberEnv(
  key: string,
  defaultValue?: number,
  min?: number,
  max?: number
): ValidationResult {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return { valid: true, value: defaultValue };
    }
    return {
      valid: false,
      value: null,
      error: `環境変数 ${key} が設定されていません`,
    };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return {
      valid: false,
      value: null,
      error: `環境変数 ${key} の値 "${value}" は数値ではありません`,
    };
  }

  if (min !== undefined && numValue < min) {
    return {
      valid: false,
      value: null,
      error: `環境変数 ${key} の値 ${numValue} は最小値 ${min} より小さいです`,
    };
  }

  if (max !== undefined && numValue > max) {
    return {
      valid: false,
      value: null,
      error: `環境変数 ${key} の値 ${numValue} は最大値 ${max} より大きいです`,
    };
  }

  return { valid: true, value: numValue };
}

/**
 * 真偽値型の環境変数を検証
 * @param key 環境変数名
 * @param defaultValue デフォルト値（オプション）
 * @returns 検証結果
 */
export function validateBooleanEnv(
  key: string,
  defaultValue?: boolean
): ValidationResult {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return { valid: true, value: defaultValue };
    }
    return {
      valid: false,
      value: null,
      error: `環境変数 ${key} が設定されていません`,
    };
  }

  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
    return { valid: true, value: true };
  }
  if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
    return { valid: true, value: false };
  }

  return {
    valid: false,
    value: null,
    error: `環境変数 ${key} の値 "${value}" は真偽値ではありません（true/false, 1/0, yes/no）`,
  };
}

/**
 * 環境変数の検証を実行
 * 検証に失敗した場合はエラーメッセージを出力して終了
 */
export function validateEnvironmentVariables(): void {
  const errors: string[] = [];

  // PORTの検証
  const portResult = validateNumberEnv('PORT', 8080, 1024, 65535);
  if (!portResult.valid && portResult.error) {
    errors.push(portResult.error);
  }

  // NODE_ENVの検証（デフォルトはproduction - セキュリティのため）
  const nodeEnvResult = validateStringEnv('NODE_ENV', 'production', [
    'development',
    'production',
    'test',
  ]);
  if (!nodeEnvResult.valid && nodeEnvResult.error) {
    errors.push(nodeEnvResult.error);
  }

  // RATE_LIMIT_ENABLEDの検証
  const rateLimitEnabledResult = validateBooleanEnv('RATE_LIMIT_ENABLED', true);
  if (!rateLimitEnabledResult.valid && rateLimitEnabledResult.error) {
    errors.push(rateLimitEnabledResult.error);
  }

  // RATE_LIMIT_REQUESTSの検証
  const rateLimitRequestsResult = validateNumberEnv(
    'RATE_LIMIT_REQUESTS',
    100,
    1,
    10000
  );
  if (!rateLimitRequestsResult.valid && rateLimitRequestsResult.error) {
    errors.push(rateLimitRequestsResult.error);
  }

  // RATE_LIMIT_WINDOW_SECONDSの検証
  const rateLimitWindowResult = validateNumberEnv(
    'RATE_LIMIT_WINDOW_SECONDS',
    60,
    1,
    3600
  );
  if (!rateLimitWindowResult.valid && rateLimitWindowResult.error) {
    errors.push(rateLimitWindowResult.error);
  }

  // ENABLE_IP_WHITELISTの検証
  const ipWhitelistEnabledResult = validateBooleanEnv('ENABLE_IP_WHITELIST', false);
  if (!ipWhitelistEnabledResult.valid && ipWhitelistEnabledResult.error) {
    errors.push(ipWhitelistEnabledResult.error);
  }

  // IP_WHITELISTの検証（ENABLE_IP_WHITELISTが有効な場合のみ）
  if (ipWhitelistEnabledResult.valid && ipWhitelistEnabledResult.value === true) {
    const ipWhitelistResult = validateStringEnv('IP_WHITELIST');
    if (!ipWhitelistResult.valid && ipWhitelistResult.error) {
      errors.push(
        `IPホワイトリストが有効ですが、${ipWhitelistResult.error}。IP_WHITELIST環境変数を設定してください。`
      );
    } else if (ipWhitelistResult.valid && ipWhitelistResult.value) {
      // IPアドレスの形式を簡易チェック
      const ipList = (ipWhitelistResult.value as string).split(',');
      const invalidIps = ipList.filter(ip => {
        const trimmed = ip.trim();
        if (!trimmed) return false;
        // CIDR表記またはIPアドレスの形式チェック
        if (trimmed.includes('/')) {
          const [ipPart, prefix] = trimmed.split('/');
          const prefixNum = parseInt(prefix, 10);
          return !isValidIpAddress(ipPart) || isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32;
        }
        return !isValidIpAddress(trimmed);
      });
      if (invalidIps.length > 0) {
        errors.push(
          `IP_WHITELISTに無効なIPアドレスが含まれています: ${invalidIps.join(', ')}`
        );
      }
    }
  }

  // エラーがある場合は出力して終了
  if (errors.length > 0) {
    console.error('環境変数の検証エラー:');
    errors.forEach(error => console.error(`  - ${error}`));
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('開発環境のため、処理を続行します。');
    }
  }
}

/**
 * IPアドレスの形式を簡易チェック
 * @param ip IPアドレス
 * @returns 有効な場合true
 */
function isValidIpAddress(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.length === 4 && parts.every(part => part >= 0 && part <= 255);
  }
  // IPv6の簡易チェック（完全な検証ではない）
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip) || ip === 'localhost' || ip === '::1';
}

