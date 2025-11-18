# 実装済みだがテストが不足している機能の一覧

**最終更新**: 2024年
**テスト作成状況**: 大部分のテストを作成済み（約200テスト以上通過）

## ✅ 作成済みテスト一覧

### 高優先度（完了）
- ✅ `tests/unit/errorHandler.test.ts` - 37テスト通過
- ✅ `tests/unit/ApiCreate-auto-start.test.tsx` - 作成済み
- ✅ `tests/unit/ModelSelection-auto-start.test.tsx` - 作成済み

### 中優先度（完了）
- ✅ `tests/unit/ErrorBoundary.test.tsx` - 作成済み
- ✅ `tests/unit/Tooltip.test.tsx` - 26テスト通過
- ✅ `tests/unit/HelpTooltip.test.tsx` - テスト通過
- ✅ `tests/unit/Notification.test.tsx` - 12テスト通過
- ✅ `tests/unit/LanguageSwitcher.test.tsx` - 作成済み
- ✅ `tests/unit/apiCodeGenerator.test.ts` - 21テスト通過
- ✅ `tests/unit/formatters.test.ts` - 66テスト通過
- ✅ `tests/unit/validation.test.ts` - 48テスト通過

### 低優先度（完了）
- ✅ `tests/unit/ErrorMessage-getErrorInfo.test.tsx` - 作成済み
- ✅ `tests/unit/useApiStatus.test.ts` - 作成済み

### ⚠️ 修正が必要なテスト
- ⚠️ `tests/unit/useForm.test.ts` - `import.meta.env.DEV`の問題（Jest設定の調整が必要）
- ⚠️ `tests/unit/modelSelector.test.ts` - `import.meta.env.DEV`の問題（Jest設定の調整が必要）
- ⚠️ `tests/unit/webModelConfig.test.ts` - `import.meta.env.DEV`の問題（Jest設定の調整が必要）

### 📋 未作成のテスト項目

#### 共通UIコンポーネント（✅ 作成済み）
- ✅ `AppLoading.tsx` - アプリケーション起動時の読み込みUI
- ✅ `OllamaDetection.tsx` - Ollama検出中のローディング画面
- ✅ `OllamaDownload.tsx` - Ollamaダウンロード進捗表示UI
- ✅ `SystemCheck.tsx` - システムリソースチェックコンポーネント
- ✅ `KeyboardShortcuts.tsx` - キーボードショートカット一覧コンポーネント
- ✅ `InfoBanner.tsx` - 情報バナーコンポーネント

#### カスタムフック（✅ 作成済み）
- ✅ `useApiConfigValidation.ts` - API設定のバリデーションフック
- ✅ `usePerformanceMetrics.ts` - パフォーマンスメトリクス取得用フック
- ✅ `useResourceUsageMetrics.ts` - CPU/メモリ使用率取得用フック
- ✅ `useKeyboardShortcuts.ts` - キーボードショートカット管理フック

#### ユーティリティ関数（✅ 作成済み）
- ✅ `logger.ts` - 統一ロガーユーティリティ（Loggerクラス、ログレベル、フォーマット）
- ✅ `tauri.ts` - Tauri環境の検出と安全なinvoke関数（isTauriAvailable、safeInvoke、checkTauriEnvironment）

#### ApiCreationTutorialの詳細機能（部分的に不足）
- [ ] ハイライト機能の詳細テスト（要素のハイライト表示、位置計算）

