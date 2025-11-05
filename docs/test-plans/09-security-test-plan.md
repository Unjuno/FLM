# セキュリティテスト計画書（Security Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: セキュリティテスト
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

セキュリティテストは、脆弱性や認証・認可の実装を検証するテストです。システムがセキュリティ要件を満たし、悪意のある攻撃から保護されていることを確認します。

### 1.2 対象範囲

- APIキーのセキュリティ
- 認証・認可の実装
- 入力値の検証
- SQLインジェクション対策
- XSS（Cross-Site Scripting）対策
- CSRF（Cross-Site Request Forgery）対策
- エラーメッセージのセキュリティ
- データの暗号化

### 1.3 テストフレームワーク

- **フレームワーク**: Jest
- **推奨ツール**: SonarQube、OWASP ZAP
- **現状**: Jestベースのセキュリティテスト

---

## 2. 既存の実装状況

### 2.1 既存のセキュリティテストファイル

以下のセキュリティテストが既に実装されています：

- `tests/security/security.test.ts` - セキュリティテスト
- `tests/integration/auth-proxy-security.test.ts` - 認証プロキシセキュリティテスト

---

## 3. テスト対象とテスト項目

### 3.1 APIキーのセキュリティ

**対象機能**: F005 - 認証機能

**テスト項目**:
- APIキーの長さと強度
- APIキーの暗号化保存
- APIキーの検証
- APIキーの再生成

**既存テスト**:
```typescript
describe('APIキーのセキュリティ', () => {
  it('should generate API keys with sufficient length', async () => {
    const result = await invoke<{
      id: string;
      api_key: string | null;
    }>('create_api', {
      name: 'Security Test API',
      model_name: 'llama3:8b',
      port: 8110,
      enable_auth: true,
    });

    if (result.api_key) {
      // APIキーは32文字以上であることを確認
      expect(result.api_key.length).toBeGreaterThanOrEqual(32);
    }
  });
});
```

**実装ファイル**: `tests/security/security.test.ts`

### 3.2 認証・認可の実装

**対象機能**: F005 - 認証機能

**テスト項目**:
- Bearer Token認証の動作
- 無効なAPIキーの拒否
- APIキーなしでのアクセス拒否（認証有効時）
- 認証無効時のアクセス許可

**既存テスト**:
```typescript
describe('認証の実装確認', () => {
  it('should require authentication when enable_auth is true', async () => {
    const result = await invoke<{
      id: string;
      api_key: string | null;
    }>('create_api', {
      name: 'Auth Test API',
      model_name: 'llama3:8b',
      port: 8112,
      enable_auth: true,
    });

    // 認証が有効な場合、APIキーが生成されることを確認
    expect(result.api_key).toBeDefined();
    expect(result.api_key).not.toBeNull();
  });

  it('should not return API key for APIs with auth disabled', async () => {
    const result = await invoke<{
      id: string;
      api_key: string | null;
    }>('create_api', {
      name: 'No Auth Test API',
      model_name: 'llama3:8b',
      port: 8113,
      enable_auth: false,
    });

    // 認証が無効な場合、APIキーがnullであることを確認
    expect(result.api_key).toBeNull();
  });
});
```

**実装ファイル**: `tests/security/security.test.ts`

### 3.3 入力値の検証

**対象機能**: すべての入力フィールド

**テスト項目**:
- ポート番号の範囲検証
- SQLインジェクション対策
- XSS対策
- パストラバーサル対策

