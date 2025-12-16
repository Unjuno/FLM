# 特殊用途エンジン統合ガイド
> Status: Draft | Audience: Engine adapter developers | Updated: 2025-02-01

## 1. 概要

現在のFLM実装では、テキスト生成とマルチモーダル入力（画像理解）はサポートしていますが、**特殊用途エンジン（画像生成、音声認識、音声合成など）は未実装**です。

本ドキュメントでは、以下の特殊用途エンジンをFLMアーキテクチャに統合するための設計と実装手順を説明します：

- **画像生成**: Stable Diffusion型エンジン（AUTOMATIC1111、ComfyUIなど）
- **音声認識**: Whisper型エンジン（Ollama Whisper、Whisper API Serverなど）
- **音声合成**: TTSエンジン（Coqui TTS、ElevenLabs API、OpenAI TTSなど）
- **動画生成**: Stable Video Diffusion、Runway、AnimateDiffなど
- **3D生成**: Shap-E、Point-E、Tripoなど
- **音楽生成**: MusicGen、AudioCraft、RVCなど
- **コード実行**: Jupyter、Code Interpreter、E2Bなど
- **画像編集**: Upscaling、img2img、inpainting、ControlNetなど
- **翻訳専用**: 専用翻訳エンジン（DeepL API、Google Translate APIなど）

## 2. 特殊用途エンジンの種類

### 2.1 画像生成エンジン（Stable Diffusion型）

| エンジン | 特徴 | API形式 | 検出方法 |
|---------|------|---------|---------|
| **AUTOMATIC1111 (Stable Diffusion WebUI)** | 最も人気の高いWebUI、豊富なプラグイン | HTTP API (`/sdapi/v1/txt2img`) | ポート7860のデフォルト、`/sdapi/v1/options`で検出 |
| **ComfyUI** | ノードベースのワークフロー、柔軟なカスタマイズ | HTTP API (`/prompt`) | ポート8188のデフォルト、`/system/status`で検出 |
| **InvokeAI** | CLI/WebUI両対応、プロフェッショナル向け | HTTP API (`/api/v1/invoke`) | ポート9090のデフォルト、`/api/v1/models`で検出 |
| **DiffusionBee** | macOS向け、シンプルなUI | HTTP API (未確認) | ポート8080のデフォルト |
| **Stable Diffusion API Server** | 軽量なAPI専用サーバー | HTTP API (`/v1/generate`) | カスタムポート設定可能 |

### 2.2 音声認識エンジン（Whisper型）

| エンジン | 特徴 | API形式 | 検出方法 |
|---------|------|---------|---------|
| **Ollama Whisper** | Ollama経由でWhisperモデルを実行 | Ollama API (`/api/generate`) | Ollamaエンジン検出時に`whisper:*`モデルを検出 |
| **Whisper API Server** | 専用のWhisper APIサーバー | HTTP API (`/v1/audio/transcriptions`) | カスタムポート設定可能 |
| **Faster Whisper** | 高速化されたWhisper実装 | HTTP API (`/transcribe`) | ポート8000のデフォルト |
| **OpenAI Whisper API** | OpenAIのWhisper API（外部） | HTTP API (`/v1/audio/transcriptions`) | APIキー認証 |

### 2.3 音声合成エンジン（TTS型）

| エンジン | 特徴 | API形式 | 検出方法 |
|---------|------|---------|---------|
| **Coqui TTS** | オープンソースのTTSエンジン | HTTP API (`/api/tts`) | ポート5002のデフォルト |
| **ElevenLabs API** | 高品質なTTS API（外部） | HTTP API (`/v1/text-to-speech`) | APIキー認証 |
| **OpenAI TTS** | OpenAIのTTS API（外部） | HTTP API (`/v1/audio/speech`) | APIキー認証 |
| **Piper TTS** | 軽量なローカルTTS | HTTP API (`/api/tts`) | ポート5000のデフォルト |

### 2.4 その他の特殊用途エンジン