#### API関連コンポーネント（大部分作成済み）
- ✅ `ApiConfigForm.tsx` - API設定フォームコンポーネント（バリデーション、ポート検出、API名自動生成、エンジン検出など）
- ✅ `ApiCreationProgress.tsx` - API作成進捗表示コンポーネント
- ✅ `ApiCreationSuccess.tsx` - API作成成功画面コンポーネント
- [ ] `ApiSettings.tsx` - API設定コンポーネント
- ✅ `LogFilter.tsx` - ログフィルターコンポーネント
- ✅ `LogDetail.tsx` - ログ詳細表示コンポーネント
- ✅ `LogExport.tsx` - ログエクスポートコンポーネント
- ✅ `LogDelete.tsx` - ログ削除コンポーネント
- ✅ `PerformanceSummary.tsx` - パフォーマンスサマリーコンポーネント
- ✅ `ErrorRateChart.tsx` - エラー率チャートコンポーネント
- ✅ `RequestCountChart.tsx` - リクエスト数チャートコンポーネント
- [ ] `ResourceUsageChart.tsx` - リソース使用率チャートコンポーネント
- [ ] `ResponseTimeChart.tsx` - レスポンスタイムチャートコンポーネント
- [ ] `ModelSelect.tsx` - モデル選択コンポーネント（ModelSelectionとは別）
- [ ] `SecuritySettings.tsx` - セキュリティ設定コンポーネント
- [ ] `SettingsExport.tsx` - 設定エクスポートコンポーネント

#### レイアウトコンポーネント（大部分作成済み）
- ✅ `AppLayout.tsx` - アプリケーション全体のレイアウトコンポーネント
- [ ] `EnhancedSidebar.tsx` - 拡張サイドバーコンポーネント
- [ ] `Sidebar.tsx` - サイドバーコンポーネント
- ✅ `Header.tsx` - ヘッダーコンポーネント
- ✅ `Footer.tsx` - フッターコンポーネント

#### モデル関連コンポーネント（部分的に作成済み）
- ✅ `ModelCard.tsx` - モデルカードコンポーネント（ModelDetailModal.test.tsxは存在）
- [ ] `ModelSearch.tsx` - モデル検索コンポーネント
- [ ] `InstalledModelsList.tsx` - インストール済みモデル一覧コンポーネント
- [ ] `ModelDownloadProgress.tsx` - モデルダウンロード進捗コンポーネント
- [ ] `HuggingFaceSearch.tsx` - Hugging Face検索コンポーネント
- [ ] `ModelConverter.tsx` - モデルコンバーターコンポーネント
- [ ] `ModelfileEditor.tsx` - Modelfileエディターコンポーネント
- [ ] `ModelSharing.tsx` - モデル共有コンポーネント

#### オンボーディングコンポーネント（作成済み）
- ✅ `Onboarding.tsx` - オンボーディングコンポーネント（ApiCreationTutorial.test.tsxは存在）

#### ページコンポーネント（未作成・統合テスト推奨）
- [ ] `ApiList.tsx` - API一覧ページ
- [ ] `ApiDetails.tsx` - API詳細ページ
- [ ] `ApiEdit.tsx` - API編集ページ
- [ ] `ApiLogs.tsx` - ログ一覧ページ
- [ ] `ApiTest.tsx` - APIテストページ
- [ ] `PerformanceDashboard.tsx` - パフォーマンスダッシュボードページ
- [ ] `WebServiceSetup.tsx` - Webサービスセットアップページ
- [ ] `ModelManagement.tsx` - モデル管理ページ
- [ ] `Settings.tsx` - 設定ページ
- [ ] その他のページコンポーネント（多数）

#### その他のコンポーネント（未作成）
- [ ] `AlertHistory.tsx` - アラート履歴コンポーネント
- [ ] `AlertThreshold.tsx` - アラート閾値コンポーネント
- [ ] `CloudSyncSettings.tsx` - クラウド同期設定コンポーネント

---


## 1. ModelSelection.tsx のエンジン自動起動機能

### 実装されている機能
- ✅ 複数エンジン対応の自動起動（Ollama、LM Studio、vLLM、llama.cpp）
- ✅ エンジン選択時の自動検出・起動
- ✅ 起動中のUI無効化（連打防止）
- ✅ 起動中のローディング表示とメッセージ
- ✅ 最大3回の自動リトライ（待機時間を段階的に延長）
- ✅ エラー発生時の自動起動（エンジンが起動していない場合）
- ✅ エンジン検出状態の自動更新

### 不足しているテスト項目
- [ ] ModelSelectionコンポーネントのエンジン自動起動ロジック
- [ ] 複数エンジン（Ollama、LM Studio、vLLM、llama.cpp）の自動起動
- [ ] エンジン選択時の自動検出・起動
- [ ] 起動中のUI無効化（連打防止）
- [ ] 起動中のローディング表示とメッセージ
- [ ] 自動リトライ機能（最大3回、段階的待機時間延長）
- [ ] エラー発生時の自動起動
- [ ] エンジン検出状態の更新