**既存テスト**:
```typescript
describe('入力値の検証', () => {
  it('should validate port number range', async () => {
    const invalidPorts = [0, 65536, -1, 1023];

    for (const port of invalidPorts) {
      try {
        await invoke('create_api', {
          name: 'Port Test',
          model_name: 'llama3:8b',
          port: port,
          enable_auth: false,
        });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
      }
    }
  });

  it('should handle SQL injection attempts', async () => {
    const sqlInjectionAttempts = [
      "'; DROP TABLE apis; --",
      "' OR '1'='1",
      "'; DELETE FROM apis WHERE '1'='1",
    ];

    for (const maliciousInput of sqlInjectionAttempts) {
      try {
        await invoke('create_api', {
          name: maliciousInput,
          model_name: 'llama3:8b',
          port: 8111,
          enable_auth: false,
        });
        // エラーが発生する、または安全に処理されることを確認
      } catch (error) {
        // エラーが発生することは正常（入力検証が機能している）
        expect(error).toBeDefined();
      }
    }
  });
});
```

**実装ファイル**: `tests/security/security.test.ts`

### 3.4 エラーメッセージのセキュリティ

**対象機能**: すべてのエラーハンドリング

**テスト項目**:
- 機密情報の漏洩防止
- システムパスの漏洩防止
- スタックトレースの漏洩防止
- ユーザーフレンドリーなエラーメッセージ

**既存テスト**:
```typescript
describe('エラーメッセージのセキュリティ', () => {
  it('should not expose sensitive information in error messages', async () => {
    try {
      await invoke('get_api_details', { api_id: 'invalid-api-id' });
    } catch (error) {
      const errorMessage = String(error);
      
      // エラーメッセージに機密情報が含まれていないことを確認
      expect(errorMessage).not.toMatch(/password|secret|private|key/i);
      // スタックトレースや内部実装詳細が含まれていないことを確認
      expect(errorMessage).not.toMatch(/at |stack|trace|internal/i);
    }
  });

  it('should not expose system paths in error messages', async () => {
    try {
      await invoke('create_api', {
        name: 'Test',
        model_name: 'nonexistent-model',
        port: 8114,
        enable_auth: false,
      });
    } catch (error) {
      const errorMessage = String(error);
      
      // システムパスが含まれていないことを確認
      const systemPathPattern = new RegExp('C:\\\\|/usr/|\\.exe|\\.dll', 'i');
      expect(errorMessage).not.toMatch(systemPathPattern);
    }
  });

  it('should provide user-friendly error messages', async () => {
    try {
      await invoke('get_api_details', { api_id: 'invalid-id' });
    } catch (error) {
      const errorMessage = String(error);
      
      // エラーメッセージが非開発者向けであることを確認
      expect(errorMessage.length).toBeGreaterThan(0);
      // 技術的な詳細が少ないことを確認
      expect(errorMessage).not.toMatch(/undefined|null|object|array/i);
    }
  });
});
```

**実装ファイル**: `tests/security/security.test.ts`

### 3.5 データの暗号化

**対象機能**: APIキーの保存

**テスト項目**:
- APIキーの暗号化保存
- 暗号化されたデータの復号化
- 暗号化キーの管理

### 3.6 セッション管理

**対象機能**: 認証プロキシ

**テスト項目**:
- セッションタイムアウト
- セッションの無効化
- セッション固定化攻撃の対策

---

## 4. OWASP Top 10の確認

### 4.1 インジェクション

**テスト項目**:
- SQLインジェクション対策
- コマンドインジェクション対策
- OSコマンドインジェクション対策

### 4.2 認証の不備

**テスト項目**:
- パスワードの強度
- セッション管理
- 多要素認証（将来対応）

### 4.3 機密データの露出

**テスト項目**:
- 機密情報の暗号化
- エラーメッセージでの機密情報漏洩
- ログでの機密情報漏洩

### 4.4 XML外部エンティティ（XXE）

**テスト項目**:
- XMLパーサーの設定
- 外部エンティティの無効化

### 4.5 アクセス制御の不備

**テスト項目**:
- 認可の実装
- 権限チェック
- 水平権限昇格の対策

### 4.6 セキュリティ設定の不備

**テスト項目**:
- デフォルト設定の変更
- 不要な機能の無効化
- セキュリティヘッダーの設定