| カテゴリ | エンジン例 | 用途 |
|---------|----------|------|
| **動画生成** | Stable Video Diffusion、Runway、AnimateDiff | テキスト/画像から動画を生成 |
| **3D生成** | Shap-E、Point-E、Tripo | テキストから3Dモデルを生成 |
| **音楽生成** | MusicGen、AudioCraft、RVC | テキストから音楽を生成 |
| **コード実行** | Jupyter、Code Interpreter、E2B | コードを実行して結果を返す |
| **画像編集** | Real-ESRGAN、ESRGAN、Waifu2x | 画像拡大・高解像度化 |
| **翻訳** | DeepL API、Google Translate API | テキスト翻訳 |

### 2.5 推奨実装順序

**Phase 1（最初の実装）**:
1. **Ollama Whisper** - 既存のOllamaエンジンで`whisper:*`モデルを検出・利用
2. **AUTOMATIC1111** - 最も広く使われている画像生成エンジン

**Phase 2（将来の拡張）**:
3. **Coqui TTS** - オープンソースのTTSエンジン
4. **ComfyUI** - より柔軟な画像生成ワークフロー
5. **Faster Whisper** - 高速な音声認識

**Phase 3（更なる拡張）**:
6. **Stable Video Diffusion** - 動画生成
7. **MusicGen** - 音楽生成
8. **Jupyter/Code Interpreter** - コード実行
9. **画像Upscaling** - 画像拡大・高解像度化

## 3. アーキテクチャ設計

### 3.1 `EngineCapabilities`の拡張

現在の`EngineCapabilities`に特殊用途エンジンの能力を追加：

```rust
pub struct EngineCapabilities {
    // ... 既存フィールド ...
    
    // 画像生成
    /// Whether the engine supports image generation (Stable Diffusion type)
    pub image_generation: bool,
    /// Maximum image generation size (width x height, e.g., "1024x1024")
    pub max_image_generation_size: Option<String>,
    /// Supported image generation formats (e.g., ["png", "jpeg", "webp"])
    pub image_generation_formats: Vec<String>,
    
    // 音声認識（既存のaudio_inputsを拡張）
    // audio_inputs: bool は既に存在（Whisper用）
    /// Supported audio transcription formats (e.g., ["wav", "mp3", "flac"])
    pub audio_transcription_formats: Vec<String>,
    /// Maximum audio transcription duration in seconds
    pub max_audio_transcription_duration: Option<u32>,
    
    // 音声合成（既存のaudio_outputsを拡張）
    // audio_outputs: bool は既に存在（TTS用）
    /// Supported TTS voices (e.g., ["alloy", "echo", "fable"])
    pub tts_voices: Vec<String>,
    /// Supported TTS formats (e.g., ["mp3", "opus", "flac", "pcm"])
    pub tts_formats: Vec<String>,
    
    // 動画生成
    /// Whether the engine supports video generation
    pub video_generation: bool,
    /// Maximum video duration in seconds
    pub max_video_duration: Option<u32>,
    /// Supported video formats (e.g., ["mp4", "webm", "gif"])
    pub video_formats: Vec<String>,
    
    // 3D生成
    /// Whether the engine supports 3D model generation
    pub model_3d_generation: bool,
    /// Supported 3D formats (e.g., ["obj", "ply", "glb", "stl"])
    pub model_3d_formats: Vec<String>,
    
    // 音楽生成
    /// Whether the engine supports music generation
    pub music_generation: bool,
    /// Maximum music duration in seconds
    pub max_music_duration: Option<u32>,
    /// Supported music formats (e.g., ["mp3", "wav", "flac"])
    pub music_formats: Vec<String>,
    
    // コード実行
    /// Whether the engine supports code execution
    pub code_execution: bool,
    /// Supported programming languages (e.g., ["python", "javascript", "rust"])
    pub code_execution_languages: Vec<String>,
    
    // 画像編集・拡大
    /// Whether the engine supports image upscaling
    pub image_upscaling: bool,
    /// Maximum upscale factor (e.g., 8 for 8x upscaling)
    pub max_upscale_factor: Option<u32>,
    
    // 翻訳
    /// Whether the engine supports translation
    pub translation: bool,
    /// Supported translation language pairs (e.g., ["en-ja", "ja-en"])
    pub translation_languages: Vec<String>,
}
```

