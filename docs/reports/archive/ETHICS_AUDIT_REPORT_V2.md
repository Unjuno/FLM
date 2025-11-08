# FLM 倫理監査レポート（第2版 - 詳細分析）

## 監査日時
2025年1月（再監査）

## 監査概要

本レポートは、FLM（Local LLM API Manager）アプリケーションの倫理的側面に関する第2回目の包括的な監査結果をまとめたものです。前回の監査結果を踏まえ、より詳細なコード分析と実装の深掘りを行いました。

---

## 1. プライバシーとデータ保護（詳細分析）

### 1.1 データ収集の透明性 ✅ 良好（改善点あり）

**評価**: ✅ **良好（改善点あり）**

**確認内容**:
- プライバシーポリシーページが実装されている
- オンボーディング機能が実装されているが、プライバシーポリシーへの明示的な同意がない

**実装状況**:
```228:263:src/components/onboarding/Onboarding.tsx
export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // localStorageからオンボーディング完了フラグを確認
    const onboardingCompleted = localStorage.getItem(
      'flm_onboarding_completed'
    );

    if (!onboardingCompleted) {
      // 初回起動の場合はオンボーディングを表示
      setShowOnboarding(true);
    }
  }, []);
  // ... オンボーディング完了処理
};
```

**問題点**:
1. オンボーディング中にプライバシーポリシーへの明示的な同意を求めていない
2. 初回起動時にプライバシーポリシーへの同意が必須ではない

**推奨事項**:
- 🟡 **中優先度**: 初回起動時にプライバシーポリシーへの同意を明示的に求める
- 🟡 **中優先度**: オンボーディングの最初のステップでプライバシーポリシーへの同意を追加

---

### 1.2 ログ記録とデバッグ情報 ⚠️ 改善の余地あり

**評価**: ⚠️ **改善の余地あり**

**確認内容**:
- 多数の`console.log`、`eprintln!`、`println!`が使用されている
- デバッグモードでのみログを出力する仕組みが一部実装されているが、完全ではない

**実装状況**:
```36:61:src-tauri/src/lib.rs
/// デバッグビルドでのみログを出力するマクロ
#[cfg(debug_assertions)]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        eprintln!("[DEBUG] {}", format!($($arg)*));
    };
}

#[cfg(not(debug_assertions))]
macro_rules! debug_log {
    ($($arg:tt)*) => {};
}

/// 警告ログを出力するマクロ（常に出力）
macro_rules! warn_log {
    ($($arg:tt)*) => {
        eprintln!("[WARN] {}", format!($($arg)*));
    };
}

/// エラーログを出力するマクロ（常に出力）
macro_rules! error_log {
    ($($arg:tt)*) => {
        eprintln!("[ERROR] {}", format!($($arg)*));
    };
}
```

**問題点**:
1. フロントエンド（TypeScript/React）では、デバッグモードの判定が不十分
2. `console.log`が本番環境でも出力される可能性がある
3. ログに機密情報が含まれる可能性（リクエストボディ、エラーメッセージなど）

**実装状況（機密情報のマスキング）**:
```308:360:src/backend/auth/server.ts
  const maskSensitiveData = (obj: any): any => {
    // APIキー、パスワード、トークンなどの機密情報を自動的にマスキング
    const sensitiveFields = [
      'api_key', 'apiKey', 'apikey',
      'password', 'passwd', 'pwd',
      'token', 'access_token', 'refresh_token',
      'secret', 'secret_key', 'private_key',
      'authorization',
    ];
    // 機密情報をマスキング（最初の4文字と最後の4文字を表示、中間は***）
  };
```

**推奨事項**:
- 🟡 **中優先度**: フロントエンドでもデバッグモード判定を実装
- 🟡 **中優先度**: 本番環境では`console.log`を無効化する仕組みを追加
- 🟢 **低優先度**: ログレベル管理システムを導入（DEBUG、INFO、WARN、ERROR）

---

### 1.3 ローカルストレージの使用 ⚠️ 改善の余地あり

**評価**: ⚠️ **改善の余地あり**

**確認内容**:
- `localStorage`がオンボーディング完了フラグの保存に使用されている
- ウェブサイト（`WEB/js/download.js`）でダウンロード追跡に使用されている

**実装状況**:
```228:251:src/components/onboarding/Onboarding.tsx
  const handleOnboardingComplete = () => {
    localStorage.setItem('flm_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('flm_onboarding_completed', 'true');
    setShowOnboarding(false);
  };
```

