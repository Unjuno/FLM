# マルチモーダル拡張メモ
_Last updated: 2025-11-26_

このメモは「現状はテキストLLMのみを運用しつつ、将来的に画像 / 音声 / 数値などの特殊用途を安全に追加したい」という要望に対して、既存アーキテクチャがどのように拡張性を確保しているか、また実際に拡張する際の手順・注意点をまとめたものです。

---

## 1. アーキテクチャ上の担保

| 項目 | 内容 | 参考ドキュメント |
| --- | --- | --- |
| Rustワークスペースの分離 | `flm-core` がドメインロジック、`flm-engine-*` が各エンジンアダプタ、`flm-cli` / `flm-proxy` がアプリ層という三層構造。新しいモーダルは専用エンジンクレートを追加し、Trait経由で注入できる。 | `docs/specs/CORE_API.md` |
| Engine adapter追加手順 | `flm-engine-<name>` を追加 → `LlmEngine` を実装 → `EngineRegistry` に登録 → `ENGINE_DETECT.md` に検出手順を追記、という標準フローを定義済み。 | `docs/specs/ENGINE_DETECT.md` |
| Proxyの動的エンドポイント | OpenAI互換ルーティングを採用し、`EngineCapabilities` を見て `/v1/audio/*` 等の将来APIを動的に公開する設計。テキストのみの状態でも無効化されたまま維持できる。 | `docs/specs/PROXY_SPEC.md` |
| UI/設定スキーマ | 旧UI由来の `ModelCapabilities` / `MultimodalSettings`（例: `vision` / `audio` / `video` フラグ、最大ファイルサイズ、対応フォーマット）を先行定義済み。Rust版UI/APIでも同スキーマを流用予定。 | `archive/prototype/src/types/api.ts` |

---

## 2. 追加モーダルを有効化する際のChecklist

1. **対応エンジンの選定**
   - 画像生成なら `flm-engine-sdxl` のような専用crateを追加し、対象エンジンのHTTP APIを `LlmEngine` traitでラップする。
   - 既存のOllama/vLLMが該当モーダルを提供する場合でも、`EngineCapabilities` に `vision/audio/...` を設定し、Proxyへ伝播させる。

2. **モデルメタデータの登録**
   - `web-models-config` や `model_catalog_data.rs` にカテゴリ（`vision`, `image-generation`, `audio`, `multimodal` 等）とタグを追記。
   - 既存の検索/UIはカテゴリとタグでフィルタできるため、テキストモデルを崩さずに新モーダルを表示切替可能。

3. **Proxy/CLIへのルーティング追加**
   - OpenAI互換エンドポイントを踏襲しつつ、新規モーダルの `/v1/images/generations`, `/v1/audio/speech`, `/v1/responses` などをAxumルータに追加。
   - ルータでは `EngineCapabilities` を参照し、未対応なエンジン・モーダルでは 404/422 を返す。

4. **設定UIとCLIスイッチ**
   - `MultimodalSettings` の `enableVision`/`enableAudio`/`enableVideo` をONにするUIを提供（旧プロトタイプには `ApiConfigMultimodalSettings.tsx` が参考実装として存在）。
   - ファイルサイズや対応フォーマットはデフォルト値を設け、未入力でも安全に振る舞うようにする。

5. **テストと監査**
   - `tests/api/*` にモーダル別スモークテストを追加（旧プロトタイプの `image-generation-api.test.ts`, `audio-generation-api.test.ts` が雛形）。
   - `reports/` 以下に結果を残し、既存テキスト動作との回帰を常に確認。

---

## 2.5 実装計画（現行エンジンのマルチモーダル活用）

現時点のOllama / vLLM / LM Studio / llama.cpp のうち、ビルド済みモデルでマルチモーダル入出力を提供できるものを対象に、以下の段階で拡張する。

1. **仕様の更新**
   - `docs/specs/ENGINE_DETECT.md`, `docs/specs/PROXY_SPEC.md`, `docs/specs/CLI_SPEC.md`, `docs/specs/UI_EXTENSIONS.md` に対象モーダルと入出力形式、制約（例: 画像→テキストのみ、最大ファイルサイズ）を明記。
   - `docs/status/active/NEXT_STEPS.md` にタスクを登録し、`TASK.md`/`DONE.md` ワークフローで進行を管理。

