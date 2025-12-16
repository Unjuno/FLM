# FLM UI Extensions (Post-Core Roadmap)
> Status: Reference | Audience: Product & UI leads | Updated: 2025-02-01

Phase 1/2 でコア機能と最小UIを完成させた後に追加する機能を整理する。

## 1. モデル詳細設定パネル

### 目的
- エンジンごとに異なるモデルパラメータ（例: context length、GPU優先度、専用オプション）を UI から調整できるようにする。

### 機能案
- `Advanced` セクションで `temperature`, `max_tokens`, `stop`, `top_p`, `repeat_penalty` などを保存・再利用
- エンジン固有設定（例: Ollama の `mixture`、vLLM の `tensor_parallel_size`）を動的フォームで表示
- 設定を `profile` として保存（実装に着手する前に `docs/specs/DB_SCHEMA.md` / `docs/specs/CLI_SPEC.md` に `model_profiles` テーブルと関連コマンドを正式に追記する）

### 実装メモ
- ModelInfo に `default_parameters` を拡張
- `docs/specs/PROXY_SPEC.md` にパラメータマッピング（OpenAI -> Engine）を追加

## 2. API個別プロンプトテンプレート

### 目的
- API（エンドポイント）ごとに異なるシステム/マスタープロンプトを設定・編集できるようにする。

### 機能案
- API一覧に「Prompt Template」列を追加し、各APIごとにテンプレを切り替え/編集
- テンプレ編集UIはシンプルなテキストエリア＋プレビューで即時保存可能（バージョン管理はPhase3以降）
- CLI: `flm api prompts set --api-id ...` といったコマンドで API 単位のテンプレ編集をサポート（導入時は CLI / DB 両方の仕様書を更新する）

### 実装メモ
- `config.db` に `api_prompts` テーブルを追加（`api_id`, `template_text`, `updated_at`）※ 新テーブル追加時は `docs/specs/DB_SCHEMA.md` / マイグレーション手順を先に整備する
- `EngineService::chat` 呼び出し前に API 指定のテンプレを `ChatRequest` に挿入
- UI では APIカードごとに「Prompt」編集ボタンを配置し、モーダルで簡単に編集

## 3. モデル比較 / ヘルス履歴

### 目的
- エンジン状態ログを可視化し、どのモデルが安定しているか比較できるようにする。

### 機能案
- Dashboard にヒストリカルグラフ（latency, error rate）
- モデルごとのサマリ (成功率、平均応答時間)
- `engines_cache` の履歴版を `engine_health_logs` として保存

## 4. 多言語対応 (i18n)

### 目的
- 大衆向け配布を想定し、英語 / 日本語で UI 操作やWizardガイドを共有できるようにする。

### 機能案
- すべての UI 文言を i18n 辞書化（`locales/{lang}.json`）し、Runtime で切り替え可能にする。
- Setup Wizard ・Securityガイドリンク・エラーメッセージを翻訳キーで管理し、テキスト量が多いステップは Markdown 描画を許可。
- OS判定結果に応じて適切な言語の CLI コマンドを提示（例: 日本語UIではコメントも日本語、英語UIでは英語）。**CLIコマンド自体は英語のまま**。
- CLI/Tauri 双方で `preferred_language` 設定を `config.db` に保存し、UI 起動時に適用。

### 実装メモ
- React/Tauri 側は `i18next` + `tauri-plugin-store` の組み合わせを予定。Rust Core には言語依存ロジックを持たせない。
- **CLIは英語のみ**（技術者向けのため、実装の複雑さを避ける）。詳細は `docs/specs/I18N_SPEC.md` を参照。
- 翻訳未定義キーはデフォルト日本語をフォールバックし、それでも見つからない場合は英語、最後にキー名をそのまま表示。Lint タスクでキー漏れを検出するスクリプトを追加。
- `docs/specs/UI_MINIMAL.md` のエラーメッセージ例は日本語/英語両方のキーを先に定義し、翻訳者に共有する。

## 5. UI 自動テスト & シナリオ

- Phase 2 後半で `docs/tests/ui-scenarios.md` を作成し、主要操作の手動テスト手順を定義
- 拡張時には Playwright/Cypress などで e2e に近いテストを追加

## 6. マルチモーダル UI 仕様

### 6.1 Vision タブ

- `Chat` 画面に `Text` / `Vision` / `Audio` のタブを追加。`Vision` を選択すると以下のコンポーネントを表示:
  - 画像アップローダー（ドラッグ&ドロップ + クリップボード貼り付け対応）: 最大 5 枚、PNG/JPEG/WebP、合計 20 MB。プレビューごとに削除ボタンを用意。
  - `detail` 切り替え (`low` / `high`)。LM Studio 向けに 4MB 超過時は即時警告。
  - 送信先モデルフィルタ: `EngineCapabilities.vision_inputs=true` のモデルのみを `Select` に表示。
- 送信時は画像を Base64 にエンコードし、`MultimodalAttachment` JSON を CLI と同じフォーマットで `config.db` の `multimodal_settings` (新設) にキャッシュ。

### 6.2 Audio タブ

- 録音ボタン + ファイル選択を提供。録音は MediaRecorder を使用し、WAV に変換して保存。最大 5 分。録音停止後に波形プレビューと `language` 選択。
- `mode` 切り替え:
  - `Transcription`: `/v1/audio/transcriptions` に直送。
  - `Audio in Chat`: `input_audio` としてチャットメッセージに添付。
- `EngineCapabilities.audio_inputs=true` のモデルのみ選択肢に表示。未対応エンジンを選ぼうとした場合は UI がエラーを表示。

### 6.3 フォーム永続化

- `config.db` の `multimodal_settings` テーブル（新規）に以下を保存: `{ id TEXT PRIMARY KEY DEFAULT 'default', enable_vision BOOLEAN, enable_audio BOOLEAN, max_image_size_mb INTEGER, max_audio_size_mb INTEGER, default_modalities TEXT }`
- UI／CLI は同じ DTO (`MultimodalSettings`) を共有し、`docs/specs/CORE_API.md` で定義する。未設定時は `enable_vision=false`, `enable_audio=false`。
- `model_profiles`, `api_prompts` には `modalities TEXT` 列と `vision_prompt`, `audio_prompt` を追加し、UI フォームから編集できるようにする。

### 6.4 バリデーションとUX

- 画像/音声を添付した状態で Vision/Audio 対応モデルから別のテキスト専用モデルへ切り替えた場合、UI は確認ダイアログを表示して添付を削除する。
- 添付済みファイルは `IndexedDB` にガベージされ、フロントエンド再起動後も `config.db` 側の履歴から再送信はしない（プライバシー対策）。
- `config.db` に保存される設定と UI フォームの値が一致しない場合はバージョン番号を比較し、古いスキーマなら CLI によるマイグレーションを案内。

## 6. 優先順位（例）
1. モデル詳細設定（最も要望が高い想定）
2. マスタープロンプト管理
3. ヘルス履歴可視化
4. その他（Webhook通知、UIテーマなど）

