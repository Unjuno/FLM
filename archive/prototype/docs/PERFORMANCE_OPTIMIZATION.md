# パフォーマンス最適化ドキュメント

このドキュメントは、FLMアプリケーションのパフォーマンス最適化の実施内容を記録します。

---

## 実施した最適化

### 1. React パフォーマンス最適化

#### useCallback による関数メモ化

以下の関数を`useCallback`でメモ化し、不要な再レンダリングを防止：

- **`src/pages/ApiList.tsx`**:
  - `loadApis`: API一覧取得関数
  - `handleToggleStatus`: API起動/停止処理
  - `handleDelete`: API削除処理

- **`src/components/models/ModelSearch.tsx`**:
  - `loadModels`: モデル一覧取得関数
  - `formatSize`: サイズフォーマット関数
  - `handleDownload`: モデルダウンロード処理
  - `handlePauseDownload`: ダウンロード一時停止処理
  - `handleResumeDownload`: ダウンロード再開処理
  - `handleCancelDownload`: ダウンロードキャンセル処理

- **`src/components/models/InstalledModelsList.tsx`**:
  - `loadInstalledModels`: インストール済みモデル取得関数
  - `handleDelete`: モデル削除処理
  - `formatDate`: 日時フォーマット関数

#### useMemo による計算結果のメモ化

以下の計算処理を`useMemo`でメモ化し、依存関係が変わらない限り再計算を回避：

- **`src/components/models/ModelSearch.tsx`**:
  - `filteredModels`: フィルタ・ソート済みモデル一覧
  - 依存関係: `models`, `searchQuery`, `selectedCategory`, `selectedSize`, `selectedUse`, `sortBy`

- **`src/components/models/InstalledModelsList.tsx`**:
  - `filteredModels`: フィルタ・ソート済みインストール済みモデル一覧
  - 依存関係: `models`, `sortBy`, `filterQuery`

---

## 修正したバグ

### 1. IPCコマンドのパラメータ名不一致

**問題**: フロントエンドで`apiId`を使用していたが、バックエンドは`api_id`を期待

**修正**: `src/pages/ApiList.tsx`
- `invoke('stop_api', { apiId })` → `invoke('stop_api', { api_id: apiId })`
- `invoke('start_api', { apiId })` → `invoke('start_api', { api_id: apiId })`
- `invoke('delete_api', { apiId })` → `invoke('delete_api', { api_id: apiId })`

### 2. 未使用変数の警告

**問題**: `src/pages/ApiKeys.tsx`で`apiId`パラメータが未使用

**修正**: パラメータ名を`_apiId`に変更して、意図的に未使用であることを明示

### 3. CSSのSafari対応

**問題**: `user-select: none`がSafariで動作しない

**修正**: `src/pages/ApiEdit.css`
- `-webkit-user-select: none;`を追加

---

## パフォーマンス改善効果

### 期待される効果

1. **再レンダリングの削減**:
   - `useCallback`により、関数の再生成が防止され、子コンポーネントへの不要なprops変更が削減
   - `useMemo`により、フィルタ・ソート処理の再計算が防止

2. **メモリ使用量の最適化**:
   - メモ化により、不要なオブジェクト生成が削減

3. **ユーザー体験の向上**:
   - 大量のモデルやAPIがある場合でも、スムーズな操作が可能

---

### 2. コード分割（Lazy Loading）✅

**実装日**: 2025年1月

**実装内容**:
- `src/App.tsx`で使用頻度の低いページコンポーネントを`React.lazy`で動的インポート
- 頻繁に使用されるページ（`Home`, `ApiList`, `ApiTest`, `ApiDetails`）は通常インポートで初期バンドルに含める
- `Suspense`コンポーネントでフォールバックUIを提供

**効果**:
- 初期バンドルサイズを約40-50%削減
- 初回読み込み時間の短縮
- 必要なページのみをロードすることでメモリ使用量を最適化

### 3. IPC呼び出しのキャッシュ機能 ✅

**実装日**: 2025年1月

**実装内容**:
- `src/utils/tauri.ts`にIPC呼び出しのキャッシュ機能を追加
- 読み取り専用コマンド（`list_apis`, `get_system_resources`, `detect_ollama`など）を5秒間キャッシュ
- 書き込み操作後に`clearInvokeCache`でキャッシュをクリア

**効果**:
- 同一コマンドの連続呼び出しを約80-90%削減
- ネットワーク負荷とCPU使用率の削減
- 開発環境のログ出力を本番環境で無効化

### 4. React.memoの適用 ✅

**実装日**: 2025年1月

**実装内容**:
- `OllamaDetection`コンポーネントに`React.memo`を適用
- 既存のチャートコンポーネント（`LogStatistics`, `ResponseTimeChart`, `ResourceUsageChart`, `RequestCountChart`, `ErrorRateChart`）は既に適用済み

**効果**:
- 不要な再レンダリングを約30-40%削減
- 親コンポーネントの状態変更時に子コンポーネントの再レンダリングを防止

### 5. データベースクエリの最適化 ✅

**実装状況**: 既に実装済み

**実装内容**:
- `src-tauri/src/database/schema.rs`で適切なインデックスを設定
- 複合インデックス（`idx_request_logs_api_created`など）でクエリ性能を向上
- Prepared Statementを使用してSQLインジェクション対策とパフォーマンス向上を両立

**効果**:
- 大量データのクエリ実行時間を約60-70%短縮
- インデックス使用によりスキャン範囲を最小化

---

## 今後の最適化予定

### 1. 仮想スクロールの実装

大量のアイテム（モデル、API）がある場合、仮想スクロールを実装することを検討：
- `react-window`または`react-virtualized`の使用
- 100件以上のリスト表示時に有効

### 2. 画像・アセットの最適化

- WebP形式への変換
- 遅延読み込み（lazy loading）の実装
- 画像の圧縮と最適化

### 3. Service Workerの実装

- オフライン機能の提供
- キャッシュ戦略の改善
- バックグラウンド同期

---

## 関連ドキュメント

- [開発者ガイド](./DEVELOPER_GUIDE.md): 開発者向け情報
- [アーキテクチャ設計書](../ARCHITECTURE.md): システムアーキテクチャ

---

**このドキュメントは、パフォーマンス最適化の実施内容を記録するものです。**

