// Database Repository Module
// データアクセス層（Repository パターン）

use crate::database::encryption::{decrypt_oauth_token, encrypt_oauth_token};
use crate::database::{models::*, DatabaseError};
use chrono::Utc;
use rusqlite::{params, Connection, Row};

// サブモジュールのエクスポート
pub mod api_repository;
pub mod error_log_repository;
pub mod security_repository;

/// API設定のリポジトリ
pub struct ApiRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ApiRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// API設定を作成
    pub fn create(&self, api: &Api) -> Result<(), DatabaseError> {
        let engine_type = api.engine_type.as_deref().unwrap_or("ollama");
        self.conn.execute(
            r#"
            INSERT INTO apis (id, name, model, port, enable_auth, status, engine_type, engine_config, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                api.id,
                api.name,
                api.model,
                api.port,
                if api.enable_auth { 1 } else { 0 },
                api.status.as_str(),
                engine_type,
                api.engine_config,
                api.created_at.to_rfc3339(),
                api.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// API設定を取得（IDで）
    pub fn find_by_id(&self, id: &str) -> Result<Api, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, engine_type, engine_config, created_at, updated_at FROM apis WHERE id = ?1"
        )?;

        stmt.query_row(params![id], |row| Ok(Self::row_to_api(row)?))
            .map_err(|e| {
                if let rusqlite::Error::QueryReturnedNoRows = e {
                    DatabaseError::NotFound(format!("API ID '{}' が見つかりません", id))
                } else {
                    DatabaseError::QueryFailed(e.to_string())
                }
            })
    }

    /// 全てのAPI設定を取得
    pub fn find_all(&self) -> Result<Vec<Api>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, engine_type, engine_config, created_at, updated_at FROM apis ORDER BY created_at DESC"
        )?;

        let apis = stmt.query_map([], |row| Ok(Self::row_to_api(row)?))?;

        let mut result = Vec::new();
        for api in apis {
            result.push(api?);
        }
        Ok(result)
    }

    /// API設定を更新
    pub fn update(&self, api: &Api) -> Result<(), DatabaseError> {
        let engine_type = api.engine_type.as_deref().unwrap_or("ollama");
        let rows_affected = self.conn.execute(
            r#"
            UPDATE apis 
            SET name = ?2, model = ?3, port = ?4, enable_auth = ?5, status = ?6, engine_type = ?7, engine_config = ?8, updated_at = ?9
            WHERE id = ?1
            "#,
            params![
                api.id,
                api.name,
                api.model,
                api.port,
                if api.enable_auth { 1 } else { 0 },
                api.status.as_str(),
                engine_type,
                api.engine_config,
                api.updated_at.to_rfc3339(),
            ],
        )?;

        if rows_affected == 0 {
            return Err(DatabaseError::NotFound(format!(
                "API ID '{}' が見つかりません",
                api.id
            )));
        }

        Ok(())
    }

    /// API設定を削除
    pub fn delete(&self, id: &str) -> Result<(), DatabaseError> {
        let rows_affected = self
            .conn
            .execute("DELETE FROM apis WHERE id = ?1", params![id])?;

        if rows_affected == 0 {
            return Err(DatabaseError::NotFound(format!(
                "API ID '{}' が見つかりません",
                id
            )));
        }

        Ok(())
    }

    /// API名でAPI設定を取得（BE-008-02で追加）
    pub fn find_by_name(&self, name: &str) -> Result<Option<Api>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, engine_type, engine_config, created_at, updated_at FROM apis WHERE name = ?1"
        )?;

        match stmt.query_row(params![name], |row| Ok(Self::row_to_api(row)?)) {
            Ok(api) => Ok(Some(api)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::QueryFailed(e.to_string())),
        }
    }

    /// ポート番号でAPI設定を取得
    #[allow(dead_code)] // 将来使用予定
    pub fn find_by_port(&self, port: i32) -> Result<Option<Api>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, engine_type, engine_config, created_at, updated_at FROM apis WHERE port = ?1"
        )?;

        match stmt.query_row(params![port], |row| Ok(Self::row_to_api(row)?)) {
            Ok(api) => Ok(Some(api)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::QueryFailed(e.to_string())),
        }
    }

    /// RowからApiに変換
    fn row_to_api(row: &Row) -> Result<Api, rusqlite::Error> {
        let status_str: String = row.get(5)?;
        let engine_type: Option<String> = row.get(6).ok();
        let engine_config: Option<String> = row.get(7).ok();
        let created_at_str: String = row.get(8)?;
        let updated_at_str: String = row.get(9)?;

        let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
            .map_err(|_| {
                rusqlite::Error::InvalidColumnType(
                    8,
                    "created_at".to_string(),
                    rusqlite::types::Type::Text,
                )
            })?
            .with_timezone(&Utc);

        let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
            .map_err(|_| {
                rusqlite::Error::InvalidColumnType(
                    9,
                    "updated_at".to_string(),
                    rusqlite::types::Type::Text,
                )
            })?
            .with_timezone(&Utc);

        Ok(Api {
            id: row.get(0)?,
            name: row.get(1)?,
            model: row.get(2)?,
            port: row.get(3)?,
            enable_auth: row.get::<_, i32>(4)? != 0,
            status: ApiStatus::from_str(&status_str),
            engine_type,
            engine_config,
            created_at,
            updated_at,
        })
    }
}