### 3.2 新しいエンジンアダプタの追加

```
crates/
  engines/
    flm-engine-sdwebui/         # AUTOMATIC1111用
    flm-engine-comfyui/         # ComfyUI用（将来）
    flm-engine-fasterwhisper/   # Faster Whisper用（将来）
    flm-engine-coquitts/        # Coqui TTS用（将来）
    flm-engine-stablevideodiffusion/  # 動画生成用（将来）
    flm-engine-musicgen/        # 音楽生成用（将来）
    flm-engine-jupyter/         # コード実行用（将来）
    flm-engine-upscaling/       # 画像拡大用（将来）
    flm-engine-deepl/           # 翻訳用（将来）
```

### 3.3 `LlmEngine` traitの拡張

特殊用途エンジン用のメソッドを追加（オプション）:

```rust
#[async_trait]
pub trait LlmEngine: Send + Sync {
    // ... 既存メソッド ...
    
    /// Generate images from text prompt (optional)
    async fn generate_images(
        &self,
        req: ImageGenerationRequest,
    ) -> Result<ImageGenerationResponse, EngineError>;
    
    /// Transcribe audio to text (optional)
    async fn transcribe_audio(
        &self,
        audio_data: Vec<u8>,
        language: Option<String>,
    ) -> Result<String, EngineError>;
    
    /// Synthesize speech from text (optional)
    async fn synthesize_speech(
        &self,
        text: String,
        voice: Option<String>,
        format: Option<String>,
    ) -> Result<Vec<u8>, EngineError>;
}
```

または、既存の`chat`メソッドを拡張して特殊用途も扱う（推奨）:
- `ChatRequest`に用途別フラグを追加
- `ChatResponse`に生成結果を追加

### 3.4 ドメインモデルの追加

> **注意**: 以下のデータ型（`ImageGenerationRequest`、`AudioTranscriptionRequest`、`TextToSpeechRequest`など）は**将来の拡張として検討されている**ものであり、現時点では`docs/specs/CORE_API.md`には定義されていません。実装時には、`CORE_API.md`に正式な定義を追加する必要があります。

```rust
// crates/core/flm-core/src/domain/image_generation.rs
// 注意: これは将来の拡張として提案されているデータ型です。CORE_API.mdには未定義です。

pub struct ImageGenerationRequest {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: u32,
    pub height: u32,
    pub steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub seed: Option<u64>,
    pub n: Option<u32>, // number of images to generate
}

pub struct ImageGenerationResponse {
    pub images: Vec<GeneratedImage>,
    pub seed: Option<u64>,
    pub metadata: Option<serde_json::Value>,
}

pub struct GeneratedImage {
    pub data: Vec<u8>, // PNG/JPEG bytes
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
}

// crates/core/flm-core/src/domain/audio_transcription.rs

pub struct AudioTranscriptionRequest {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    pub audio_data: Vec<u8>,
    pub language: Option<String>,
    pub prompt: Option<String>, // コンテキスト用プロンプト
}

pub struct AudioTranscriptionResponse {
    pub text: String,
    pub segments: Option<Vec<TranscriptionSegment>>,
    pub language: Option<String>,
}

// crates/core/flm-core/src/domain/tts.rs

pub struct TextToSpeechRequest {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    pub text: String,
    pub voice: Option<String>,
    pub format: Option<String>, // "mp3", "wav", "opus"
    pub speed: Option<f32>,
}

pub struct TextToSpeechResponse {
    pub audio_data: Vec<u8>,
    pub mime_type: String,
    pub duration_ms: Option<u32>,
}
```

## 4. 実装手順

### 4.1 Phase 1: Ollama Whisper統合（音声認識）

Ollamaは既にWhisperモデルをサポートしているため、既存の`flm-engine-ollama`を拡張するだけで対応可能です。

#### ステップ1: モデル検出の拡張

