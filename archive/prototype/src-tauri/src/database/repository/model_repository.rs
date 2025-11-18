// Model Repository
// モデル情報のデータアクセス層

use rusqlite::{Connection, params};
use chrono::{DateTime, Utc};
use crate::database::{DatabaseError, models::{ModelCatalogItem, InstalledModel, ModelCategory}};

/// モデルカタログリポジトリ
pub struct ModelCatalogRepository;

impl ModelCatalogRepository {
    /// 全てのモデルカタログアイテムを取得
    pub fn find_all(conn: &Connection) -> Result<Vec<ModelCatalogItem>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT name, description, size, parameters, category, recommended, author, license, tags, updated_at FROM models_catalog ORDER BY recommended DESC, name ASC"
        )?;
        
        let model_iter = stmt.query_map([], |row| {
            // tagsをJSON文字列からVec<String>に変換
            let tags_json: Option<String> = row.get(8)?;
            let tags = tags_json
                .and_then(|s| {
                    if s.is_empty() {
                        None
                    } else {
                        serde_json::from_str::<Vec<String>>(&s).ok()
                    }
                });
            
            Ok(ModelCatalogItem {
                name: row.get(0)?,
                description: row.get(1)?,
                size: row.get(2)?,
                parameter_count: row.get(3)?,
                category: ModelCategory::from(row.get::<_, Option<String>>(4)?.unwrap_or_default().as_str()),
                recommended: row.get::<_, i32>(5)? != 0,
                author: row.get(6)?,
                license: row.get(7)?,
                tags,
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {e}")))?
                    .with_timezone(&Utc),
            })
        })?;
        
        let mut models = Vec::new();
        for model in model_iter {
            models.push(model?);
        }
        
        Ok(models)
    }
    
    /// 名前でモデルカタログアイテムを取得
    pub fn find_by_name(conn: &Connection, name: &str) -> Result<Option<ModelCatalogItem>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT name, description, size, parameters, category, recommended, author, license, tags, updated_at FROM models_catalog WHERE name = ?"
        )?;
        
        let model_result = stmt.query_row(params![name], |row| {
            // tagsをJSON文字列からVec<String>に変換
            let tags_json: Option<String> = row.get(8)?;
            let tags = tags_json
                .and_then(|s| {
                    if s.is_empty() {
                        None
                    } else {
                        serde_json::from_str::<Vec<String>>(&s).ok()
                    }
                });
            
            Ok(ModelCatalogItem {
                name: row.get(0)?,
                description: row.get(1)?,
                size: row.get(2)?,
                parameter_count: row.get(3)?,
                category: ModelCategory::from(row.get::<_, Option<String>>(4)?.unwrap_or_default().as_str()),
                recommended: row.get::<_, i32>(5)? != 0,
                author: row.get(6)?,
                license: row.get(7)?,
                tags,
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {e}")))?
                    .with_timezone(&Utc),
            })
        });
        
        match model_result {
            Ok(model) => Ok(Some(model)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// モデルカタログアイテムを作成または更新
    pub fn upsert(conn: &Connection, model: &ModelCatalogItem) -> Result<(), DatabaseError> {
        let created_at = Utc::now().to_rfc3339();
        let updated_at = Utc::now().to_rfc3339();
        let category_str: String = model.category.clone().into();
        
        // tagsをJSON文字列に変換
        let tags_json = model.tags.as_ref()
            .map(|tags| serde_json::to_string(tags))
            .transpose()
            .map_err(|e| DatabaseError::Other(format!("Tags JSON serialization error: {}", e)))?
            .unwrap_or_else(|| "[]".to_string());
        
        conn.execute(
            "INSERT INTO models_catalog (name, description, size, parameters, category, recommended, author, license, tags, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                size = excluded.size,
                parameters = excluded.parameters,
                category = excluded.category,
                recommended = excluded.recommended,
                author = excluded.author,
                license = excluded.license,
                tags = excluded.tags,
                updated_at = excluded.updated_at",
            params![
                model.name,
                model.description,
                model.size,
                model.parameter_count,
                category_str,
                if model.recommended { 1 } else { 0 },
                model.author,
                model.license,
                tags_json,
                created_at,
                updated_at
            ],
        )?;
        
        Ok(())
    }
    
    /// モデルカタログアイテムを削除
    pub fn delete(conn: &Connection, name: &str) -> Result<(), DatabaseError> {
        conn.execute("DELETE FROM models_catalog WHERE name = ?", params![name])?;
        Ok(())
    }
}

/// インストール済みモデルリポジトリ
pub struct InstalledModelRepository;

impl InstalledModelRepository {
    /// 全てのインストール済みモデルを取得
    pub fn find_all(conn: &Connection) -> Result<Vec<InstalledModel>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT name, size, parameters, installed_at, last_used_at, usage_count FROM installed_models ORDER BY installed_at DESC"
        )?;
        
        let model_iter = stmt.query_map([], |row| {
            Ok(InstalledModel {
                name: row.get(0)?,
                size: row.get(1)?,
                parameters: row.get::<_, Option<i64>>(2)?, // parametersを取得
                installed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid installed_at format: {e}")))?
                    .with_timezone(&Utc),
                last_used_at: row.get::<_, Option<String>>(4)?
                    .map(|s| DateTime::parse_from_rfc3339(&s)
                        .map_err(|e| DatabaseError::Other(format!("Invalid last_used_at format: {e}")))
                        .and_then(|dt| Ok(dt.with_timezone(&Utc))))
                    .transpose()?,
                usage_count: row.get(5)?,
            })
        })?;
        
        let mut models = Vec::new();
        for model in model_iter {
            models.push(model?);
        }
        
        Ok(models)
    }
    
    /// 名前でインストール済みモデルを取得
    pub fn find_by_name(conn: &Connection, name: &str) -> Result<Option<InstalledModel>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT name, size, parameters, installed_at, last_used_at, usage_count FROM installed_models WHERE name = ?"
        )?;
        
        let model_result = stmt.query_row(params![name], |row| {
            Ok(InstalledModel {
                name: row.get(0)?,
                size: row.get(1)?,
                parameters: row.get::<_, Option<i64>>(2)?, // parametersを取得
                installed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid installed_at format: {e}")))?
                    .with_timezone(&Utc),
                last_used_at: row.get::<_, Option<String>>(4)?
                    .map(|s| DateTime::parse_from_rfc3339(&s)
                        .map_err(|e| DatabaseError::Other(format!("Invalid last_used_at format: {e}")))
                        .and_then(|dt| Ok(dt.with_timezone(&Utc))))
                    .transpose()?,
                usage_count: row.get(5)?,
            })
        });
        
        match model_result {
            Ok(model) => Ok(Some(model)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// インストール済みモデルを作成または更新
    pub fn upsert(conn: &Connection, model: &InstalledModel) -> Result<(), DatabaseError> {
        let installed_at = model.installed_at.to_rfc3339();
        let last_used_at = model.last_used_at.map(|d| d.to_rfc3339());
        
        conn.execute(
            "INSERT INTO installed_models (name, size, parameters, installed_at, last_used_at, usage_count) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
                size = excluded.size,
                parameters = excluded.parameters,
                last_used_at = excluded.last_used_at,
                usage_count = excluded.usage_count",
            params![
                model.name,
                model.size,
                model.parameters.map(|p| p as i64), // parametersを実装
                installed_at,
                last_used_at,
                model.usage_count
            ],
        )?;
        
        Ok(())
    }
    
    /// 使用回数を更新
    pub fn increment_usage(conn: &Connection, name: &str) -> Result<(), DatabaseError> {
        let last_used_at = Utc::now().to_rfc3339();
        
        conn.execute(
            "UPDATE installed_models SET last_used_at = ?, usage_count = usage_count + 1 WHERE name = ?",
            params![last_used_at, name],
        )?;
        
        Ok(())
    }
    
    /// インストール済みモデルを削除
    pub fn delete(conn: &Connection, name: &str) -> Result<(), DatabaseError> {
        conn.execute("DELETE FROM installed_models WHERE name = ?", params![name])?;
        Ok(())
    }
}


