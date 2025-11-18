# FLM UI Extensions (Post-Core Roadmap)
> Status: Reference | Audience: Product & UI leads | Updated: 2025-11-18

Phase 1/2 でコア機能と最小UIを完成させた後に追加する機能を整理する。

## 1. モデル詳細設定パネル

### 目的
- エンジンごとに異なるモデルパラメータ（例: context length、GPU優先度、専用オプション）を UI から調整できるようにする。

### 機能案
- `Advanced` セクションで `temperature`, `max_tokens`, `stop`, `top_p`, `repeat_penalty` などを保存・再利用
- エンジン固有設定（例: Ollama の `mixture`、vLLM の `tensor_parallel_size`）を動的フォームで表示
- 設定を `profile` として保存 (`config.db` の `model_profiles` テーブルを追加)

### 実装メモ
- ModelInfo に `default_parameters` を拡張
- `docs/PROXY_SPEC.md` にパラメータマッピング（OpenAI -> Engine）を追加

## 2. API個別プロンプトテンプレート

### 目的
- API（エンドポイント）ごとに異なるシステム/マスタープロンプトを設定・編集できるようにする。

### 機能案
- API一覧に「Prompt Template」列を追加し、各APIごとにテンプレを切り替え/編集
- テンプレ編集UIはシンプルなテキストエリア＋プレビューで即時保存可能（バージョン管理はPhase3以降）
- CLI: `flm api prompts set --api-id ...` といったコマンドで API 単位のテンプレ編集をサポート

### 実装メモ
- `config.db` に `api_prompts` テーブルを追加（`api_id`, `template_text`, `updated_at`）
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
- 大衆向け配布を想定し、英語 / 日本語 / 将来追加言語で UI 操作やWizardガイドを共有できるようにする。

### 機能案
- すべての UI 文言を i18n 辞書化（`locales/{lang}.json`）し、Runtime で切り替え可能にする。
- Setup Wizard ・Securityガイドリンク・エラーメッセージを翻訳キーで管理し、テキスト量が多いステップは Markdown 描画を許可。
- OS判定結果に応じて適切な言語の CLI コマンドを提示（例: 日本語UIではコメントも日本語、英語UIでは英語）。
- CLI/Tauri 双方で `preferred_language` 設定を `config.db` に保存し、UI 起動時に適用。

### 実装メモ
- React/Tauri 側は `i18next` + `tauri-plugin-store` の組み合わせを予定。Rust Core には言語依存ロジックを持たせない。
- 翻訳未定義キーはデフォルト英語をフォールバックし、Lint タスクでキー漏れを検出するスクリプトを追加。
- `docs/UI_MINIMAL.md` のエラーメッセージ例は日本語/英語両方のキーを先に定義し、翻訳者に共有する。

## 5. UI 自動テスト & シナリオ

- Phase 2 後半で `docs/tests/ui-scenarios.md` を作成し、主要操作の手動テスト手順を定義
- 拡張時には Playwright/Cypress などで e2e に近いテストを追加

## 6. 優先順位（例）
1. モデル詳細設定（最も要望が高い想定）
2. マスタープロンプト管理
3. ヘルス履歴可視化
4. その他（Webhook通知、UIテーマなど）