**問題点**:
1. ローカルストレージの使用について、プライバシーポリシーに明記されていない
2. ダウンロード追跡がユーザーに通知されていない

**推奨事項**:
- 🟡 **中優先度**: プライバシーポリシーにローカルストレージの使用について明記
- 🟡 **中優先度**: ダウンロード追跡をオプトイン方式に変更

---

## 2. 外部サービス連携とデータ送信（詳細分析）

### 2.1 自動アップデート機能 ⚠️ 改善の余地あり

**評価**: ⚠️ **改善の余地あり**

**確認内容**:
- アプリケーション起動時に自動的にアップデートチェックが実行される
- GitHub APIに接続して最新バージョンを確認

**実装状況**:
```33:81:src-tauri/src/commands/updater.rs
#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<UpdateCheckResult, AppError> {
    use tauri_plugin_updater::UpdaterBuilder;
    
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    
    // アップデーターを構築
    let updater = match UpdaterBuilder::new().app_handle(app.clone()).build() {
        Ok(updater) => updater,
        Err(e) => {
            return Err(AppError::ApiError {
                message: format!("アップデーターの初期化に失敗しました: {}", e),
                code: "UPDATER_INIT_ERROR".to_string(),
                source_detail: None,
            });
        }
    };
    
    // アップデートをチェック
    match updater.check().await {
        // ... アップデートチェック処理
    }
}
```

**実装状況（フロントエンド）**:
```141:151:src/hooks/useAppUpdate.ts
  // アプリケーション起動時に自動チェック（オプション）
  useEffect(() => {
    if (options?.autoCheck !== false) {
      // アプリケーション起動後、少し遅延してから自動チェック
      const timer = setTimeout(() => {
        checkUpdate(true); // サイレントモードでチェック
      }, 5000); // 5秒後にチェック

      return () => clearTimeout(timer);
    }
  }, [options?.autoCheck, checkUpdate]);
```

**問題点**:
1. 初回起動時に外部API（GitHub）への接続についてユーザーに通知されていない
2. 自動アップデートチェックがデフォルトで有効（オプトアウト方式）
3. アップデートチェック時に送信される情報が不明確

**推奨事項**:
- 🟡 **中優先度**: 初回起動時に自動アップデートチェックについてユーザーに通知
- 🟡 **中優先度**: 自動アップデートチェックをオプトイン方式に変更（デフォルトはオフ）
- 🟡 **中優先度**: アップデートチェック時に送信される情報をプライバシーポリシーに明記

---

### 2.2 Hugging Face Hub API接続 ⚠️ 改善の余地あり

**評価**: ⚠️ **改善の余地あり**

**確認内容**:
- モデル検索時にHugging Face Hub APIに自動的に接続
- ユーザーが明示的に同意していない場合でも接続される

**実装状況**:
```316:366:src-tauri/src/utils/model_sharing.rs
/// Hugging Face Hubからモデルを検索
async fn search_huggingface_models(
    query: &str,
    tags: Option<&[String]>,
    limit: u32,
) -> Result<Vec<SharedModelInfo>, AppError> {
    // Hugging Face Hub APIを使用して検索
    let search_result = huggingface::search_huggingface_models(query, Some(limit)).await?;
    
    // HuggingFaceModelをSharedModelInfoに変換
    let mut shared_models: Vec<SharedModelInfo> = search_result.models
        .iter()
        .map(|hf_model| {
            // ... モデル情報の変換処理
        })
        .filter_map(|x| x)
        .collect();
    
    Ok(shared_models)
}
```

**問題点**:
1. モデル検索時に外部APIへの接続についてユーザーに通知されていない
2. 検索クエリが外部に送信される（プライバシー懸念の可能性）

**推奨事項**:
- 🟡 **中優先度**: 初回の外部API接続時にユーザーに通知
- 🟡 **中優先度**: オフラインモードを提供（外部API接続なしで動作）
- 🟢 **低優先度**: 検索クエリの匿名化（必要に応じて）

---

## 3. セキュリティと暗号化（詳細分析）

### 3.1 暗号化キーの管理 ✅ 良好

**評価**: ✅ **良好**

**確認内容**:
- OSキーストア（Windows Credential Manager、macOS Keychain、Linux Secret Service）を優先使用
- フォールバックとしてファイルシステムを使用
- ファイルシステムから読み込んだキーをOSキーストアに移行する仕組み