2. **エンジンアダプタの拡張**
   - `flm-engine-*` 各crateで `EngineCapabilities` を更新し、ビルド済みマルチモーダル機能（例: Vision入力、Audio出力）を trait 実装として公開。
   - 画像/音声前処理、レスポンス正規化をアダプタ内部に閉じ込め、`flm-core` には抽象化された `EngineService` APIだけを露出させる。

3. **Core / Proxy の更新**
   - `EngineService` を拡張し、モーダル情報を `flm-proxy` へ伝搬。Axumルータで `/v1/images/generations`, `/v1/audio/speech`, `/v1/responses` などOpenAI互換エンドポイントを能力フラグに応じて有効化。
   - 後方互換のため、既存テキストフローはデフォルト設定のまま維持し、サポートされないモーダルは 404/422 を返す。

4. **CLI / UI の対応**
   - `flm-cli` にファイル入力フラグ（例: `--image path/to.png`, `--audio path/to.wav`）や `--modalities vision,audio` オプションを追加。
   - Rust版UIでアップロードフィールド・モーダル別設定フォームを再現し、CLIと同じ `config.db` を参照。

5. **Config / プロファイル管理**
   - `config.db` スキーマと `model_profiles` にモーダル別パラメータ（入力形式、最大トークン/画像サイズ、サンプリング設定）を追加し、CLI/UIから読めるようにする。
   - APIプロンプトテンプレートにもモーダル別 placeholder（例: `{{image_bytes}}`）を許可。

6. **テスト / CI 拡充**
   - `scripts/ci-*.sh` にマルチモーダルスモークを組み込み、実画像/音声ファイルを用いた最小ケースを追加。
   - `docs/guides/TEST_STRATEGY.md` と `reports/` に結果を記録し、テキストモードとの回帰結果もセットで確認。

7. **ドキュメントとリリースノート**
   - `README.md`、`docs/guides/ENGINE_CACHE_FAQ.md` などユーザー向け資料にマルチモーダル手順・制限事項を追記。
   - リリース時は `docs/changelog/CHANGELOG.md` を更新し、サポートされたモーダルと対象エンジンを明示。

---

## 3. 運用上の推奨事項

- **今はテキストのみでも `EngineCapabilities` と `multimodal` スキーマを空で維持**  
  → 後から値を埋めるだけで済み、テーブルマイグレーションやAPI互換性の問題を避けられる。

- **エンドポイントをハードコードしない**  
  → OpenAI互換の基本パス（`/v1/<api>`）に寄せ、モーダル特有のエンドポイントを増やすときはルータ設定のみに変更を閉じ込める。

- **カテゴリ/タグ駆動のUI**  
  → モデル検索・API作成UIはカテゴリ別表示を維持し、将来的な `image-generation` や `audio` カテゴリを簡単に追加できる構造にしておく。

- **ドキュメント更新のルール化**  
  → 新モーダルを追加したら本メモ・`ENGINE_DETECT.md`・`PROXY_SPEC.md`・`UI_EXTENSIONS.md` など該当ドキュメントに必ず追記する。

---

## 4. 今後のToDo候補

- [ ] `flm-core` に `EngineCapabilities` のモーダル別フィールド（例: `image_generation`, `audio_generation`）を追加し、Proxy/CLIに伝搬させる。
- [ ] Axumルータへ画像/音声エンドポイントのドラフト実装を追加し、Feature flagで無効化したまま先行レビューできるようにする。
- [ ] Rust版UIで `MultimodalSettings` フォームを再実装し、テキスト用APIでもプレースホルダーを保持。
- [ ] 追加エンジン向けのCIテストテンプレートを `scripts/ci-*.sh` に整備（画像生成負荷・音声latency測定など）。

---

今後モーダルを足す際は、本メモを起点に関連ドキュメントへリンクしながら更新してください。必要に応じてIssue/PRテンプレートに「モーダル拡張チェックリスト」を組み込むと抜け漏れ防止になります。