```rust
// crates/engines/flm-engine-ollama/src/lib.rs

impl OllamaEngine {
    async fn list_models(&self) -> Result<Vec<ModelInfo>, EngineError> {
        // ... 既存の実装 ...
        
        // Whisperモデルを検出
        let models = response
            .models
            .into_iter()
            .map(|model| {
                let model_name_lower = model.name.to_lowercase();
                let is_whisper = model_name_lower.contains("whisper");
                
                ModelInfo {
                    engine_id: self.engine_id.clone(),
                    model_id: format!("flm://{}/{}", self.engine_id, model.name),
                    display_name: model.name.clone(),
                    context_length: None,
                    supports_streaming: true,
                    supports_embeddings: false,
                }
            })
            .collect();
        
        Ok(models)
    }
}
```

#### ステップ2: 音声認識メソッドの実装

```rust
// crates/engines/flm-engine-ollama/src/lib.rs

impl OllamaEngine {
    /// Transcribe audio using Whisper model
    async fn transcribe_audio(
        &self,
        audio_data: Vec<u8>,
        model_name: &str,
    ) -> Result<String, EngineError> {
        // 注意: Ollamaの現在のAPIでは音声ファイルの直接アップロードが
        // サポートされていない可能性があるため、実装方法を確認する必要がある
        // 
        // 方法1: Base64エンコードしてプロンプトに含める（非推奨、サイズ制限あり）
        // 方法2: 一時ファイルに保存してOllamaに送信（推奨）
        // 方法3: Ollamaの `/api/audio/transcriptions` エンドポイントを使用（将来）
        
        // 将来的には、Ollamaが `/api/audio/transcriptions` をサポートする可能性がある
        todo!("Implement Ollama Whisper transcription")
    }
}
```

#### ステップ3: Proxyエンドポイントの実装

```rust
// crates/services/flm-proxy/src/controller.rs

async fn handle_audio_transcriptions(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut multipart: axum::extract::Multipart,
) -> axum::response::Response {
    // 1. multipart/form-dataからファイルとモデルを取得
    let mut audio_data: Option<Vec<u8>> = None;
    let mut model: Option<String> = None;
    let mut language: Option<String> = None;
    
    while let Some(field) = multipart.next_field().await.unwrap() {
        match field.name() {
            Some("file") => {
                audio_data = Some(field.bytes().await.unwrap().to_vec());
            }
            Some("model") => {
                model = Some(field.text().await.unwrap());
            }
            Some("language") => {
                language = Some(field.text().await.unwrap());
            }
            _ => {}
        }
    }
    
    let audio_data = audio_data.ok_or_else(|| {
        return (StatusCode::BAD_REQUEST, axum::Json(json!({
            "error": {"message": "Missing audio file", "type": "invalid_request_error"}
        }))).into_response();
    })?;
    
    let model = model.ok_or_else(|| {
        return (StatusCode::BAD_REQUEST, axum::Json(json!({
            "error": {"message": "Missing model", "type": "invalid_request_error"}
        }))).into_response();
    })?;
    
    // 2. モデルIDをパース
    let (engine_id, model_name) = parse_model_id(&model)?;
    
    // 3. エンジンを取得
    let engine = state.engine_repo.get(&engine_id).await?;
    let capabilities = engine.capabilities();
    
    // 4. 音声認識能力をチェック
    if !capabilities.audio_inputs {
        return unsupported_modalities_response("audio_transcription").into_response();
    }
    
    // 5. 音声認識を実行
    // 注意: LlmEngine traitにtranscribe_audioメソッドを追加する必要がある
    // または、専用のAudioEngine traitを作成する
    
    // 6. OpenAI互換形式に変換
    let response = json!({
        "text": transcription_result,
    });
    
    axum::Json(response).into_response()
}
```

### 4.2 Phase 1: AUTOMATIC1111 (Stable Diffusion WebUI) アダプタ

#### ステップ1: エンジンアダプタクレートの作成

```bash
cargo new --lib crates/engines/flm-engine-sdwebui
```

#### ステップ2: `LlmEngine` traitの実装