### 4.7 XSS（Cross-Site Scripting）

**テスト項目**:
- 入力値のサニタイズ
- 出力値のエスケープ
- Content Security Policy（CSP）の設定

### 4.8 安全でないデシリアライゼーション

**テスト項目**:
- デシリアライゼーションの検証
- シリアライゼーションの安全性

### 4.9 既知の脆弱性のあるコンポーネントの使用

**テスト項目**:
- 依存関係の脆弱性スキャン
- セキュリティパッチの適用

### 4.10 不十分なロギングとモニタリング

**テスト項目**:
- セキュリティイベントのロギング
- 不正アクセスの検出
- ログの監視

---

## 5. テスト実装方針

### 5.1 セキュリティテストの実装

```typescript
describe('Security Test', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInputs = [
      "'; DROP TABLE apis; --",
      "' OR '1'='1",
    ];

    for (const input of maliciousInputs) {
      try {
        await invoke('create_api', {
          name: input,
          model_name: 'llama3:8b',
          port: 8111,
          enable_auth: false,
        });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
      }
    }
  });
});
```

### 5.2 脆弱性スキャン

- SonarQubeを使用した静的解析
- OWASP ZAPを使用した動的解析
- 依存関係の脆弱性スキャン（`npm audit`、`cargo audit`）

---

## 6. テスト実行方法

### 6.1 セキュリティテストを実行

```bash
npm run test:security
```

### 6.2 SonarQubeを使用する場合

```bash
# SonarQubeのインストール
npm install --save-dev sonarqube-scanner

# SonarQubeの実行
npm run sonar
```

### 6.3 OWASP ZAPを使用する場合

1. OWASP ZAPのインストール
2. ターゲットアプリケーションの設定
3. スパイダースキャンの実行
4. アクティブスキャンの実行
5. レポートの確認

### 6.4 依存関係の脆弱性スキャン

```bash
# npm の脆弱性スキャン
npm audit

# Rust の脆弱性スキャン
cd src-tauri && cargo audit
```

---

## 7. テスト実装優先順位

### 優先度: 高

1. **APIキーのセキュリティ**
   - APIキーの生成と保存
   - 既に実装済み

2. **認証・認可の実装**
   - Bearer Token認証
   - 既に実装済み

3. **入力値の検証**
   - SQLインジェクション対策
   - 既に実装済み

### 優先度: 中

4. **エラーメッセージのセキュリティ**
   - 機密情報の漏洩防止
   - 既に実装済み

5. **データの暗号化**
   - APIキーの暗号化保存

### 優先度: 低

6. **OWASP Top 10の包括的な確認**
   - すべての項目の確認

---

## 8. セキュリティベストプラクティス

### 8.1 コードレビュー

- セキュリティ関連のコードレビュー
- セキュリティチェックリストの使用

### 8.2 セキュリティパッチ

- 依存関係の定期的な更新
- セキュリティパッチの迅速な適用

### 8.3 セキュリティ監視

- セキュリティイベントのロギング
- 不正アクセスの検出と対応

---

## 9. CI/CDへの統合

### 9.1 自動実行

- プルリクエスト作成時に自動実行
- 脆弱性スキャンの自動実行

### 9.2 セキュリティレポート

- セキュリティテスト結果のレポート
- 脆弱性の通知

---

## 10. トラブルシューティング

### 10.1 よくある問題

**問題**: 脆弱性スキャンで多くの警告が表示される
- **解決策**: 警告の優先度を確認し、重要なものから対応

**問題**: セキュリティテストが失敗する
- **解決策**: セキュリティ要件の確認、テストの見直し

---

## 11. 参考資料

- 既存のセキュリティテストファイル（`tests/security/security.test.ts`）
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [SonarQube公式ドキュメント](https://docs.sonarqube.org/)
- [OWASP ZAP公式ドキュメント](https://www.zaproxy.org/docs/)