**実装状況**:
```88:157:src-tauri/src/database/encryption.rs
/// 暗号化キーを取得（OSキーストア優先、フォールバックはファイルシステム）
fn get_encryption_key() -> Result<[u8; 32], AppError> {
    // まずOSキーストアから取得を試みる
    if let Ok(Some(key)) = get_key_from_keyring() {
        return Ok(key);
    }
    
    // OSキーストアから取得できない場合は、ファイルシステムから取得
    // ... ファイルシステムからの読み込み処理
    
    // ファイルシステムから読み込んだキーをOSキーストアに移行（次回から使用）
    if save_key_to_keyring(&key).is_ok() {
        // 移行成功したら、ファイルを削除（オプション、セキュリティ向上のため）
        let _ = fs::remove_file(&key_path);
    }
    
    // ... 新しいキーの生成処理
}
```

**推奨事項**:
- ✅ 現在の実装で十分
- OSキーストアの優先使用とフォールバック機能が適切に実装されている

---

### 3.2 エラーハンドリングと情報漏洩 ⚠️ 改善の余地あり

**評価**: ⚠️ **改善の余地あり**

**確認内容**:
- エラーメッセージに技術的詳細が含まれる可能性
- スタックトレースがユーザーに表示される可能性

**実装状況**:
```116:194:src/utils/errorHandler.ts
export function parseError(
  error: unknown,
  category?: ErrorCategory
): ErrorInfo {
  const timestamp = new Date().toISOString();
  let message = t('errors.general.unexpected');
  let technicalDetails: string | undefined;
  let retryable = false;
  let finalCategory = category || ErrorCategory.GENERAL;

  // Errorオブジェクトの場合
  if (error instanceof Error) {
    technicalDetails = error.stack; // スタックトレースを含む
    // ... エラー解析処理
  }
  
  return {
    originalError: error,
    message,
    technicalDetails, // 技術的詳細が含まれる
    suggestion,
    retryable,
    timestamp,
  };
}
```

**問題点**:
1. 技術的詳細（スタックトレース）がユーザーに表示される可能性
2. エラーメッセージに機密情報が含まれる可能性（ファイルパス、環境変数など）

**推奨事項**:
- 🟡 **中優先度**: 本番環境では技術的詳細を非表示にする
- 🟡 **中優先度**: エラーメッセージから機密情報を除去する仕組みを追加
- 🟢 **低優先度**: エラーレポート機能を追加（ユーザーが明示的に送信する場合のみ）

---

## 4. ユーザー同意と透明性（詳細分析）

### 4.1 オンボーディングと同意プロセス ⚠️ 改善の余地あり

**評価**: ⚠️ **改善の余地あり**

**確認内容**:
- オンボーディング機能は実装されている
- プライバシーポリシーへの明示的な同意がない
- 外部API接続についての説明がない

**実装状況**:
```33:92:src/components/onboarding/Onboarding.tsx
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'FLMへようこそ',
    content: '...',
    icon: '👋',
  },
  {
    title: 'APIの作成',
    content: '...',
    icon: '🚀',
  },
  // ... 他のステップ
  // プライバシーポリシーへの同意ステップがない
];
```

**問題点**:
1. オンボーディングにプライバシーポリシーへの同意ステップがない
2. 外部API接続についての説明がない

**推奨事項**:
- 🟡 **中優先度**: オンボーディングにプライバシーポリシーへの同意ステップを追加
- 🟡 **中優先度**: 外部API接続についての説明を追加
- 🟢 **低優先度**: オンボーディングをスキップできるが、プライバシーポリシーへの同意は必須にする

---

### 4.2 設定画面での透明性 ✅ 良好

**評価**: ✅ **良好**

**確認内容**:
- 設定画面で各種設定が明確に表示されている
- プライバシーポリシーへのリンクが提供されている可能性

**推奨事項**:
- ✅ 現在の実装で十分
- 設定画面からプライバシーポリシーへのアクセスが容易であることを確認

---

## 5. データの保持と削除（詳細分析）

### 5.1 ログの保持期間 ✅ 良好

**評価**: ✅ **良好**

**確認内容**:
- ログ保持期間の設定が可能
- デフォルト値が設定されている

**実装状況**:
```390:427:src/pages/Settings.tsx
            {/* ログ保持期間設定 */}
            <section
              className="settings-section"
              aria-labelledby="log-management-heading"
            >
              <h2
                id="log-management-heading"
                className="settings-section-title"
              >
                {t('settings.logManagement.title')}
              </h2>
              <div className="settings-group">
                <label htmlFor="log-retention-days">
                  {t('settings.logManagement.label')}
                  <span className="settings-hint">
                    {t('settings.logManagement.hint')}
                  </span>
                </label>
                <input
                  id="log-retention-days"
                  type="number"
                  min={LOG_RETENTION.MIN_DAYS}
                  max={LOG_RETENTION.MAX_DAYS}
                  value={
                    settings.log_retention_days || LOG_RETENTION.DEFAULT_DAYS
                  }
                  // ... 設定変更処理
                />
              </div>
            </section>
```