```rust
// crates/engines/flm-engine-sdwebui/src/lib.rs

pub struct StableDiffusionWebUIEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl LlmEngine for StableDiffusionWebUIEngine {
    fn capabilities(&self) -> EngineCapabilities {
        EngineCapabilities {
            chat: false,
            chat_stream: false,
            embeddings: false,
            moderation: false,
            tools: false,
            reasoning: false,
            vision_inputs: false,
            audio_inputs: false,
            audio_outputs: false,
            image_generation: true,
            max_image_generation_size: Some("2048x2048".to_string()),
            image_generation_formats: vec!["png".to_string(), "jpeg".to_string()],
            max_image_bytes: None,
            max_audio_bytes: None,
            // その他のフィールドはデフォルト値
            ..Default::default()
        }
    }
    
    // ... 他のメソッド実装 ...
}
```

#### ステップ3: 画像生成メソッドの実装

```rust
impl StableDiffusionWebUIEngine {
    async fn generate_images_internal(
        &self,
        req: ImageGenerationRequest,
    ) -> Result<ImageGenerationResponse, EngineError> {
        let url = format!("{}/sdapi/v1/txt2img", self.base_url);
        
        let sd_req = serde_json::json!({
            "prompt": req.prompt,
            "negative_prompt": req.negative_prompt.unwrap_or_default(),
            "width": req.width,
            "height": req.height,
            "steps": req.steps.unwrap_or(20),
            "cfg_scale": req.guidance_scale.unwrap_or(7.0),
            "seed": req.seed.unwrap_or(-1),
            "batch_size": req.n.unwrap_or(1),
        });
        
        let response = self.client
            .post(&url)
            .json(&sd_req)
            .send()
            .await
            .map_err(|e| EngineError::NetworkError {
                reason: format!("Failed to generate images: {e}"),
            })?;
        
        let sd_resp: StableDiffusionResponse = response
            .json()
            .await
            .map_err(|e| EngineError::ApiError {
                reason: format!("Failed to parse response: {e}"),
                status_code: None,
            })?;
        
        // Base64デコードして画像データに変換
        let images = sd_resp.images
            .into_iter()
            .map(|base64_str| {
                let data = general_purpose::STANDARD
                    .decode(&base64_str)
                    .map_err(|e| EngineError::InvalidResponse {
                        reason: format!("Failed to decode image: {e}"),
                    })?;
                Ok(GeneratedImage {
                    data,
                    mime_type: "image/png".to_string(),
                    width: req.width,
                    height: req.height,
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        
        Ok(ImageGenerationResponse {
            images,
            seed: Some(sd_resp.seed),
            metadata: Some(sd_resp.info),
        })
    }
}
```

#### ステップ4: エンジン検出の実装

```rust
impl StableDiffusionWebUIEngine {
    /// Detect if Stable Diffusion WebUI is running
    pub async fn detect(base_url: &str) -> Result<bool, EngineError> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| EngineError::NetworkError {
                reason: format!("Failed to create HTTP client: {e}"),
            })?;
        
        let url = format!("{}/sdapi/v1/options", base_url);
        let response = client.get(&url).send().await;
        
        match response {
            Ok(resp) if resp.status().is_success() => Ok(true),
            _ => Ok(false),
        }
    }
}
```

#### ステップ5: Proxyエンドポイントの実装

`/v1/images/generations`エンドポイントを実装：

```rust
// crates/services/flm-proxy/src/controller.rs

async fn handle_images_generations(
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::Json(req): axum::Json<serde_json::Value>,
) -> axum::response::Response {
    // 1. リクエストをパース
    let model = req["model"].as_str().unwrap_or("");
    let (engine_id, model_name) = parse_model_id(model)?;
    
    // 2. エンジンを取得
    let engine = state.engine_repo.get(&engine_id).await?;
    let capabilities = engine.capabilities();
    
    // 3. 画像生成能力をチェック
    if !capabilities.image_generation {
        return unsupported_modalities_response("image_generation").into_response();
    }
    
    // 4. ImageGenerationRequestに変換
    let gen_req = ImageGenerationRequest {
        engine_id,
        model_id: format!("flm://{}/{}", engine_id, model_name),
        prompt: req["prompt"].as_str().unwrap_or("").to_string(),
        // ... 他のフィールド ...
    };
    
    // 5. 画像生成を実行
    let response = engine.generate_images(gen_req).await?;
    
    // 6. OpenAI互換形式に変換
    let openai_resp = json!({
        "created": chrono::Utc::now().timestamp(),
        "data": response.images.into_iter().map(|img| {
            json!({
                "b64_json": general_purpose::STANDARD.encode(&img.data),
                "revised_prompt": null,
            })
        }).collect::<Vec<_>>(),
    });
    
    axum::Json(openai_resp).into_response()
}
```

