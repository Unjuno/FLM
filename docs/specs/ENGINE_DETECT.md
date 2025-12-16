# Engine Detection Specification
> Status: Canonical | Audience: Engine adapter developers | Updated: 2025-02-01

## 1. 検出ステップの標準テンプレート

各エンジンは以下の順序で検出する。

1. **バイナリ/プロセス検出**: 既知パス・環境変数・PATH を探索。必要に応じてポートスキャン。
2. **API Ping**: HTTP エンドポイントにアクセスし、レスポンスとステータスを確認。
3. **Health Check**: レイテンシ測定と期待フィールドの検証。

成功すれば `EngineState` を生成し、失敗時は詳細な `EngineError` を返す。判定結果は以下5種類の `EngineStatus` のいずれかとする。

| Status             | 条件                                                                 |
|--------------------|----------------------------------------------------------------------|
| InstalledOnly      | バイナリ検出済みだが API 応答なし / プロセス停止                     |
| RunningHealthy     | API 応答 200、JSON 形式OK、レイテンシ < `HEALTH_LATENCY_THRESHOLD_MS`（デフォルト 1500ms） |
| RunningDegraded    | 応答はあるがレイテンシ >= `HEALTH_LATENCY_THRESHOLD_MS`、もしくは3回以内に警告レスポンス（429/503） |
| ErrorNetwork       | 連続 `MAX_NETWORK_FAILURES`（デフォルト 3）回のタイムアウト/ネットワーク失敗 |
| ErrorApi           | HTTP 200 だが JSON 解析エラー、必須フィールド欠落などが連続した場合 |

状態遷移は `docs/specs/CORE_API.md` の EngineStatus 遷移規則に従う。

## 2. 各エンジンの検出仕様

| Engine     | Step1 (バイナリ/プロセス)                               | Step2 (API)                                   | 成功判定                                        | 失敗メッセージ例                                 |
|------------|---------------------------------------------------------|------------------------------------------------|-------------------------------------------------|--------------------------------------------------|
| **Ollama** | `ollama` バイナリ探索 (`OLLAMA_HOME`, PATH, 既定パス)   | `GET http://localhost:11434/api/tags`         | 200 + JSON 配列（タグ数>=0）                    | `Ollama がインストールされていないか停止中`       |
| **vLLM**   | ポート (`VLLM_PORT` or 設定) に HTTP サーバが起動済みか | `GET http://{host}:{port}/v1/models`          | 200 + `data` 配列                               | `vLLM API に接続できません`                      |
| **LM Studio** | `LMSTUDIO_API_HOST` / デフォルトポートを確認           | `/v1/models` （LM Studio API）                | 200 + JSON に `models` フィールド               | `LM Studio API に接続できません`                 |
| **llama.cpp** | HTTP サーバモードの場合 `LLAMA_CPP_PORT` を確認       | `/v1/models`（llama.cpp の OpenAI互換拡張）    | 200 + JSON                                      | `llama.cpp HTTP server が起動していません`       |
| **その他（HTTP型）** | 設定されたホスト/ポートへの TCP 接続             | `/v1/models` or `/health`                     | HTTP 200 + JSON                                 | `エンジンAPIに接続できません`                   |

### 2.1 Engine capabilities matrix

| Engine      | chat / stream | embeddings | tools | moderation | **vision** | **audio** | 備考 |
|-------------|---------------|------------|-------|------------|------------|-----------|------|
| Ollama      | ✅ / ✅        | ✅         | ⚠️ (`function_call` 非互換) | ❌         | ✅（Gemma3, LLaVA, Llama3.2 Vision など `images` フィールドを持つモデル） | ✅（Whisper / Gemma3 Audio など API `audio` セクション対応モデル） | `EngineCapabilities::vision_inputs` / `audio_inputs` にファイル上限を格納 |
| vLLM        | ✅ / ✅        | ✅         | ✅     | ❌         | ⛔ モデル依存（OpenAI 互換レスポンスのみ `vision_passthrough=true` で許可） | ⛔ モデル依存（`audio_passthrough=true` 時のみ Binary IF を開く） | vLLM 側で OpenAI 互換形式を返すモデルに限定。未サポート時は `UnsupportedModalities` |
| LM Studio   | ✅ / ✅        | ⛔         | ❌     | ❌         | ✅（Vision モデルのみ。画像は Base64 で `/v1/chat/completions` へ添付） | ❌（2025-11 時点で音声APIなし） | Vision 入力サイズは 4MB まで（LM Studio API 制約）。 |

- `vision` は「画像入力を `ChatRequest.multimodal` 経由で渡せるか」を意味する。画像生成専用エンドポイントは別タスク。
- `audio` は「音声入力（transcriptions）または音声付きレスポンスを `MultimodalAttachment (kind: InputAudio)` で扱えるか」を意味する。
- Capability 値は `EngineRegistry` 経由で CLI/UI に伝搬し、Proxy ルータが `/v1/images/generations` / `/v1/audio/*` を有効化する際の判定に使用する。

- プロセス検出できても API ping が失敗した場合は `EngineStatus::InstalledOnly` or `ErrorNetwork`
- API ping 成功でもレスポンス形式が不正なら `EngineStatus::RunningDegraded` or `ErrorApi`

## 3. 共有ロジック

* 各エンジン検出結果は `EngineRegistry` にキャッシュ (`config.db` の `engines_cache` テーブル)
* キャッシュの TTL は 5 分（300秒、CLI 連続呼び出し時の負荷軽減）
* CLI `flm engines detect` はキャッシュ/リアルタイムを `--fresh` オプションで切替

## 4. 拡張

新エンジンを追加する場合は以下を実施:

1. `flm-engine-<name>` crate を追加
2. `LlmEngine` trait を実装
3. `EngineRegistry` に登録するモジュールを追加
4. `docs/specs/ENGINE_DETECT.md` にステップを追記

---

**関連ドキュメント**:
- `docs/specs/CORE_API.md` - コアAPI仕様（EngineStatus、EngineRegistry）
- `docs/specs/CLI_SPEC.md` - CLI仕様（`flm engines detect`コマンド）
- `docs/planning/PLAN.md` - プロジェクト計画

## Changelog

| バージョン | 日付 | 変更概要 |
|-----------|------|----------|
| `v1.0.0` | 2025-11-20 | 初版公開。Ollama / vLLM / LM Studio / llama.cpp の検出フローを定義。 |