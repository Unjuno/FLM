// model_params - モデルパラメータ検証ユーティリティ

use serde::{Deserialize, Serialize};

/// モデルパラメータの定数定義（フロントエンドのconstants/config.tsと一致）
pub mod constants {
    pub mod model_parameters {
        pub const TEMPERATURE_MIN: f64 = 0.0;
        pub const TEMPERATURE_MAX: f64 = 2.0;
        
        pub const TOP_P_MIN: f64 = 0.0;
        pub const TOP_P_MAX: f64 = 1.0;
        
        pub const TOP_K_MIN: i32 = 1;
        pub const TOP_K_MAX: i32 = 100;
        
        pub const MAX_TOKENS_MIN: i32 = 1;
        
        pub const REPEAT_PENALTY_MIN: f64 = 0.0;
        pub const REPEAT_PENALTY_MAX: f64 = 2.0;
    }
    
    pub mod memory_settings {
        pub const CONTEXT_WINDOW_MIN: i32 = 128;
        pub const CONTEXT_WINDOW_MAX: i32 = 131072;
        
        pub const NUM_GPU_LAYERS_MIN: i32 = 0;
        pub const NUM_GPU_LAYERS_MAX: i32 = 999;
        
        pub const NUM_THREADS_MIN: i32 = 1;
        pub const NUM_THREADS_MAX: i32 = 128;
        
        pub const BATCH_SIZE_MIN: i32 = 1;
        pub const BATCH_SIZE_MAX: i32 = 4096;
    }
    
    pub mod multimodal_settings {
        pub const MAX_IMAGE_SIZE_MIN: i32 = 1;
        pub const MAX_IMAGE_SIZE_MAX: i32 = 100;
        
        pub const MAX_AUDIO_SIZE_MIN: i32 = 1;
        pub const MAX_AUDIO_SIZE_MAX: i32 = 500;
        
        pub const MAX_VIDEO_SIZE_MIN: i32 = 1;
        pub const MAX_VIDEO_SIZE_MAX: i32 = 1000;
    }
}

/// モデルパラメータ（JSONデシリアライズ用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ModelParameters {
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub top_k: Option<i32>,
    pub max_tokens: Option<i32>,
    pub repeat_penalty: Option<f64>,
    pub seed: Option<i64>,
    pub memory: Option<MemorySettings>,
}

/// メモリ設定（JSONデシリアライズ用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MemorySettings {
    pub context_window: Option<i32>,
    pub num_gpu_layers: Option<i32>,
    pub num_threads: Option<i32>,
    pub batch_size: Option<i32>,
    pub use_mmap: Option<bool>,
    pub use_mlock: Option<bool>,
    pub low_mem: Option<bool>,
}

/// マルチモーダル設定（JSONデシリアライズ用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultimodalSettings {
    pub enable_vision: Option<bool>,
    pub enable_audio: Option<bool>,
    pub enable_video: Option<bool>,
    pub max_image_size: Option<i32>,
    pub max_audio_size: Option<i32>,
    pub max_video_size: Option<i32>,
    pub supported_image_formats: Option<Vec<String>>,
    pub supported_audio_formats: Option<Vec<String>>,
    pub supported_video_formats: Option<Vec<String>>,
}

/// エンジン設定（JSONデシリアライズ用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EngineConfig {
    pub model_parameters: Option<ModelParameters>,
    #[serde(rename = "multimodal")]
    pub multimodal: Option<MultimodalSettings>,
}