## 5. その他の特殊用途エンジンの実装例

### 5.1 音声合成（Coqui TTS）

```rust
// crates/engines/flm-engine-coquitts/src/lib.rs

pub struct CoquiTTSEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl CoquiTTSEngine {
    async fn synthesize_speech(
        &self,
        text: String,
        voice: Option<String>,
        format: Option<String>,
    ) -> Result<Vec<u8>, EngineError> {
        let url = format!("{}/api/tts", self.base_url);
        
        let req = serde_json::json!({
            "text": text,
            "speaker_wav": voice,
            "language": "en",
        });
        
        let response = self.client
            .post(&url)
            .json(&req)
            .send()
            .await?;
        
        let audio_data = response.bytes().await?.to_vec();
        Ok(audio_data)
    }
}
```

### 5.2 動画生成（Stable Video Diffusion）

```rust
// crates/engines/flm-engine-stablevideodiffusion/src/lib.rs

pub struct StableVideoDiffusionEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl StableVideoDiffusionEngine {
    async fn generate_video(
        &self,
        prompt: String,
        init_image: Option<Vec<u8>>,
        duration: Option<u32>,
    ) -> Result<Vec<u8>, EngineError> {
        // Stable Video Diffusion API呼び出し
        // 出力: MP4動画ファイル
        todo!("Implement video generation")
    }
}
```

### 5.3 3D生成（Shap-E）

```rust
// crates/engines/flm-engine-shape/src/lib.rs

pub struct ShapEEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl ShapEEngine {
    async fn generate_3d(
        &self,
        prompt: String,
        format: String, // "obj", "ply", "glb"
    ) -> Result<Vec<u8>, EngineError> {
        // Shap-E API呼び出し
        // 出力: 3Dモデルファイル
        todo!("Implement 3D generation")
    }
}
```

### 5.4 音楽生成（MusicGen）

```rust
// crates/engines/flm-engine-musicgen/src/lib.rs

pub struct MusicGenEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl MusicGenEngine {
    async fn generate_music(
        &self,
        prompt: String,
        duration: u32,
        format: String,
    ) -> Result<Vec<u8>, EngineError> {
        // MusicGen API呼び出し
        // 出力: 音楽ファイル
        todo!("Implement music generation")
    }
}
```

### 5.5 コード実行（Jupyter）

```rust
// crates/engines/flm-engine-jupyter/src/lib.rs

pub struct JupyterEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl JupyterEngine {
    async fn execute_code(
        &self,
        code: String,
        language: String,
    ) -> Result<CodeExecutionResult, EngineError> {
        // Jupyter API呼び出し
        // 出力: 実行結果、エラー、出力など
        todo!("Implement code execution")
    }
}

pub struct CodeExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub output: Option<serde_json::Value>,
    pub execution_time_ms: u64,
}
```

### 5.6 画像拡大（Upscaling）

```rust
// crates/engines/flm-engine-upscaling/src/lib.rs

pub struct UpscalingEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl UpscalingEngine {
    async fn upscale_image(
        &self,
        image_data: Vec<u8>,
        scale_factor: u32,
        model: Option<String>,
    ) -> Result<Vec<u8>, EngineError> {
        // Upscaling API呼び出し
        // 出力: 高解像度画像
        todo!("Implement image upscaling")
    }
}
```

### 5.7 翻訳（DeepL）