/// APIキーのリポジトリ
pub struct ApiKeyRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ApiKeyRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// APIキーを作成
    pub fn create(&self, api_key: &ApiKey) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO api_keys (id, api_id, key_hash, encrypted_key, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            params![
                api_key.id,
                api_key.api_id,
                api_key.key_hash,
                api_key.encrypted_key,
                api_key.created_at.to_rfc3339(),
                api_key.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 全てのAPIキーを取得
    pub fn find_all(&self) -> Result<Vec<ApiKey>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, api_id, key_hash, encrypted_key, created_at, updated_at FROM api_keys ORDER BY created_at DESC"
        )?;

        let api_keys = stmt.query_map([], |row| {
            Ok(ApiKey {
                id: row.get(0)?,
                api_id: row.get(1)?,
                key_hash: row.get(2)?,
                encrypted_key: row.get(3)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            4,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            5,
                            "updated_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for api_key in api_keys {
            result.push(api_key?);
        }
        Ok(result)
    }

    /// API IDでAPIキーを取得
    pub fn find_by_api_id(&self, api_id: &str) -> Result<Option<ApiKey>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, api_id, key_hash, encrypted_key, created_at, updated_at FROM api_keys WHERE api_id = ?1"
        )?;

        match stmt.query_row(params![api_id], |row| {
            Ok(ApiKey {
                id: row.get(0)?,
                api_id: row.get(1)?,
                key_hash: row.get(2)?,
                encrypted_key: row.get(3)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            4,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            5,
                            "updated_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        }) {
            Ok(api_key) => Ok(Some(api_key)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::QueryFailed(e.to_string())),
        }
    }

    /// APIキーを更新
    pub fn update(&self, api_key: &ApiKey) -> Result<(), DatabaseError> {
        let rows_affected = self.conn.execute(
            r#"
            UPDATE api_keys 
            SET key_hash = ?2, encrypted_key = ?3, updated_at = ?4
            WHERE id = ?1
            "#,
            params![
                api_key.id,
                api_key.key_hash,
                api_key.encrypted_key,
                api_key.updated_at.to_rfc3339(),
            ],
        )?;

        if rows_affected == 0 {
            return Err(DatabaseError::NotFound(format!(
                "API Key ID '{}' が見つかりません",
                api_key.id
            )));
        }

        Ok(())
    }

    /// APIキーを削除
    pub fn delete_by_api_id(&self, api_id: &str) -> Result<(), DatabaseError> {
        self.conn
            .execute("DELETE FROM api_keys WHERE api_id = ?1", params![api_id])?;
        Ok(())
    }
}

/// モデルカタログのリポジトリ
pub struct ModelCatalogRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ModelCatalogRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// モデルカタログ情報を作成または更新
    #[allow(dead_code)] // 将来使用予定（現在はapi.rsで直接使用）
    pub fn upsert(&self, model: &ModelCatalog) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO models_catalog (name, description, size, parameters, category, recommended, author, license, tags, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(name) DO UPDATE SET
                description = ?2,
                size = ?3,
                parameters = ?4,
                category = ?5,
                recommended = ?6,
                author = ?7,
                license = ?8,
                tags = ?9,
                updated_at = ?11
            "#,
            params![
                model.name,
                model.description,
                model.size,
                model.parameters,
                model.category,
                if model.recommended { 1 } else { 0 },
                model.author,
                model.license,
                model.tags,
                model.created_at.to_rfc3339(),
                model.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 全てのモデルカタログ情報を取得
    pub fn find_all(&self) -> Result<Vec<ModelCatalog>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT name, description, size, parameters, category, recommended, author, license, tags, created_at, updated_at FROM models_catalog ORDER BY name"
        )?;

        let models = stmt.query_map([], |row| {
            Ok(ModelCatalog {
                name: row.get(0)?,
                description: row.get(1)?,
                size: row.get(2)?,
                parameters: row.get(3)?,
                category: row.get(4)?,
                recommended: row.get::<_, i32>(5)? != 0,
                author: row.get(6)?,
                license: row.get(7)?,
                tags: row.get(8)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            9,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            10,
                            "updated_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for model in models {
            result.push(model?);
        }
        Ok(result)
    }

    /// カテゴリでモデルカタログ情報を検索
    #[allow(dead_code)] // 将来使用予定
    pub fn find_by_category(&self, category: &str) -> Result<Vec<ModelCatalog>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT name, description, size, parameters, category, recommended, author, license, tags, created_at, updated_at FROM models_catalog WHERE category = ?1 ORDER BY name"
        )?;

        let models = stmt.query_map(params![category], |row| {
            Ok(ModelCatalog {
                name: row.get(0)?,
                description: row.get(1)?,
                size: row.get(2)?,
                parameters: row.get(3)?,
                category: row.get(4)?,
                recommended: row.get::<_, i32>(5)? != 0,
                author: row.get(6)?,
                license: row.get(7)?,
                tags: row.get(8)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            9,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            10,
                            "updated_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for model in models {
            result.push(model?);
        }
        Ok(result)
    }

    /// 推奨モデルのみを取得
    #[allow(dead_code)] // 将来使用予定
    pub fn find_recommended(&self) -> Result<Vec<ModelCatalog>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT name, description, size, parameters, category, recommended, author, license, tags, created_at, updated_at FROM models_catalog WHERE recommended = 1 ORDER BY name"
        )?;

        let models = stmt.query_map([], |row| {
            Ok(ModelCatalog {
                name: row.get(0)?,
                description: row.get(1)?,
                size: row.get(2)?,
                parameters: row.get(3)?,
                category: row.get(4)?,
                recommended: row.get::<_, i32>(5)? != 0,
                author: row.get(6)?,
                license: row.get(7)?,
                tags: row.get(8)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            9,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            10,
                            "updated_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for model in models {
            result.push(model?);
        }
        Ok(result)
    }
}

/// インストール済みモデルのリポジトリ
pub struct InstalledModelRepository<'a> {
    conn: &'a Connection,
}

impl<'a> InstalledModelRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// インストール済みモデルを作成または更新
    pub fn upsert(&self, model: &InstalledModel) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO installed_models (name, size, parameters, installed_at, last_used_at, usage_count)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(name) DO UPDATE SET
                size = ?2,
                parameters = ?3,
                last_used_at = ?5,
                usage_count = ?6
            "#,
            params![
                model.name,
                model.size,
                model.parameters,
                model.installed_at.to_rfc3339(),
                model.last_used_at.as_ref().map(|d| d.to_rfc3339()),
                model.usage_count,
            ],
        )?;
        Ok(())
    }

    /// 全てのインストール済みモデルを取得
    pub fn find_all(&self) -> Result<Vec<InstalledModel>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT name, size, parameters, installed_at, last_used_at, usage_count FROM installed_models ORDER BY name"
        )?;

        let models = stmt.query_map([], |row| {
            Ok(InstalledModel {
                name: row.get(0)?,
                size: row.get(1)?,
                parameters: row.get(2)?,
                installed_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            3,
                            "installed_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                last_used_at: row
                    .get::<_, Option<String>>(4)?
                    .map(|s| {
                        chrono::DateTime::parse_from_rfc3339(&s)
                            .map_err(|_| {
                                rusqlite::Error::InvalidColumnType(
                                    4,
                                    "last_used_at".to_string(),
                                    rusqlite::types::Type::Text,
                                )
                            })
                            .map(|dt| dt.with_timezone(&Utc))
                    })
                    .transpose()?,
                usage_count: row.get(5)?,
            })
        })?;

        let mut result = Vec::new();
        for model in models {
            result.push(model?);
        }
        Ok(result)
    }

    /// 使用回数を更新
    #[allow(dead_code)] // 将来使用予定（F006ログ表示機能で使用予定）
    pub fn increment_usage(&self, name: &str) -> Result<(), DatabaseError> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            UPDATE installed_models 
            SET usage_count = usage_count + 1, last_used_at = ?1
            WHERE name = ?2
            "#,
            params![now, name],
        )?;
        Ok(())
    }

    /// インストール済みモデルを削除
    pub fn delete(&self, name: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM installed_models WHERE name = ?1",
            params![name],
        )?;
        Ok(())
    }
}

/// リクエストログのリポジトリ（F006の基盤）
pub struct RequestLogRepository<'a> {
    conn: &'a Connection,
}

