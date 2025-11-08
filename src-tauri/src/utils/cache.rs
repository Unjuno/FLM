// Cache Module
// キャッシュ機能: モデル一覧とAPI設定のメモリキャッシュ

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, SystemTime};

/// キャッシュエントリ
#[derive(Debug, Clone)]
struct CacheEntry<T> {
    data: T,
    timestamp: SystemTime,
    ttl: Duration,
}

impl<T> CacheEntry<T> {
    fn new(data: T, ttl: Duration) -> Self {
        CacheEntry {
            data,
            timestamp: SystemTime::now(),
            ttl,
        }
    }
    
    fn is_expired(&self) -> bool {
        self.timestamp
            .elapsed()
            .map(|elapsed| elapsed > self.ttl)
            .unwrap_or(true)
    }
}

/// モデル一覧キャッシュ
pub struct ModelListCache {
    cache: Arc<RwLock<Option<CacheEntry<Vec<ModelInfo>>>>>,
    default_ttl: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: Option<u64>,
    pub parameters: Option<u64>,
    pub description: Option<String>,
}

impl ModelListCache {
    pub fn new(default_ttl_seconds: u64) -> Self {
        ModelListCache {
            cache: Arc::new(RwLock::new(None)),
            default_ttl: Duration::from_secs(default_ttl_seconds),
        }
    }
    
    /// キャッシュからモデル一覧を取得
    pub async fn get(&self) -> Option<Vec<ModelInfo>> {
        let cache_guard = self.cache.read().await;
        
        if let Some(entry) = cache_guard.as_ref() {
            if !entry.is_expired() {
                return Some(entry.data.clone());
            }
        }
        
        None
    }
    
    /// キャッシュにモデル一覧を保存
    pub async fn set(&self, models: Vec<ModelInfo>) {
        let mut cache_guard = self.cache.write().await;
        *cache_guard = Some(CacheEntry::new(models, self.default_ttl));
    }
    
    /// キャッシュを無効化
    pub async fn invalidate(&self) {
        let mut cache_guard = self.cache.write().await;
        *cache_guard = None;
    }
    
    /// キャッシュが有効かチェック
    pub async fn is_valid(&self) -> bool {
        let cache_guard = self.cache.read().await;
        
        if let Some(entry) = cache_guard.as_ref() {
            !entry.is_expired()
        } else {
            false
        }
    }
}

/// API設定キャッシュ
#[derive(Clone)]
pub struct ApiConfigCache {
    cache: Arc<RwLock<HashMap<String, CacheEntry<ApiConfig>>>>,
    default_ttl: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub id: String,
    pub name: String,
    pub model: String,
    pub port: u16,
    pub enable_auth: bool,
    pub engine_type: String,
    pub engine_config: Option<String>,
}

impl ApiConfigCache {
    pub fn new(default_ttl_seconds: u64) -> Self {
        ApiConfigCache {
            cache: Arc::new(RwLock::new(HashMap::new())),
            default_ttl: Duration::from_secs(default_ttl_seconds),
        }
    }
    
    /// キャッシュからAPI設定を取得
    pub async fn get(&self, api_id: &str) -> Option<ApiConfig> {
        let cache_guard = self.cache.read().await;
        
        if let Some(entry) = cache_guard.get(api_id) {
            if !entry.is_expired() {
                return Some(entry.data.clone());
            }
        }
        
        None
    }
    
    /// キャッシュにAPI設定を保存
    pub async fn set(&self, api_id: String, config: ApiConfig) {
        let mut cache_guard = self.cache.write().await;
        cache_guard.insert(api_id, CacheEntry::new(config, self.default_ttl));
    }
    
    /// キャッシュからAPI設定を削除
    pub async fn invalidate(&self, api_id: &str) {
        let mut cache_guard = self.cache.write().await;
        cache_guard.remove(api_id);
    }
    
    /// すべてのキャッシュをクリア
    pub async fn clear(&self) {
        let mut cache_guard = self.cache.write().await;
        cache_guard.clear();
    }
    
    /// 期限切れのエントリを削除
    pub async fn cleanup_expired(&self) {
        let mut cache_guard = self.cache.write().await;
        cache_guard.retain(|_key, entry| !entry.is_expired());
    }
}

// グローバルキャッシュインスタンス
lazy_static::lazy_static! {
    pub static ref MODEL_LIST_CACHE: ModelListCache = ModelListCache::new(60); // 60秒TTL
    pub static ref API_CONFIG_CACHE: ApiConfigCache = ApiConfigCache::new(300); // 5分TTL
}

/// キャッシュを初期化
pub fn init_caches() {
    // キャッシュはlazy_staticで自動初期化される
}

/// 定期的なキャッシュクリーンアップを開始
pub async fn start_cache_cleanup() -> Result<(), AppError> {
    let cache = API_CONFIG_CACHE.clone();
    
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5分ごと
        
        loop {
            interval.tick().await;
            cache.cleanup_expired().await;
        }
    });
    
    Ok(())
}


