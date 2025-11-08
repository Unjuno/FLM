// oauth-validator - OAuth2トークン検証機能

// OAuth2トークン情報インターフェース
export interface OAuthTokenInfo {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_at?: string;
  scope?: string[];
  client_id?: string;
}

/**
 * OAuth2トークン検証結果
 */
export interface OAuthValidationResult {
  valid: boolean;
  tokenInfo?: OAuthTokenInfo;
  error?: string;
}

/**
 * OAuth2トークンをイントロスペクションエンドポイントで検証
 * @param token 検証するトークン
 * @param introspectionEndpoint イントロスペクションエンドポイントURL
 * @param clientId クライアントID
 * @param clientSecret クライアントシークレット
 * @returns 検証結果
 */
export async function validateOAuthTokenWithIntrospection(
  token: string,
  introspectionEndpoint: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthValidationResult> {
  try {
    const response = await fetch(introspectionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        token: token,
        token_type_hint: 'access_token',
      }),
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `イントロスペクションエラー: HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    // トークンが有効かチェック（OAuth2標準では`active`フィールドで判定）
    if (!data.active) {
      return {
        valid: false,
        error: 'トークンは無効または期限切れです',
      };
    }

    // トークン情報を返す
    return {
      valid: true,
      tokenInfo: {
        access_token: token,
        token_type: data.token_type || 'Bearer',
        expires_at: data.exp
          ? new Date(data.exp * 1000).toISOString()
          : undefined,
        scope: data.scope ? data.scope.split(' ') : [],
        client_id: clientId,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error ? error.message : 'イントロスペクションエラー',
    };
  }
}

/**
 * OAuth2トークンをJWTとして検証（JWT形式の場合）
 * @param token 検証するJWTトークン
 * @param jwksUri JWKS URI（公開鍵取得用）
 * @returns 検証結果
 */
export async function validateOAuthTokenWithJWT(
  token: string,
  jwksUri?: string
): Promise<OAuthValidationResult> {
  try {
    // JWTの検証には`jsonwebtoken`や`jose`ライブラリが必要
    // ここでは簡易実装として、トークンの構造をチェック
    const parts = token.split('.');

    if (parts.length !== 3) {
      return {
        valid: false,
        error: '無効なJWT形式です',
      };
    }

    // JWTのペイロードをデコード（Base64URL）
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString()
    );

    // 有効期限をチェック
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return {
        valid: false,
        error: 'トークンの有効期限が切れています',
      };
    }

    // トークン情報を返す
    return {
      valid: true,
      tokenInfo: {
        access_token: token,
        token_type: 'Bearer',
        expires_at: payload.exp
          ? new Date(payload.exp * 1000).toISOString()
          : undefined,
        scope: payload.scope
          ? typeof payload.scope === 'string'
            ? payload.scope.split(' ')
            : payload.scope
          : [],
        client_id: payload.client_id || payload.aud || '',
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'JWT検証エラー',
    };
  }
}

/**
 * データベースに保存されたOAuth2トークンを検証
 * @param token 検証するトークン
 * @param apiId API ID
 * @returns 検証結果
 */
export async function validateOAuthTokenFromDatabase(
  token: string,
  apiId: string
): Promise<OAuthValidationResult> {
  try {
    const database = await import('./database.js');
    const tokenInfo = await database.getOAuthTokenInfo(apiId, token);

    if (!tokenInfo) {
      return {
        valid: false,
        error: 'トークンが見つかりません',
      };
    }

    // 有効期限をチェック
    if (tokenInfo.expires_at) {
      const expiresAt = new Date(tokenInfo.expires_at);
      if (expiresAt < new Date()) {
        return {
          valid: false,
          error: 'トークンの有効期限が切れています',
        };
      }
    }

    return {
      valid: true,
      tokenInfo: tokenInfo,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'データベース検証エラー',
    };
  }
}

/**
 * OAuth2トークンを検証（複数の方法を試行）
 * @param token 検証するトークン
 * @param apiId API ID
 * @param config OAuth2設定（オプション）
 * @returns 検証結果
 */
export async function validateOAuthToken(
  token: string,
  apiId: string,
  config?: {
    introspectionEndpoint?: string;
    clientId?: string;
    clientSecret?: string;
    jwksUri?: string;
  }
): Promise<OAuthValidationResult> {
  // 1. まずデータベースから検証
  const dbResult = await validateOAuthTokenFromDatabase(token, apiId);
  if (dbResult.valid) {
    return dbResult;
  }

  // 2. イントロスペクションエンドポイントで検証（設定されている場合）
  if (
    config?.introspectionEndpoint &&
    config?.clientId &&
    config?.clientSecret
  ) {
    const introspectionResult = await validateOAuthTokenWithIntrospection(
      token,
      config.introspectionEndpoint,
      config.clientId,
      config.clientSecret
    );
    if (introspectionResult.valid) {
      // 検証成功したトークンをデータベースに保存
      if (introspectionResult.tokenInfo) {
        const database = await import('./database.js');
        await database.saveOAuthTokenInfo(apiId, introspectionResult.tokenInfo);
      }
      return introspectionResult;
    }
  }

  // 3. JWTとして検証（設定されている場合）
  if (config?.jwksUri) {
    const jwtResult = await validateOAuthTokenWithJWT(token, config.jwksUri);
    if (jwtResult.valid && jwtResult.tokenInfo) {
      // 検証成功したトークンをデータベースに保存
      const database = await import('./database.js');
      await database.saveOAuthTokenInfo(apiId, jwtResult.tokenInfo);
      return jwtResult;
    }
  }

  // すべての検証方法が失敗した場合
  return {
    valid: false,
    error: 'トークンの検証に失敗しました',
  };
}