---

## 2. ApiCreate.tsx のOllama自動起動機能

### 実装されている機能
- ✅ 画面遷移時の自動検出
- ✅ status変更時の自動起動
- ✅ サイレント失敗（エラーを表示しない）

### 不足しているテスト項目
- [ ] ApiCreateページのOllama自動検出・起動
- [ ] 画面遷移時の自動検出
- [ ] status変更時の自動起動
- [ ] サイレント失敗の動作

---

## 3. Home.tsx のOllama自動起動機能（詳細テスト）

### 実装されている機能
- ✅ アプリ起動時の自動検出・起動
- ✅ status変更時の自動起動
- ✅ サイレント失敗

### 不足しているテスト項目
- [ ] アプリ起動時の自動検出ロジック
- [ ] status変更時の自動起動ロジック
- [ ] サイレント失敗の動作
- [ ] エラーハンドリング

---

## 4. エンジン管理機能（Rust側）

### 実装されている機能
- ✅ `start_engine` コマンド（複数エンジン対応）
- ✅ `detect_engine` コマンド（複数エンジン対応）
- ✅ エンジン起動時の自動リトライ
- ✅ API作成時の自動エンジン起動

### 不足しているテスト項目
- [ ] `start_engine` コマンドのテスト（各エンジンタイプ）
- [ ] `detect_engine` コマンドのテスト（各エンジンタイプ）
- [ ] API作成時の自動エンジン起動ロジック
- [ ] エンジン起動失敗時のエラーハンドリング

---

## 5. エラーハンドリング改善（統合テスト）

### 実装されている機能
- ✅ 自動リトライ機能（retry.ts）
- ✅ エラーメッセージの改善（ErrorMessage.tsx）
- ✅ ヘルプページへの自動遷移

### 不足しているテスト項目
- [ ] エラーハンドリングの統合テスト（実際のエラー発生時の動作）
- [ ] 自動リトライの統合テスト
- [ ] エラーメッセージからヘルプページへの遷移の統合テスト

---

## 6. UI無効化機能（連打防止）

### 実装されている機能
- ✅ エンジン起動中のUI無効化
- ✅ エンジン検出中のUI無効化
- ✅ ローディング表示

### 不足しているテスト項目
- [ ] エンジン起動中のUI無効化の動作確認
- [ ] エンジン検出中のUI無効化の動作確認
- [ ] ローディング表示の動作確認
- [ ] ボタン連打防止の動作確認

---

## 7. errorHandler.ts ユーティリティ関数

### 実装されている機能
- ✅ `parseError` - エラーを解析してErrorInfoに変換
- ✅ `getUserFriendlyMessage` - ユーザーフレンドリーなエラーメッセージ生成
- ✅ `isRetryableError` - リトライ可能なエラーかどうかの判定
- ✅ `getSuggestion` - エラーカテゴリに応じた推奨対処法の取得
- ✅ `logError` - エラーのログ記録
- ✅ `errorToString` - エラーを安全に文字列に変換

### 不足しているテスト項目
- [ ] `parseError` 関数のテスト（各エラーカテゴリ）
- [ ] `getUserFriendlyMessage` 関数のテスト（各エラーカテゴリとメッセージパターン）
- [ ] `isRetryableError` 関数のテスト（リトライ可能/不可能なパターン）
- [ ] `getSuggestion` 関数のテスト（各エラーカテゴリの推奨対処法）
- [ ] `logError` 関数のテスト（ログ記録の動作確認）
- [ ] `errorToString` 関数のテスト（各種エラー形式の変換）

---

## 8. 共通UIコンポーネント

### 実装されている機能
- ✅ ErrorBoundary - エラーバウンダリーコンポーネント
- ✅ HelpTooltip - ヘルプツールチップコンポーネント
- ✅ Tooltip - ツールチップコンポーネント
- ✅ Notification - 通知コンポーネント
- ✅ LanguageSwitcher - 言語切り替えコンポーネント
- ✅ KeyboardShortcuts - キーボードショートカットコンポーネント
- ✅ OllamaDetection - Ollama検出コンポーネント
- ✅ OllamaDownload - Ollamaダウンロードコンポーネント
- ✅ SystemCheck - システムチェックコンポーネント