impl<'a> RequestLogRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// リクエストログを作成
    pub fn create(&self, log: &RequestLog) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO request_logs (id, api_id, method, path, request_body, response_status, response_time_ms, error_message, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                log.id,
                log.api_id,
                log.method,
                log.path,
                log.request_body,
                log.response_status,
                log.response_time_ms,
                log.error_message,
                log.created_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// API IDでリクエストログを取得（最新順）
    ///
    /// # 注意
    /// このメソッドは`find_with_filters`で置き換え可能ですが、後方互換性のため保持されています。
    #[allow(dead_code)]
    pub fn find_by_api_id(
        &self,
        api_id: &str,
        limit: Option<i32>,
    ) -> Result<Vec<RequestLog>, DatabaseError> {
        let limit_value = limit.unwrap_or(100);
        let mut stmt = self.conn.prepare(
            "SELECT id, api_id, method, path, request_body, response_status, response_time_ms, error_message, created_at FROM request_logs WHERE api_id = ?1 ORDER BY created_at DESC LIMIT ?2"
        )?;

        let logs = stmt.query_map(params![api_id, limit_value], |row| {
            Ok(RequestLog {
                id: row.get(0)?,
                api_id: row.get(1)?,
                method: row.get(2)?,
                path: row.get(3)?,
                request_body: row.get(4)?,
                response_status: row.get(5)?,
                response_time_ms: row.get(6)?,
                error_message: row.get(7)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            8,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for log in logs {
            result.push(log?);
        }
        Ok(result)
    }

    /// 全てのリクエストログを取得（最新順、ページネーション対応）
    ///
    /// # 注意
    /// このメソッドは`find_with_filters`で置き換え可能ですが、後方互換性のため保持されています。
    #[allow(dead_code)]
    pub fn find_all(
        &self,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<RequestLog>, DatabaseError> {
        let limit_value = limit.unwrap_or(100);
        let offset_value = offset.unwrap_or(0);
        let mut stmt = self.conn.prepare(
            "SELECT id, api_id, method, path, request_body, response_status, response_time_ms, error_message, created_at FROM request_logs ORDER BY created_at DESC LIMIT ?1 OFFSET ?2"
        )?;

        let logs = stmt.query_map(params![limit_value, offset_value], |row| {
            Ok(RequestLog {
                id: row.get(0)?,
                api_id: row.get(1)?,
                method: row.get(2)?,
                path: row.get(3)?,
                request_body: row.get(4)?,
                response_status: row.get(5)?,
                response_time_ms: row.get(6)?,
                error_message: row.get(7)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            8,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for log in logs {
            result.push(log?);
        }
        Ok(result)
    }

    /// フィルタ条件を使用してリクエストログを取得（BE-006-01で追加、BE-006-03で最適化）
    ///
    /// # パフォーマンス最適化
    /// - インデックス使用: `idx_request_logs_api_id`, `idx_request_logs_created_at`,
    ///   `idx_request_logs_response_status`, `idx_request_logs_path`,
    ///   `idx_request_logs_api_created` (複合インデックス)
    /// - LIMIT/OFFSETでページネーション実装
    /// - 動的WHERE句構築で不要な条件を除外
    ///
    /// # パラメータ
    /// - `api_id`: フィルタ対象のAPI ID（オプション）
    /// - `limit`: 取得件数の上限（デフォルト: 100）
    /// - `offset`: スキップする件数（デフォルト: 0）
    /// - `start_date`: 開始日時（ISO 8601形式、オプション）
    /// - `end_date`: 終了日時（ISO 8601形式、オプション）
    /// - `status_codes`: ステータスコード配列（オプション、IN句で使用）
    /// - `path_filter`: パス検索文字列（LIKE検索、オプション）
    /// - `errors_only`: エラーメッセージが存在するログのみを取得するかどうか（デフォルト: false）
    ///
    /// # 返り値
    /// フィルタ条件に一致するリクエストログのベクタ（作成日時降順）
    pub fn find_with_filters(
        &self,
        api_id: Option<&str>,
        limit: Option<i32>,
        offset: Option<i32>,
        start_date: Option<&str>,
        end_date: Option<&str>,
        status_codes: Option<&[i32]>,
        path_filter: Option<&str>,
        errors_only: bool,
    ) -> Result<Vec<RequestLog>, DatabaseError> {
        let limit_value = limit.unwrap_or(100);
        let offset_value = offset.unwrap_or(0);

        // SQLクエリの構築（動的にWHERE句を追加）
        let mut query = String::from(
            "SELECT id, api_id, method, path, request_body, response_status, response_time_ms, error_message, created_at FROM request_logs"
        );

        let mut conditions = Vec::new();

        // API IDフィルタ
        if api_id.is_some() {
            conditions.push("api_id = ?1".to_string());
        }

        // 開始日時フィルタ
        if start_date.is_some() {
            let param_idx = conditions.len() + 1;
            conditions.push(format!("created_at >= ?{}", param_idx));
        }

        // 終了日時フィルタ
        if end_date.is_some() {
            let param_idx = conditions.len() + 1;
            conditions.push(format!("created_at <= ?{}", param_idx));
        }

        // ステータスコードフィルタ
        if let Some(status_codes_val) = status_codes {
            if !status_codes_val.is_empty() {
                let param_idx = conditions.len() + 1;
                let placeholders: Vec<String> = (0..status_codes_val.len())
                    .map(|i| format!("?{}", param_idx + i))
                    .collect();
                conditions.push(format!("response_status IN ({})", placeholders.join(", ")));
            }
        }

        // パスフィルタ（LIKE検索）
        if let Some(path_filter_val) = path_filter {
            if !path_filter_val.is_empty() {
                let param_idx = conditions.len() + 1;
                conditions.push(format!("path LIKE ?{}", param_idx));
            }
        }

        // エラーメッセージフィルタ
        if errors_only {
            conditions.push("error_message IS NOT NULL AND error_message != ''".to_string());
        }

        // WHERE句の追加
        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }

        // ORDER BY句
        query.push_str(" ORDER BY created_at DESC");

        // LIMIT/OFFSET句（パラメータインデックスを再計算）
        let mut limit_param_idx = conditions.len() + 1;
        let mut offset_param_idx = limit_param_idx + 1;

        // ステータスコード配列の分だけパラメータインデックスを調整
        if let Some(status_codes_val) = status_codes {
            if !status_codes_val.is_empty() {
                limit_param_idx += status_codes_val.len() - 1;
                offset_param_idx = limit_param_idx + 1;
            }
        }

        query.push_str(&format!(
            " LIMIT ?{} OFFSET ?{}",
            limit_param_idx, offset_param_idx
        ));

        let mut stmt = self.conn.prepare(&query)?;

        // パラメータを所有された値として収集（ライフタイムの問題を回避）
        let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql + Send + Sync>> = Vec::new();

        if let Some(api_id_val) = api_id {
            params_vec.push(Box::new(api_id_val.to_string()));
        }

        if let Some(start_date_val) = start_date {
            params_vec.push(Box::new(start_date_val.to_string()));
        }

        if let Some(end_date_val) = end_date {
            params_vec.push(Box::new(end_date_val.to_string()));
        }

        if let Some(status_codes_val) = status_codes {
            if !status_codes_val.is_empty() {
                for code in status_codes_val {
                    params_vec.push(Box::new(*code));
                }
            }
        }

        if let Some(path_filter_val) = path_filter {
            if !path_filter_val.is_empty() {
                // 所有された値として保存
                let path_pattern = format!("%{}%", path_filter_val);
                params_vec.push(Box::new(path_pattern));
            }
        }

        params_vec.push(Box::new(limit_value));
        params_vec.push(Box::new(offset_value));

        // パラメータをイテレータとして渡す
        use rusqlite::params_from_iter;
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec
            .iter()
            .map(|p| p.as_ref() as &dyn rusqlite::types::ToSql)
            .collect();

        let logs = stmt.query_map(params_from_iter(param_refs), |row| {
            Ok(RequestLog {
                id: row.get(0)?,
                api_id: row.get(1)?,
                method: row.get(2)?,
                path: row.get(3)?,
                request_body: row.get(4)?,
                response_status: row.get(5)?,
                response_time_ms: row.get(6)?,
                error_message: row.get(7)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            8,
                            "created_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for log in logs {
            result.push(log?);
        }
        Ok(result)
    }

    /// フィルタ条件に一致するログの総件数を取得（CODE-002修正）
    /// find_with_filtersと同じフィルタ条件を使用してCOUNTクエリを実行します
    pub fn count_with_filters(
        &self,
        api_id: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
        status_codes: Option<&[i32]>,
        path_filter: Option<&str>,
        errors_only: bool,
    ) -> Result<i64, DatabaseError> {
        // SQLクエリの構築（動的にWHERE句を追加）
        let mut query = String::from("SELECT COUNT(*) FROM request_logs");

        let mut conditions = Vec::new();

        // API IDフィルタ
        if api_id.is_some() {
            conditions.push("api_id = ?1".to_string());
        }

        // 開始日時フィルタ
        if start_date.is_some() {
            let param_idx = conditions.len() + 1;
            conditions.push(format!("created_at >= ?{}", param_idx));
        }

        // 終了日時フィルタ
        if end_date.is_some() {
            let param_idx = conditions.len() + 1;
            conditions.push(format!("created_at <= ?{}", param_idx));
        }

        // ステータスコードフィルタ
        if let Some(status_codes_val) = status_codes {
            if !status_codes_val.is_empty() {
                let param_idx = conditions.len() + 1;
                let placeholders: Vec<String> = (0..status_codes_val.len())
                    .map(|i| format!("?{}", param_idx + i))
                    .collect();
                conditions.push(format!("response_status IN ({})", placeholders.join(", ")));
            }
        }

        // パスフィルタ（LIKE検索）
        if let Some(path_filter_val) = path_filter {
            if !path_filter_val.is_empty() {
                let param_idx = conditions.len() + 1;
                conditions.push(format!("path LIKE ?{}", param_idx));
            }
        }

        // エラーメッセージフィルタ
        if errors_only {
            conditions.push("error_message IS NOT NULL AND error_message != ''".to_string());
        }

        // WHERE句の追加
        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }

        let mut stmt = self.conn.prepare(&query)?;

        // パラメータを所有された値として収集（ライフタイムの問題を回避）
        let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql + Send + Sync>> = Vec::new();

        if let Some(api_id_val) = api_id {
            params_vec.push(Box::new(api_id_val.to_string()));
        }

        if let Some(start_date_val) = start_date {
            params_vec.push(Box::new(start_date_val.to_string()));
        }

        if let Some(end_date_val) = end_date {
            params_vec.push(Box::new(end_date_val.to_string()));
        }

        if let Some(status_codes_val) = status_codes {
            if !status_codes_val.is_empty() {
                for code in status_codes_val {
                    params_vec.push(Box::new(*code));
                }
            }
        }

        if let Some(path_filter_val) = path_filter {
            if !path_filter_val.is_empty() {
                let path_pattern = format!("%{}%", path_filter_val);
                params_vec.push(Box::new(path_pattern));
            }
        }

        // パラメータをイテレータとして渡す
        use rusqlite::params_from_iter;
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec
            .iter()
            .map(|p| p.as_ref() as &dyn rusqlite::types::ToSql)
            .collect();

        let count: i64 = if param_refs.is_empty() {
            stmt.query_row([], |row| row.get(0))?
        } else {
            stmt.query_row(params_from_iter(param_refs), |row| row.get(0))?
        };

        Ok(count)
    }

    /// ログ統計情報を取得（BE-006-02で追加、BE-006-03で最適化）
    ///
    /// # パフォーマンス最適化
    /// - インデックス使用: `idx_request_logs_api_id`, `idx_request_logs_created_at`,
    ///   `idx_request_logs_api_created` (複合インデックス)
    /// - COUNT, AVG, GROUP BYを個別クエリで実行（将来的にUNIONやCTEで統合可能）
    ///
    /// # パラメータ
    /// - `api_id`: 対象のAPI ID（オプション）
    /// - `start_date`: 開始日時（ISO 8601形式、オプション）
    /// - `end_date`: 終了日時（ISO 8601形式、オプション）
    ///
    /// # 返り値
    /// `(total_requests, avg_response_time_ms, error_rate, status_code_distribution)`
    /// - `total_requests`: 総リクエスト数
    /// - `avg_response_time_ms`: 平均レスポンス時間（ミリ秒）
    /// - `error_rate`: エラー率（0.0-1.0、4xx/5xxステータスの割合）
    /// - `status_code_distribution`: ステータスコード分布 `Vec<(status_code, count)>`
    pub fn get_statistics(
        &self,
        api_id: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<(i64, f64, f64, Vec<(i32, i64)>), DatabaseError> {
        // WHERE条件の構築
        let mut conditions = Vec::new();
        // パラメータを所有された値として収集（ライフタイムの問題を回避）
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(api_id_val) = api_id {
            conditions.push("api_id = ?1".to_string());
            params_vec.push(Box::new(api_id_val.to_string()));
        }

        if let Some(start_date_val) = start_date {
            let param_idx = params_vec.len() + 1;
            conditions.push(format!("created_at >= ?{}", param_idx));
            params_vec.push(Box::new(start_date_val.to_string()));
        }

        if let Some(end_date_val) = end_date {
            let param_idx = params_vec.len() + 1;
            conditions.push(format!("created_at <= ?{}", param_idx));
            params_vec.push(Box::new(end_date_val.to_string()));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // 総リクエスト数
        let total_requests_query = format!("SELECT COUNT(*) FROM request_logs {}", where_clause);
        use rusqlite::params_from_iter;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
            .iter()
            .map(|p| p.as_ref() as &dyn rusqlite::ToSql)
            .collect();
        let total_requests: i64 = if param_refs.is_empty() {
            self.conn
                .query_row(&total_requests_query, [], |row| row.get(0))?
        } else {
            self.conn.query_row(
                &total_requests_query,
                params_from_iter(param_refs.iter()),
                |row| row.get(0),
            )?
        };

        // 平均レスポンス時間（response_time_msがNULLでないもののみ）
        let avg_response_time_query = if conditions.is_empty() {
            "SELECT AVG(response_time_ms) FROM request_logs WHERE response_time_ms IS NOT NULL"
                .to_string()
        } else {
            format!(
                "SELECT AVG(response_time_ms) FROM request_logs {} AND response_time_ms IS NOT NULL",
                where_clause
            )
        };
        let avg_response_time_ms: f64 = if param_refs.is_empty() {
            self.conn
                .query_row(&avg_response_time_query, [], |row| {
                    Ok(row.get::<_, Option<f64>>(0)?.unwrap_or(0.0))
                })
                .unwrap_or(0.0)
        } else {
            self.conn
                .query_row(
                    &avg_response_time_query,
                    params_from_iter(param_refs.iter()),
                    |row| Ok(row.get::<_, Option<f64>>(0)?.unwrap_or(0.0)),
                )
                .unwrap_or(0.0)
        };

        // エラー率（response_status >= 400またはerror_message IS NOT NULLの割合）
        let error_count_query = format!(
            "SELECT COUNT(*) FROM request_logs {} AND (response_status >= 400 OR error_message IS NOT NULL)",
            where_clause
        );
        let error_count: i64 = if param_refs.is_empty() {
            self.conn
                .query_row(&error_count_query, [], |row| row.get(0))?
        } else {
            self.conn.query_row(
                &error_count_query,
                params_from_iter(param_refs.iter()),
                |row| row.get(0),
            )?
        };
        let error_rate = if total_requests > 0 {
            (error_count as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };

        // ステータスコード分布
        let status_distribution_query = if conditions.is_empty() {
            "SELECT response_status, COUNT(*) as count FROM request_logs WHERE response_status IS NOT NULL GROUP BY response_status ORDER BY count DESC".to_string()
        } else {
            format!(
                "SELECT response_status, COUNT(*) as count FROM request_logs {} AND response_status IS NOT NULL GROUP BY response_status ORDER BY count DESC",
                where_clause
            )
        };
        let mut stmt = self.conn.prepare(&status_distribution_query)?;
        let row_mapper = |row: &rusqlite::Row| -> Result<(i32, i64), rusqlite::Error> {
            Ok((row.get::<_, i32>(0)?, row.get::<_, i64>(1)?))
        };
        let distribution = if param_refs.is_empty() {
            stmt.query_map([], row_mapper)?
        } else {
            stmt.query_map(params_from_iter(param_refs.iter()), row_mapper)?
        };

        let mut status_code_distribution = Vec::new();
        for item in distribution {
            status_code_distribution.push(item?);
        }

        Ok((
            total_requests,
            avg_response_time_ms,
            error_rate,
            status_code_distribution,
        ))
    }

    /// 日付範囲指定でログを削除（BE-008-03）
    ///
    /// # パラメータ
    /// - `api_id`: 削除対象のAPI ID（オプション、Noneの場合は全API）
    /// - `before_date`: この日時より前のログを削除（ISO 8601形式、オプション）
    ///
    /// # 返り値
    /// 削除されたログの件数
    ///
    /// # 注意
    /// 安全のため、api_idとbefore_dateの両方がNoneの場合はエラーを返します。
    /// トランザクション内で実行されるため、エラー時は自動的にロールバックされます。
    pub fn delete_by_date_range(
        &self,
        api_id: Option<&str>,
        before_date: Option<&str>,
    ) -> Result<usize, DatabaseError> {
        // 条件がない場合は全件削除を防ぐ（安全のため）
        if api_id.is_none() && before_date.is_none() {
            return Err(DatabaseError::QueryFailed(
                "全ログの削除は許可されていません。API IDまたは日付条件を指定してください。"
                    .to_string(),
            ));
        }

        // 条件に応じてクエリを実行（SQLiteのDELETEは単一ステートメントでも原子性がある）
        let rows_affected = match (api_id, before_date) {
            (Some(api_id_val), Some(before_date_val)) => {
                // API IDと日付の両方を指定
                self.conn.execute(
                    "DELETE FROM request_logs WHERE api_id = ?1 AND created_at < ?2",
                    params![api_id_val, before_date_val],
                )?
            }
            (Some(api_id_val), none_date) => {
                // API IDのみ指定（Clippy警告回避: none_dateとして明示的に命名）
                let _ = none_date; // 未使用変数の警告を回避
                self.conn.execute(
                    "DELETE FROM request_logs WHERE api_id = ?1",
                    params![api_id_val],
                )?
            }
            (none_id, Some(before_date_val)) => {
                // 日付のみ指定（Clippy警告回避: none_idとして明示的に命名）
                let _ = none_id; // 未使用変数の警告を回避
                self.conn.execute(
                    "DELETE FROM request_logs WHERE created_at < ?1",
                    params![before_date_val],
                )?
            }
            (none_id, none_date) => {
                // このパターンは既に上でエラーになっているはず（1069行目で早期リターン）
                // しかし、念のためエラーを返す（防御的プログラミング）
                let _ = (none_id, none_date); // 未使用変数の警告を回避
                return Err(DatabaseError::QueryFailed(
                    "全ログの削除は許可されていません。API IDまたは日付条件を指定してください。"
                        .to_string(),
                ));
            }
        };

        Ok(rows_affected)
    }
}

/// ユーザー設定のリポジトリ
#[allow(dead_code)] // 将来使用予定
pub struct UserSettingRepository<'a> {
    conn: &'a Connection,
}

#[allow(dead_code)] // 将来使用予定
impl<'a> UserSettingRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// ユーザー設定を取得
    pub fn get(&self, key: &str) -> Result<Option<String>, DatabaseError> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM user_settings WHERE key = ?1")?;

        match stmt.query_row(params![key], |row| Ok(row.get::<_, String>(0)?)) {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::QueryFailed(e.to_string())),
        }
    }

    /// ユーザー設定を設定
    pub fn set(&self, key: &str, value: &str) -> Result<(), DatabaseError> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            r#"
            INSERT INTO user_settings (key, value, updated_at)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3
            "#,
            params![key, value, now],
        )?;
        Ok(())
    }

    /// 全てのユーザー設定を取得
    pub fn get_all(&self) -> Result<Vec<UserSetting>, DatabaseError> {
        let mut stmt = self
            .conn
            .prepare("SELECT key, value, updated_at FROM user_settings ORDER BY key")?;

        let settings = stmt.query_map([], |row| {
            Ok(UserSetting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            2,
                            "updated_at".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for setting in settings {
            result.push(setting?);
        }
        Ok(result)
    }
}

/// パフォーマンスメトリクスのリポジトリ（F007の基盤）
pub struct PerformanceMetricRepository<'a> {
    conn: &'a Connection,
}

impl<'a> PerformanceMetricRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// パフォーマンスメトリクスを作成
    pub fn create(&self, metric: &PerformanceMetric) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO performance_metrics (api_id, metric_type, value, timestamp)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            params![
                metric.api_id,
                metric.metric_type,
                metric.value,
                metric.timestamp.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// API IDでパフォーマンスメトリクスを取得（最新順）
    pub fn find_by_api_id(
        &self,
        api_id: &str,
        limit: Option<i32>,
    ) -> Result<Vec<PerformanceMetric>, DatabaseError> {
        let limit_value = limit.unwrap_or(1000);
        let mut stmt = self.conn.prepare(
            "SELECT id, api_id, metric_type, value, timestamp FROM performance_metrics WHERE api_id = ?1 ORDER BY timestamp DESC LIMIT ?2"
        )?;

        let metrics = stmt.query_map(params![api_id, limit_value], |row| {
            Ok(PerformanceMetric {
                id: row.get(0)?,
                api_id: row.get(1)?,
                metric_type: row.get(2)?,
                value: row.get(3)?,
                timestamp: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            4,
                            "timestamp".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for metric in metrics {
            result.push(metric?);
        }
        Ok(result)
    }

    /// API IDとメトリクスタイプでパフォーマンスメトリクスを取得（最新順）
    pub fn find_by_api_id_and_type(
        &self,
        api_id: &str,
        metric_type: &str,
        limit: Option<i32>,
    ) -> Result<Vec<PerformanceMetric>, DatabaseError> {
        let limit_value = limit.unwrap_or(1000);
        let mut stmt = self.conn.prepare(
            "SELECT id, api_id, metric_type, value, timestamp FROM performance_metrics WHERE api_id = ?1 AND metric_type = ?2 ORDER BY timestamp DESC LIMIT ?3"
        )?;

        let metrics = stmt.query_map(params![api_id, metric_type, limit_value], |row| {
            Ok(PerformanceMetric {
                id: row.get(0)?,
                api_id: row.get(1)?,
                metric_type: row.get(2)?,
                value: row.get(3)?,
                timestamp: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            4,
                            "timestamp".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for metric in metrics {
            result.push(metric?);
        }
        Ok(result)
    }

    /// API IDと時系列範囲でパフォーマンスメトリクスを取得
    pub fn find_by_api_id_and_range(
        &self,
        api_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
        metric_type: Option<&str>,
    ) -> Result<Vec<PerformanceMetric>, DatabaseError> {
        let mut query = "SELECT id, api_id, metric_type, value, timestamp FROM performance_metrics WHERE api_id = ?1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        params_vec.push(Box::new(api_id.to_string()));

        let mut param_idx = 2;

        if let Some(mt) = metric_type {
            query.push_str(&format!(" AND metric_type = ?{}", param_idx));
            params_vec.push(Box::new(mt.to_string()));
            param_idx += 1;
        }

        if let Some(sd) = start_date {
            query.push_str(&format!(" AND timestamp >= ?{}", param_idx));
            params_vec.push(Box::new(sd.to_string()));
            param_idx += 1;
        }

        if let Some(ed) = end_date {
            query.push_str(&format!(" AND timestamp <= ?{}", param_idx));
            params_vec.push(Box::new(ed.to_string()));
            // param_idxは次のパラメータ用にインクリメント済み（将来の拡張用）
            // 警告回避のため明示的に使用
            let _next_idx = param_idx + 1;
        }

        query.push_str(" ORDER BY timestamp ASC");

        let mut stmt = self.conn.prepare(&query)?;

        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
            .iter()
            .map(|p| p.as_ref() as &dyn rusqlite::ToSql)
            .collect();

        let metrics = stmt.query_map(rusqlite::params_from_iter(param_refs), |row| {
            Ok(PerformanceMetric {
                id: row.get(0)?,
                api_id: row.get(1)?,
                metric_type: row.get(2)?,
                value: row.get(3)?,
                timestamp: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            4,
                            "timestamp".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        let mut result = Vec::new();
        for metric in metrics {
            result.push(metric?);
        }
        Ok(result)
    }

    /// 古いメトリクスを削除（オプション、30日以上古いデータ等）
    ///
    /// # 注意
    /// このメソッドは定期メンテナンス用に実装されていますが、現在は自動実行されていません。
    /// 将来的にバックグラウンドジョブとして実行される予定です。
    #[allow(dead_code)]
    pub fn delete_old_metrics(&self, days: i32) -> Result<usize, DatabaseError> {
        let cutoff_date = Utc::now() - chrono::Duration::days(days as i64);
        let cutoff_str = cutoff_date.to_rfc3339();

        let rows_affected = self.conn.execute(
            "DELETE FROM performance_metrics WHERE timestamp < ?1",
            params![cutoff_str],
        )?;

        Ok(rows_affected)
    }
}

/// アラート履歴のリポジトリ（F012の基盤）
pub struct AlertHistoryRepository<'a> {
    conn: &'a Connection,
}

impl<'a> AlertHistoryRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// アラート履歴を作成
    pub fn create(
        &self,
        alert: &crate::database::models::AlertHistory,
    ) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO alert_history (id, api_id, alert_type, current_value, threshold, message, timestamp, resolved_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                alert.id,
                alert.api_id,
                alert.alert_type,
                alert.current_value,
                alert.threshold,
                alert.message,
                alert.timestamp.to_rfc3339(),
                alert.resolved_at.map(|dt| dt.to_rfc3339()),
            ],
        )?;
        Ok(())
    }

    /// API IDでアラート履歴を取得（最新順）
    pub fn find_by_api_id(
        &self,
        api_id: &str,
        limit: Option<i32>,
    ) -> Result<Vec<crate::database::models::AlertHistory>, DatabaseError> {
        let limit_value = limit.unwrap_or(100);
        let mut stmt = self.conn.prepare(
            "SELECT id, api_id, alert_type, current_value, threshold, message, timestamp, resolved_at FROM alert_history WHERE api_id = ?1 ORDER BY timestamp DESC LIMIT ?2"
        )?;

        let alerts = stmt.query_map(params![api_id, limit_value], |row| {
            Ok(crate::database::models::AlertHistory {
                id: row.get(0)?,
                api_id: row.get(1)?,
                alert_type: row.get(2)?,
                current_value: row.get(3)?,
                threshold: row.get(4)?,
                message: row.get(5)?,
                timestamp: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            6,
                            "timestamp".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                resolved_at: row
                    .get::<_, Option<String>>(7)?
                    .map(|s| {
                        chrono::DateTime::parse_from_rfc3339(&s)
                            .map_err(|_| {
                                rusqlite::Error::InvalidColumnType(
                                    7,
                                    "resolved_at".to_string(),
                                    rusqlite::types::Type::Text,
                                )
                            })
                            .map(|dt| dt.with_timezone(&Utc))
                    })
                    .transpose()?,
            })
        })?;

        let mut result = Vec::new();
        for alert in alerts {
            result.push(alert?);
        }
        Ok(result)
    }

    /// すべてのアラート履歴を取得（最新順、未解決のみまたはすべて）
    pub fn find_all(
        &self,
        unresolved_only: bool,
        limit: Option<i32>,
    ) -> Result<Vec<crate::database::models::AlertHistory>, DatabaseError> {
        let limit_value = limit.unwrap_or(100);
        let query = if unresolved_only {
            "SELECT id, api_id, alert_type, current_value, threshold, message, timestamp, resolved_at FROM alert_history WHERE resolved_at IS NULL ORDER BY timestamp DESC LIMIT ?1"
        } else {
            "SELECT id, api_id, alert_type, current_value, threshold, message, timestamp, resolved_at FROM alert_history ORDER BY timestamp DESC LIMIT ?1"
        };

        let mut stmt = self.conn.prepare(query)?;

        let alerts = stmt.query_map(params![limit_value], |row| {
            Ok(crate::database::models::AlertHistory {
                id: row.get(0)?,
                api_id: row.get(1)?,
                alert_type: row.get(2)?,
                current_value: row.get(3)?,
                threshold: row.get(4)?,
                message: row.get(5)?,
                timestamp: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                    .map_err(|_| {
                        rusqlite::Error::InvalidColumnType(
                            6,
                            "timestamp".to_string(),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                resolved_at: row
                    .get::<_, Option<String>>(7)?
                    .map(|s| {
                        chrono::DateTime::parse_from_rfc3339(&s)
                            .map_err(|_| {
                                rusqlite::Error::InvalidColumnType(
                                    7,
                                    "resolved_at".to_string(),
                                    rusqlite::types::Type::Text,
                                )
                            })
                            .map(|dt| dt.with_timezone(&Utc))
                    })
                    .transpose()?,
            })
        })?;

        let mut result = Vec::new();
        for alert in alerts {
            result.push(alert?);
        }
        Ok(result)
    }

    /// アラートを解決済みとしてマーク
    pub fn mark_resolved(&self, id: &str) -> Result<(), DatabaseError> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE alert_history SET resolved_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::schema::create_schema;
    use rusqlite::Connection;

    /// テスト用のデータベース接続を作成
    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("テスト用データベースの作成に失敗");
        create_schema(&conn).expect("スキーマ作成に失敗");
        conn
    }

    #[test]
    fn test_api_repository_create_and_find() {
        let conn = create_test_db();
        let repo = ApiRepository::new(&conn);

        let api = Api {
            id: "test-api-1".to_string(),
            name: "Test API".to_string(),
            model: "llama3:8b".to_string(),
            port: 8080,
            enable_auth: true,
            status: ApiStatus::Stopped,
            engine_type: Some("ollama".to_string()),
            engine_config: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // 作成
        repo.create(&api).expect("API作成に失敗");

        // 取得
        let found = repo.find_by_id("test-api-1").expect("API取得に失敗");
        assert_eq!(found.id, api.id);
        assert_eq!(found.name, api.name);
        assert_eq!(found.model, api.model);
        assert_eq!(found.port, api.port);
        assert_eq!(found.enable_auth, api.enable_auth);
    }

    #[test]
    fn test_api_repository_update() {
        let conn = create_test_db();
        let repo = ApiRepository::new(&conn);

        let mut api = Api {
            id: "test-api-1".to_string(),
            name: "Test API".to_string(),
            model: "llama3:8b".to_string(),
            port: 8080,
            enable_auth: true,
            status: ApiStatus::Stopped,
            engine_type: Some("ollama".to_string()),
            engine_config: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        repo.create(&api).expect("API作成に失敗");

        // 更新
        api.name = "Updated API".to_string();
        api.port = 9000;
        api.updated_at = Utc::now();

        repo.update(&api).expect("API更新に失敗");

        let found = repo.find_by_id("test-api-1").expect("API取得に失敗");
        assert_eq!(found.name, "Updated API");
        assert_eq!(found.port, 9000);
    }

    #[test]
    fn test_api_repository_delete() {
        let conn = create_test_db();
        let repo = ApiRepository::new(&conn);

        let api = Api {
            id: "test-api-1".to_string(),
            name: "Test API".to_string(),
            model: "llama3:8b".to_string(),
            port: 8080,
            enable_auth: true,
            status: ApiStatus::Stopped,
            engine_type: Some("ollama".to_string()),
            engine_config: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        repo.create(&api).expect("API作成に失敗");

        // 削除
        repo.delete("test-api-1").expect("API削除に失敗");

        // 存在しないことを確認
        let result = repo.find_by_id("test-api-1");
        assert!(result.is_err());
        if let Err(DatabaseError::NotFound(_)) = result {
            // 期待通り
        } else {
            panic!("NotFoundエラーが期待されました");
        }
    }

    #[test]
    fn test_api_key_repository_create_and_find() {
        let conn = create_test_db();
        let key_repo = ApiKeyRepository::new(&conn);

        // まずAPIを作成
        let api_repo = ApiRepository::new(&conn);
        let api = Api {
            id: "test-api-1".to_string(),
            name: "Test API".to_string(),
            model: "llama3:8b".to_string(),
            port: 8080,
            enable_auth: true,
            status: ApiStatus::Stopped,
            engine_type: Some("ollama".to_string()),
            engine_config: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        api_repo.create(&api).expect("API作成に失敗");

        let api_key = ApiKey {
            id: "test-key-1".to_string(),
            api_id: "test-api-1".to_string(),
            key_hash: "test_hash".to_string(),
            encrypted_key: vec![1, 2, 3, 4],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        key_repo.create(&api_key).expect("APIキー作成に失敗");

        let found = key_repo
            .find_by_api_id("test-api-1")
            .expect("APIキー取得に失敗")
            .expect("APIキーが見つかりません");

        assert_eq!(found.id, api_key.id);
        assert_eq!(found.api_id, api_key.api_id);
        assert_eq!(found.key_hash, api_key.key_hash);
    }

    #[test]
    fn test_installed_model_repository() {
        let conn = create_test_db();
        let repo = InstalledModelRepository::new(&conn);

        let model = InstalledModel {
            name: "llama3:8b".to_string(),
            size: 4_700_000_000,
            parameters: Some(8_000_000_000),
            installed_at: Utc::now(),
            last_used_at: Some(Utc::now()),
            usage_count: 0,
        };

        repo.upsert(&model).expect("モデル作成に失敗");

        let models = repo.find_all().expect("モデル一覧取得に失敗");
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].name, "llama3:8b");

        repo.increment_usage("llama3:8b")
            .expect("使用回数更新に失敗");

        let updated = repo.find_all().expect("モデル一覧取得に失敗");
        assert_eq!(updated[0].usage_count, 1);
    }

    #[test]
    fn test_user_setting_repository() {
        let conn = create_test_db();
        let repo = UserSettingRepository::new(&conn);

        repo.set("test_key", "test_value").expect("設定保存に失敗");

        let value = repo.get("test_key").expect("設定取得に失敗");
        assert_eq!(value, Some("test_value".to_string()));

        repo.set("test_key", "updated_value")
            .expect("設定更新に失敗");
        let updated = repo.get("test_key").expect("設定取得に失敗");
        assert_eq!(updated, Some("updated_value".to_string()));
    }
}

/// OAuthトークンのリポジトリ
/// 将来のOAuth実装で使用予定
#[allow(dead_code)]
pub struct OAuthTokenRepository<'a> {
    conn: &'a Connection,
}

impl<'a> OAuthTokenRepository<'a> {
    #[allow(dead_code)] // 将来のOAuth実装で使用予定
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// OAuthトークンを作成または更新（暗号化して保存）
    #[allow(dead_code)] // 将来のOAuth実装で使用予定
    pub fn save(&self, token: &OAuthToken) -> Result<(), DatabaseError> {
        // アクセストークンを暗号化
        let encrypted_access_token = encrypt_oauth_token(&token.access_token).map_err(|e| {
            DatabaseError::QueryFailed(format!("アクセストークンの暗号化エラー: {}", e))
        })?;

        // リフレッシュトークンを暗号化（存在する場合）
        let encrypted_refresh_token = token
            .refresh_token
            .as_ref()
            .map(|rt| encrypt_oauth_token(rt))
            .transpose()
            .map_err(|e| {
                DatabaseError::QueryFailed(format!("リフレッシュトークンの暗号化エラー: {}", e))
            })?;

        // スコープをJSON文字列に変換
        let scope_json = token.scope.as_ref().map(|s| s.clone()).or_else(|| {
            // スコープがNoneの場合は空のJSON配列を返す
            Some("[]".to_string())
        });

        // INSERT OR REPLACEを使用して、既存のトークンがあれば更新、なければ作成
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO oauth_tokens 
            (id, api_id, access_token, refresh_token, token_type, expires_at, scope, client_id, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                token.id,
                token.api_id,
                encrypted_access_token,
                encrypted_refresh_token,
                token.token_type,
                token.expires_at,
                scope_json,
                token.client_id,
                token.created_at.to_rfc3339(),
                token.updated_at.to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    /// OAuthトークンを取得（復号化して返す）
    #[allow(dead_code)] // 将来のOAuth実装で使用予定
    pub fn find_by_api_id(&self, api_id: &str) -> Result<Option<OAuthToken>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, api_id, access_token, refresh_token, token_type, expires_at, scope, client_id, created_at, updated_at
            FROM oauth_tokens
            WHERE api_id = ?1
            ORDER BY updated_at DESC
            LIMIT 1
            "#
        )?;

        let mut rows = stmt.query_map(params![api_id], |row| {
            let encrypted_access_token: String = row.get(2)?;
            let encrypted_refresh_token: Option<String> = row.get(3)?;

            // アクセストークンを復号化
            let access_token = decrypt_oauth_token(&encrypted_access_token).map_err(|e| {
                rusqlite::Error::InvalidColumnType(
                    2,
                    format!("復号化エラー: {}", e),
                    rusqlite::types::Type::Text,
                )
            })?;

            // リフレッシュトークンを復号化（存在する場合）
            let refresh_token = encrypted_refresh_token
                .map(|ert| decrypt_oauth_token(&ert))
                .transpose()
                .map_err(|e| {
                    rusqlite::Error::InvalidColumnType(
                        3,
                        format!("復号化エラー: {}", e),
                        rusqlite::types::Type::Text,
                    )
                })?;

            Ok(OAuthToken {
                id: row.get(0)?,
                api_id: row.get(1)?,
                access_token,
                refresh_token,
                token_type: row.get(4)?,
                expires_at: row.get(5)?,
                scope: row.get(6)?,
                client_id: row.get(7)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|e| {
                        rusqlite::Error::InvalidColumnType(
                            8,
                            format!("日時解析エラー: {}", e),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| {
                        rusqlite::Error::InvalidColumnType(
                            9,
                            format!("日時解析エラー: {}", e),
                            rusqlite::types::Type::Text,
                        )
                    })?
                    .with_timezone(&Utc),
            })
        })?;

        match rows.next() {
            Some(result) => Ok(Some(result?)),
            None => Ok(None),
        }
    }

    /// OAuthトークンを取得（アクセストークンで検索、復号化して返す）
    #[allow(dead_code)] // 将来のOAuth実装で使用予定
    pub fn find_by_access_token(
        &self,
        access_token: &str,
    ) -> Result<Option<OAuthToken>, DatabaseError> {
        // データベース内のすべてのトークンを取得して、復号化後に比較
        // 注意: パフォーマンスのため、大量のトークンがある場合は別の方法を検討
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, api_id, access_token, refresh_token, token_type, expires_at, scope, client_id, created_at, updated_at
            FROM oauth_tokens
            "#
        )?;

        let rows = stmt.query_map([], |row| {
            let encrypted_access_token: String = row.get(2)?;
            let encrypted_refresh_token: Option<String> = row.get(3)?;

            // アクセストークンを復号化
            let decrypted_access_token =
                decrypt_oauth_token(&encrypted_access_token).map_err(|e| {
                    rusqlite::Error::InvalidColumnType(
                        2,
                        format!("復号化エラー: {}", e),
                        rusqlite::types::Type::Text,
                    )
                })?;

            // リフレッシュトークンを復号化（存在する場合）
            let refresh_token = encrypted_refresh_token
                .map(|ert| decrypt_oauth_token(&ert))
                .transpose()
                .map_err(|e| {
                    rusqlite::Error::InvalidColumnType(
                        3,
                        format!("復号化エラー: {}", e),
                        rusqlite::types::Type::Text,
                    )
                })?;

            // アクセストークンをクローンして返す（所有権の問題を回避）
            // 2回使用するため、2回クローンする
            let access_token_for_return = decrypted_access_token.clone();
            let access_token_for_struct = decrypted_access_token.clone();

            Ok((
                access_token_for_return,
                OAuthToken {
                    id: row.get(0)?,
                    api_id: row.get(1)?,
                    access_token: access_token_for_struct,
                    refresh_token,
                    token_type: row.get(4)?,
                    expires_at: row.get(5)?,
                    scope: row.get(6)?,
                    client_id: row.get(7)?,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                        .map_err(|e| {
                            rusqlite::Error::InvalidColumnType(
                                8,
                                format!("日時解析エラー: {}", e),
                                rusqlite::types::Type::Text,
                            )
                        })?
                        .with_timezone(&Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                        .map_err(|e| {
                            rusqlite::Error::InvalidColumnType(
                                9,
                                format!("日時解析エラー: {}", e),
                                rusqlite::types::Type::Text,
                            )
                        })?
                        .with_timezone(&Utc),
                },
            ))
        })?;

        // 復号化したトークンと比較
        for row_result in rows {
            let (decrypted_token, token) = row_result?;
            if decrypted_token == access_token {
                return Ok(Some(token));
            }
        }

        Ok(None)
    }

    /// OAuthトークンを削除
    #[allow(dead_code)] // 将来のOAuth実装で使用予定
    pub fn delete_by_api_id(&self, api_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM oauth_tokens WHERE api_id = ?1",
            params![api_id],
        )?;
        Ok(())
    }

    /// 期限切れのOAuthトークンを削除
    #[allow(dead_code)] // 将来のOAuth実装で使用予定
    pub fn delete_expired(&self) -> Result<usize, DatabaseError> {
        let now = Utc::now().to_rfc3339();
        let rows_affected = self.conn.execute(
            "DELETE FROM oauth_tokens WHERE expires_at IS NOT NULL AND expires_at < ?1",
            params![now],
        )?;
        Ok(rows_affected)
    }
}