/// モデルパラメータ検証エラー
#[derive(Debug, Clone)]
pub enum ValidationError {
    TemperatureOutOfRange(f64),
    TopPOutOfRange(f64),
    TopKOutOfRange(i32),
    MaxTokensInvalid(i32),
    RepeatPenaltyOutOfRange(f64),
    ContextWindowOutOfRange(i32),
    NumGpuLayersOutOfRange(i32),
    NumThreadsOutOfRange(i32),
    BatchSizeOutOfRange(i32),
    MaxImageSizeOutOfRange(i32),
    MaxAudioSizeOutOfRange(i32),
    MaxVideoSizeOutOfRange(i32),
    InvalidJson(String),
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::TemperatureOutOfRange(val) => {
                write!(f, "温度(Temperature)の値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::model_parameters::TEMPERATURE_MIN, constants::model_parameters::TEMPERATURE_MAX)
            }
            ValidationError::TopPOutOfRange(val) => {
                write!(f, "Top-pの値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::model_parameters::TOP_P_MIN, constants::model_parameters::TOP_P_MAX)
            }
            ValidationError::TopKOutOfRange(val) => {
                write!(f, "Top-kの値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::model_parameters::TOP_K_MIN, constants::model_parameters::TOP_K_MAX)
            }
            ValidationError::MaxTokensInvalid(val) => {
                write!(f, "最大トークン数(Max Tokens)の値{}は無効です。{}以上の値を指定してください。", 
                    val, constants::model_parameters::MAX_TOKENS_MIN)
            }
            ValidationError::RepeatPenaltyOutOfRange(val) => {
                write!(f, "繰り返しペナルティ(Repeat Penalty)の値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::model_parameters::REPEAT_PENALTY_MIN, constants::model_parameters::REPEAT_PENALTY_MAX)
            }
            ValidationError::ContextWindowOutOfRange(val) => {
                write!(f, "コンテキストウィンドウサイズの値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::memory_settings::CONTEXT_WINDOW_MIN, constants::memory_settings::CONTEXT_WINDOW_MAX)
            }
            ValidationError::NumGpuLayersOutOfRange(val) => {
                write!(f, "GPUレイヤー数の値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::memory_settings::NUM_GPU_LAYERS_MIN, constants::memory_settings::NUM_GPU_LAYERS_MAX)
            }
            ValidationError::NumThreadsOutOfRange(val) => {
                write!(f, "CPUスレッド数の値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::memory_settings::NUM_THREADS_MIN, constants::memory_settings::NUM_THREADS_MAX)
            }
            ValidationError::BatchSizeOutOfRange(val) => {
                write!(f, "バッチサイズの値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::memory_settings::BATCH_SIZE_MIN, constants::memory_settings::BATCH_SIZE_MAX)
            }
            ValidationError::MaxImageSizeOutOfRange(val) => {
                write!(f, "最大画像サイズの値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::multimodal_settings::MAX_IMAGE_SIZE_MIN, constants::multimodal_settings::MAX_IMAGE_SIZE_MAX)
            }
            ValidationError::MaxAudioSizeOutOfRange(val) => {
                write!(f, "最大音声サイズの値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::multimodal_settings::MAX_AUDIO_SIZE_MIN, constants::multimodal_settings::MAX_AUDIO_SIZE_MAX)
            }
            ValidationError::MaxVideoSizeOutOfRange(val) => {
                write!(f, "最大動画サイズの値{}は範囲外です。{}-{}の範囲で指定してください。", 
                    val, constants::multimodal_settings::MAX_VIDEO_SIZE_MIN, constants::multimodal_settings::MAX_VIDEO_SIZE_MAX)
            }
            ValidationError::InvalidJson(msg) => {
                write!(f, "エンジン設定のJSONが無効です: {msg}")
            }
        }
    }
}

/// エンジン設定のJSON文字列を検証
pub fn validate_engine_config(engine_config_json: &str) -> Result<(), ValidationError> {
    // JSONが空の場合は検証スキップ
    if engine_config_json.trim().is_empty() {
        return Ok(());
    }
    
    // JSONをパース
    let config: EngineConfig = serde_json::from_str(engine_config_json)
        .map_err(|e| ValidationError::InvalidJson(e.to_string()))?;
    
    // モデルパラメータの検証
    if let Some(params) = config.model_parameters {
        validate_model_parameters(&params)?;
        
        // メモリ設定の検証
        if let Some(memory) = params.memory {
            validate_memory_settings(&memory)?;
        }
    }
    
    // マルチモーダル設定の検証
    if let Some(multimodal) = config.multimodal {
        validate_multimodal_settings(&multimodal)?;
    }
    
    Ok(())
}

/// モデルパラメータの検証
fn validate_model_parameters(params: &ModelParameters) -> Result<(), ValidationError> {
    use constants::model_parameters::*;
    
    if let Some(temp) = params.temperature {
        if !(TEMPERATURE_MIN..=TEMPERATURE_MAX).contains(&temp) {
            return Err(ValidationError::TemperatureOutOfRange(temp));
        }
    }
    
    if let Some(top_p) = params.top_p {
        if !(TOP_P_MIN..=TOP_P_MAX).contains(&top_p) {
            return Err(ValidationError::TopPOutOfRange(top_p));
        }
    }
    
    if let Some(top_k) = params.top_k {
        if !(TOP_K_MIN..=TOP_K_MAX).contains(&top_k) {
            return Err(ValidationError::TopKOutOfRange(top_k));
        }
    }
    
    if let Some(max_tokens) = params.max_tokens {
        if max_tokens < MAX_TOKENS_MIN {
            return Err(ValidationError::MaxTokensInvalid(max_tokens));
        }
    }
    
    if let Some(repeat_penalty) = params.repeat_penalty {
        if !(REPEAT_PENALTY_MIN..=REPEAT_PENALTY_MAX).contains(&repeat_penalty) {
            return Err(ValidationError::RepeatPenaltyOutOfRange(repeat_penalty));
        }
    }
    
    Ok(())
}

/// メモリ設定の検証
fn validate_memory_settings(memory: &MemorySettings) -> Result<(), ValidationError> {
    use constants::memory_settings::*;
    
    if let Some(context_window) = memory.context_window {
        if !(CONTEXT_WINDOW_MIN..=CONTEXT_WINDOW_MAX).contains(&context_window) {
            return Err(ValidationError::ContextWindowOutOfRange(context_window));
        }
    }
    
    if let Some(num_gpu_layers) = memory.num_gpu_layers {
        if !(NUM_GPU_LAYERS_MIN..=NUM_GPU_LAYERS_MAX).contains(&num_gpu_layers) {
            return Err(ValidationError::NumGpuLayersOutOfRange(num_gpu_layers));
        }
    }
    
    if let Some(num_threads) = memory.num_threads {
        if !(NUM_THREADS_MIN..=NUM_THREADS_MAX).contains(&num_threads) {
            return Err(ValidationError::NumThreadsOutOfRange(num_threads));
        }
    }
    
    if let Some(batch_size) = memory.batch_size {
        if !(BATCH_SIZE_MIN..=BATCH_SIZE_MAX).contains(&batch_size) {
            return Err(ValidationError::BatchSizeOutOfRange(batch_size));
        }
    }
    
    Ok(())
}

/// マルチモーダル設定の検証
fn validate_multimodal_settings(multimodal: &MultimodalSettings) -> Result<(), ValidationError> {
    use constants::multimodal_settings::*;
    
    if let Some(max_image_size) = multimodal.max_image_size {
        if !(MAX_IMAGE_SIZE_MIN..=MAX_IMAGE_SIZE_MAX).contains(&max_image_size) {
            return Err(ValidationError::MaxImageSizeOutOfRange(max_image_size));
        }
    }
    
    if let Some(max_audio_size) = multimodal.max_audio_size {
        if !(MAX_AUDIO_SIZE_MIN..=MAX_AUDIO_SIZE_MAX).contains(&max_audio_size) {
            return Err(ValidationError::MaxAudioSizeOutOfRange(max_audio_size));
        }
    }
    
    if let Some(max_video_size) = multimodal.max_video_size {
        if !(MAX_VIDEO_SIZE_MIN..=MAX_VIDEO_SIZE_MAX).contains(&max_video_size) {
            return Err(ValidationError::MaxVideoSizeOutOfRange(max_video_size));
        }
    }
    
    Ok(())
}