### 不足しているテスト項目
- [ ] ErrorBoundaryコンポーネントのテスト
- [ ] HelpTooltipコンポーネントのテスト
- [ ] Tooltipコンポーネントのテスト
- [ ] Notificationコンポーネントのテスト
- [ ] LanguageSwitcherコンポーネントのテスト
- [ ] KeyboardShortcutsコンポーネントのテスト
- [ ] OllamaDetectionコンポーネントのテスト
- [ ] OllamaDownloadコンポーネントのテスト
- [ ] SystemCheckコンポーネントのテスト

---

## 9. ユーティリティ関数

### 実装されている機能
- ✅ apiCodeGenerator.ts - APIコード生成ユーティリティ
- ✅ formatters.ts - フォーマッターユーティリティ
- ✅ modelSelector.ts - モデル選択ユーティリティ
- ✅ validation.ts - バリデーションユーティリティ
- ✅ webModelConfig.ts - Webモデル設定ユーティリティ

### 不足しているテスト項目
- [ ] apiCodeGenerator.ts のテスト（各言語のコード生成）
- [ ] formatters.ts のテスト（各種フォーマット関数）
- [ ] modelSelector.ts のテスト（モデル選択ロジック）
- [ ] validation.ts のテスト（各種バリデーション関数）
- [ ] webModelConfig.ts のテスト（設定処理）

---

## 10. カスタムフック

### 実装されている機能
- ✅ useApiConfigValidation - API設定バリデーションフック
- ✅ useForm - フォーム管理フック
- ✅ usePerformanceMetrics - パフォーマンスメトリクスフック
- ✅ useResourceUsageMetrics - リソース使用量メトリクスフック
- ✅ useApiStatus - APIステータス管理フック

### 不足しているテスト項目
- [ ] useApiConfigValidationフックのテスト
- [ ] useFormフックのテスト
- [ ] usePerformanceMetricsフックのテスト
- [ ] useResourceUsageMetricsフックのテスト
- [ ] useApiStatusフックのテスト

---

## 11. ApiCreationTutorial の詳細機能

### 実装されている機能
- ✅ ハイライト機能（要素のハイライト表示）
- ✅ ステップナビゲーション
- ✅ プログレス追跡
- ✅ アクション実行（ナビゲーション）

### 不足しているテスト項目
- [ ] ハイライト機能のテスト（要素のハイライト表示）
- [ ] アクション実行のテスト（ナビゲーションアクション）
- [ ] プログレス追跡の詳細テスト

---

## 12. ErrorMessage の getErrorInfo 関数

### 実装されている機能
- ✅ エラータイプに応じたアイコン・タイトル・デフォルト提案の取得

### 不足しているテスト項目
- [ ] `getErrorInfo` 関数のテスト（各エラータイプの情報取得）
- [ ] デフォルト提案メッセージのテスト

---

## 優先度の高いテスト項目

### 高優先度（主要機能でテストが完全に不足）
1. **ModelSelection.tsx のエンジン自動起動機能** - 主要機能でテストが完全に不足
2. **ApiCreate.tsx のOllama自動起動機能** - 主要機能でテストが完全に不足
3. **errorHandler.ts ユーティリティ関数** - エラーハンドリングの核心機能でテストが完全に不足

### 中優先度
4. **Home.tsx の自動起動ロジックの詳細テスト** - 基本的なテストはあるが詳細テストが不足
5. **エンジン管理機能（Rust側）** - バックエンドの重要な機能
6. **共通UIコンポーネント** - ErrorBoundary, Tooltip, Notification など重要なコンポーネント
7. **ユーティリティ関数** - apiCodeGenerator, formatters, validation など

### 低優先度
8. **エラーハンドリング改善の統合テスト** - ユニットテストはあるが統合テストが不足
9. **UI無効化機能** - UIの動作確認テスト
10. **カスタムフック** - 各種フックのテスト
11. **ApiCreationTutorial の詳細機能** - ハイライト機能など