**推奨事項**:
- ✅ 現在の実装で十分
- ユーザーがログ保持期間を設定できる点が良好

---

### 5.2 データ削除機能 ✅ 良好

**評価**: ✅ **良好**

**確認内容**:
- アプリケーション内からログを削除できる
- データベースファイルを手動で削除可能

**推奨事項**:
- ✅ 現在の実装で十分

---

## 6. 総合評価と推奨事項（更新版）

### 6.1 総合評価

**評価**: ✅ **良好（改善の余地あり）**

前回の監査と比較して、以下の点が確認されました：

**改善された点**:
- 暗号化キーの管理がOSキーストア優先に改善されている
- 機密情報のマスキング機能が実装されている

**新たに発見された改善点**:
1. ⚠️ **オンボーディングと同意プロセス**: プライバシーポリシーへの明示的な同意がない
2. ⚠️ **自動アップデート**: 外部API接続についてユーザーに通知されていない
3. ⚠️ **ログ記録**: 本番環境でもデバッグ情報が出力される可能性
4. ⚠️ **エラーハンドリング**: 技術的詳細がユーザーに表示される可能性

---

### 6.2 優先度別推奨事項（更新版）

#### 🔴 高優先度（即座に対応推奨）
なし

#### 🟡 中優先度（近い将来に対応推奨）

1. **オンボーディングと同意プロセス**
   - オンボーディングにプライバシーポリシーへの同意ステップを追加
   - 外部API接続についての説明を追加
   - 初回起動時にプライバシーポリシーへの同意を必須にする

2. **自動アップデート機能**
   - 初回起動時に自動アップデートチェックについてユーザーに通知
   - 自動アップデートチェックをオプトイン方式に変更（デフォルトはオフ）
   - アップデートチェック時に送信される情報をプライバシーポリシーに明記

3. **ログ記録とデバッグ情報**
   - フロントエンドでもデバッグモード判定を実装
   - 本番環境では`console.log`を無効化する仕組みを追加
   - ログレベル管理システムを導入

4. **エラーハンドリング**
   - 本番環境では技術的詳細を非表示にする
   - エラーメッセージから機密情報を除去する仕組みを追加

5. **外部API接続の透明性**
   - 初回の外部API接続時にユーザーに通知
   - オフラインモードを提供（外部API接続なしで動作）

6. **ローカルストレージの使用**
   - プライバシーポリシーにローカルストレージの使用について明記
   - ダウンロード追跡をオプトイン方式に変更

#### 🟢 低優先度（将来的な改善として検討）

1. **ログレベル管理**
   - ログレベル管理システムを導入（DEBUG、INFO、WARN、ERROR）

2. **エラーレポート機能**
   - エラーレポート機能を追加（ユーザーが明示的に送信する場合のみ）

3. **検索クエリの匿名化**
   - 検索クエリの匿名化（必要に応じて）

---

## 7. 前回監査からの改善状況

### 7.1 対応済み項目
- ✅ 暗号化キーの管理がOSキーストア優先に改善

### 7.2 未対応項目（継続して推奨）
- ⚠️ プライバシーポリシーの拡充（外部API接続の詳細説明）
- ⚠️ 外部API接続時のユーザー通知
- ⚠️ モデル共有前の明確な同意ダイアログ
- ⚠️ 外部公開時の警告表示

### 7.3 新たに発見された項目
- ⚠️ オンボーディングと同意プロセスの改善
- ⚠️ 自動アップデート機能の透明性向上
- ⚠️ ログ記録とデバッグ情報の管理
- ⚠️ エラーハンドリングの改善

---

## 8. 結論

第2回目の監査により、前回の監査では見落とされていた点や、より詳細な分析が必要な点が明らかになりました。特に、オンボーディングと同意プロセス、自動アップデート機能、ログ記録の管理について改善の余地があることが確認されました。

全体的には、プライバシーとユーザー権利を尊重する設計となっていますが、透明性とユーザー同意のプロセスをさらに強化することで、より高いレベルの倫理的実装を達成できると考えられます。

---

**監査実施者**: AI Assistant  
**監査バージョン**: 2.0  
**最終更新**: 2025年1月