```rust
// crates/engines/flm-engine-deepl/src/lib.rs

pub struct DeepLEngine {
    engine_id: EngineId,
    api_key: String,
    client: reqwest::Client,
}

impl DeepLEngine {
    async fn translate(
        &self,
        text: String,
        source_lang: String,
        target_lang: String,
    ) -> Result<String, EngineError> {
        // DeepL API呼び出し
        // 出力: 翻訳されたテキスト
        todo!("Implement translation")
    }
}
```

## 6. 検出仕様の追加

`docs/specs/ENGINE_DETECT.md`に追記：

```markdown
| **Stable Diffusion WebUI** | ポート7860（デフォルト）を確認 | `/sdapi/v1/options` | 200 + JSON | `Stable Diffusion WebUI API に接続できません` |
| **ComfyUI** | ポート8188（デフォルト）を確認 | `/system/status` | 200 + JSON | `ComfyUI API に接続できません` |
| **Ollama Whisper** | Ollamaエンジン検出時に`whisper:*`モデルを検出 | `/api/tags` | 200 + JSON（モデル名に`whisper`を含む） | `Ollama Whisperモデルが見つかりません` |
| **Faster Whisper** | ポート8000（デフォルト）を確認 | `/health` | 200 + JSON | `Faster Whisper API に接続できません` |
| **Coqui TTS** | ポート5002（デフォルト）を確認 | `/api/tts` | 200 | `Coqui TTS API に接続できません` |
| **Stable Video Diffusion** | ポート7860（AUTOMATIC1111拡張）を確認 | `/sdapi/v1/video` | 200 + JSON | `Stable Video Diffusion API に接続できません` |
| **MusicGen** | ポート8000（デフォルト）を確認 | `/api/generate` | 200 | `MusicGen API に接続できません` |
| **Jupyter** | ポート8888（デフォルト）を確認 | `/api/kernels` | 200 + JSON | `Jupyter API に接続できません` |
| **画像Upscaling** | ポート7860（AUTOMATIC1111拡張）を確認 | `/sdapi/v1/extra-single-image` | 200 | `Upscaling API に接続できません` |
| **DeepL API** | APIキー認証 | `/v2/translate` | 200 + JSON | `DeepL API に接続できません` |
```

## 7. テスト戦略

### 7.1 統合テスト

```rust
// crates/engines/flm-engine-sdwebui/tests/integration_test.rs

#[tokio::test]
async fn test_image_generation() {
    let engine = StableDiffusionWebUIEngine::new(
        "sdwebui-default".to_string(),
        "http://localhost:7860".to_string(),
    ).unwrap();
    
    let req = ImageGenerationRequest {
        engine_id: "sdwebui-default".to_string(),
        model_id: "flm://sdwebui-default/model.safetensors".to_string(),
        prompt: "a beautiful landscape".to_string(),
        width: 512,
        height: 512,
        steps: Some(20),
        guidance_scale: Some(7.0),
        seed: None,
        n: Some(1),
    };
    
    let response = engine.generate_images(req).await.unwrap();
    assert_eq!(response.images.len(), 1);
    assert!(!response.images[0].data.is_empty());
}
```

## 8. 参考リンク

### 画像生成
- [AUTOMATIC1111 API Documentation](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API)
- [ComfyUI API Documentation](https://github.com/comfyanonymous/ComfyUI)
- [InvokeAI Documentation](https://invoke-ai.github.io/InvokeAI/)

### 音声認識
- [OpenAI Whisper](https://github.com/openai/whisper)
- [Faster Whisper](https://github.com/guillaumekln/faster-whisper)
- [Ollama Whisper Models](https://ollama.com/library/whisper)

### 音声合成
- [Coqui TTS](https://github.com/coqui-ai/TTS)
- [ElevenLabs API](https://elevenlabs.io/docs/api-reference/text-to-speech)
- [OpenAI TTS API](https://platform.openai.com/docs/guides/text-to-speech)

### 動画生成
- [Stable Video Diffusion](https://github.com/Stability-AI/generative-models)
- [Runway Gen-2](https://runwayml.com/)
- [AnimateDiff](https://github.com/guoyww/AnimateDiff)

### 3D生成
- [Shap-E](https://github.com/openai/shap-e)
- [Point-E](https://github.com/openai/point-e)
- [Tripo](https://www.tripo3d.ai/)

### 音楽生成
- [MusicGen](https://github.com/facebookresearch/audiocraft)
- [AudioCraft](https://github.com/facebookresearch/audiocraft)
- [RVC](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)

### コード実行
- [Jupyter](https://jupyter.org/)
- [E2B Code Interpreter](https://e2b.dev/)
- [Code Interpreter API](https://openai.com/blog/introducing-code-interpreter)

### 画像拡大・Upscaling
- [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
- [ESRGAN](https://github.com/xinntao/ESRGAN)
- [Waifu2x](https://github.com/nagadomi/waifu2x)

### 翻訳
- [DeepL API](https://www.deepl.com/docs-api)
- [Google Translate API](https://cloud.google.com/translate/docs)

## 9. 実装チェックリスト

### 画像生成（Stable Diffusion）
- [ ] `EngineCapabilities`に`image_generation`フィールドを追加
- [ ] `ImageGenerationRequest`/`ImageGenerationResponse`ドメインモデルを追加
- [ ] `flm-engine-sdwebui`クレートを作成
- [ ] `LlmEngine` traitを実装（または拡張）
- [ ] エンジン検出ロジックを実装
- [ ] `/v1/images/generations`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm image generate --prompt "..."`）

### 音声認識（Whisper）
- [ ] OllamaエンジンでWhisperモデル検出を実装
- [ ] `audio_transcription_formats`フィールドを`EngineCapabilities`に追加
- [ ] 音声認識メソッドを`LlmEngine` traitに追加（または専用traitを作成）
- [ ] `/v1/audio/transcriptions`エンドポイントを実装
- [ ] `flm-engine-fasterwhisper`クレートを作成（オプション）
- [ ] CLIコマンドを追加（`flm audio transcribe --file audio.wav`）

### 音声合成（TTS）
- [ ] `tts_voices`と`tts_formats`フィールドを`EngineCapabilities`に追加
- [ ] `flm-engine-coquitts`クレートを作成
- [ ] 音声合成メソッドを`LlmEngine` traitに追加
- [ ] `/v1/audio/speech`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm audio speak --text "Hello" --voice alloy`）

### 動画生成
- [ ] `video_generation`フィールドを`EngineCapabilities`に追加
- [ ] `flm-engine-stablevideodiffusion`クレートを作成
- [ ] `/v1/videos/generations`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm video generate --prompt "..."`）

### 3D生成
- [ ] `model_3d_generation`フィールドを`EngineCapabilities`に追加
- [ ] `flm-engine-shape`クレートを作成
- [ ] `/v1/models/3d/generations`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm 3d generate --prompt "..."`）

### 音楽生成
- [ ] `music_generation`フィールドを`EngineCapabilities`に追加
- [ ] `flm-engine-musicgen`クレートを作成
- [ ] `/v1/audio/music/generations`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm music generate --prompt "..."`）

### コード実行
- [ ] `code_execution`フィールドを`EngineCapabilities`に追加
- [ ] `flm-engine-jupyter`クレートを作成
- [ ] `/v1/code/execute`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm code execute --code "print('hello')"`）

### 画像拡大・Upscaling
- [ ] `image_upscaling`フィールドを`EngineCapabilities`に追加
- [ ] `flm-engine-upscaling`クレートを作成（またはAUTOMATIC1111拡張）
- [ ] `/v1/images/upscale`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm image upscale --file image.png --scale 4x`）

### 翻訳
- [ ] `translation`フィールドを`EngineCapabilities`に追加
- [ ] `flm-engine-deepl`クレートを作成
- [ ] `/v1/translations`エンドポイントを実装
- [ ] CLIコマンドを追加（`flm translate --text "Hello" --from en --to ja`）

### 共通
- [ ] 統合テストを追加
- [ ] `docs/specs/ENGINE_DETECT.md`を更新
- [ ] `docs/specs/PROXY_SPEC.md`を更新
- [ ] ドキュメントを更新

---

**次のステップ**: `docs/status/active/NEXT_STEPS.md`にタスクを登録し、段階的に実装を進めてください。

