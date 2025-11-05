// Model Review Module
// モデルの評価・レビュー機能

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use chrono::Utc;

/// モデル評価
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelReview {
    pub id: String,
    pub model_name: String,
    pub user_id: String,
    pub rating: u8, // 1-5の評価
    pub review_text: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// モデル評価統計
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelReviewStats {
    pub model_name: String,
    pub average_rating: f64,
    pub total_reviews: u32,
    pub rating_distribution: Vec<u32>, // [5点, 4点, 3点, 2点, 1点]の数
}

/// モデル評価を追加
pub async fn add_model_review(
    model_name: String,
    user_id: String,
    rating: u8,
    review_text: Option<String>,
    tags: Vec<String>,
) -> Result<ModelReview, AppError> {
    // 評価の範囲チェック
    if rating < 1 || rating > 5 {
        return Err(AppError::ApiError {
            message: "評価は1-5の範囲で指定してください".to_string(),
            code: "INVALID_RATING".to_string(),
        });
    }
    
    use crate::database::connection::get_connection;
    use rusqlite::params;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    let review_id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&tags).map_err(|e| AppError::ApiError {
        message: format!("タグのJSON変換エラー: {}", e),
        code: "JSON_ERROR".to_string(),
    })?;
    
    conn.execute(
        r#"
        INSERT INTO model_reviews (id, model_name, user_id, rating, review_text, tags, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        params![review_id, model_name, user_id, rating, review_text, tags_json, now, now],
    ).map_err(|e| AppError::DatabaseError {
        message: format!("モデルレビュー追加エラー: {}", e),
    })?;
    
    Ok(ModelReview {
        id: review_id,
        model_name,
        user_id,
        rating,
        review_text,
        tags,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// モデルの評価一覧を取得
pub async fn get_model_reviews(
    model_name: &str,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<ModelReview>, AppError> {
    use crate::database::connection::get_connection;
    use rusqlite::params;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    
    let mut stmt = conn.prepare(
        r#"
        SELECT id, model_name, user_id, rating, review_text, tags, created_at, updated_at
        FROM model_reviews
        WHERE model_name = ?1
        ORDER BY created_at DESC
        LIMIT ?2 OFFSET ?3
        "#
    ).map_err(|e| AppError::DatabaseError {
        message: format!("SQL準備エラー: {}", e),
    })?;
    
    let review_iter = stmt.query_map(
        params![model_name, limit, offset],
        |row| {
            let tags_json: String = row.get(5)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            
            Ok(ModelReview {
                id: row.get(0)?,
                model_name: row.get(1)?,
                user_id: row.get(2)?,
                rating: row.get(3)?,
                review_text: row.get(4)?,
                tags,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    ).map_err(|e| AppError::DatabaseError {
        message: format!("モデルレビュー取得エラー: {}", e),
    })?;
    
    let mut reviews = Vec::new();
    for review in review_iter {
        reviews.push(review?);
    }
    
    Ok(reviews)
}

/// モデルの評価統計を取得
pub async fn get_model_review_stats(
    model_name: &str,
) -> Result<ModelReviewStats, AppError> {
    use crate::database::connection::get_connection;
    use rusqlite::params;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    // 総レビュー数と平均評価を取得
    let mut stmt = conn.prepare(
        r#"
        SELECT 
            COUNT(*) as total,
            AVG(rating) as avg_rating,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1
        FROM model_reviews
        WHERE model_name = ?1
        "#
    ).map_err(|e| AppError::DatabaseError {
        message: format!("SQL準備エラー: {}", e),
    })?;
    
    let stats: Result<(i32, Option<f64>, i32, i32, i32, i32, i32), _> = stmt.query_row(
        params![model_name],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        },
    );
    
    match stats {
        Ok((total, avg_rating, r5, r4, r3, r2, r1)) => {
            Ok(ModelReviewStats {
                model_name: model_name.to_string(),
                average_rating: avg_rating.unwrap_or(0.0),
                total_reviews: total as u32,
                rating_distribution: vec![r5 as u32, r4 as u32, r3 as u32, r2 as u32, r1 as u32],
            })
        },
        Err(_) => {
            // レビューがない場合はデフォルト値を返す
            Ok(ModelReviewStats {
                model_name: model_name.to_string(),
                average_rating: 0.0,
                total_reviews: 0,
                rating_distribution: vec![0, 0, 0, 0, 0],
            })
        },
    }
}

/// 評価を更新
pub async fn update_model_review(
    review_id: &str,
    rating: Option<u8>,
    review_text: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<ModelReview, AppError> {
    // 評価の範囲チェック
    if let Some(r) = rating {
        if r < 1 || r > 5 {
            return Err(AppError::ApiError {
                message: "評価は1-5の範囲で指定してください".to_string(),
                code: "INVALID_RATING".to_string(),
            });
        }
    }
    
    use crate::database::connection::get_connection;
    use rusqlite::params;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    // 既存のレビューを取得
    let mut stmt = conn.prepare(
        r#"
        SELECT model_name, user_id, rating, review_text, tags, created_at
        FROM model_reviews
        WHERE id = ?1
        "#
    ).map_err(|e| AppError::DatabaseError {
        message: format!("SQL準備エラー: {}", e),
    })?;
    
    let existing: Result<(String, String, u8, Option<String>, String, String), _> = stmt.query_row(
        params![review_id],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        },
    );
    
    let (model_name, user_id, current_rating, current_text, current_tags_json, created_at) = existing
        .map_err(|_| AppError::ApiError {
            message: "レビューが見つかりません".to_string(),
            code: "REVIEW_NOT_FOUND".to_string(),
        })?;
    
    let current_tags: Vec<String> = serde_json::from_str(&current_tags_json).unwrap_or_default();
    
    // 更新する値を決定
    let new_rating = rating.unwrap_or(current_rating);
    let new_text = review_text.or(current_text);
    let new_tags = tags.unwrap_or(current_tags);
    let new_tags_json = serde_json::to_string(&new_tags).map_err(|e| AppError::ApiError {
        message: format!("タグのJSON変換エラー: {}", e),
        code: "JSON_ERROR".to_string(),
    })?;
    let updated_at = Utc::now().to_rfc3339();
    
    // データベースを更新
    conn.execute(
        r#"
        UPDATE model_reviews
        SET rating = ?1, review_text = ?2, tags = ?3, updated_at = ?4
        WHERE id = ?5
        "#,
        params![new_rating, new_text, new_tags_json, updated_at, review_id],
    ).map_err(|e| AppError::DatabaseError {
        message: format!("モデルレビュー更新エラー: {}", e),
    })?;
    
    Ok(ModelReview {
        id: review_id.to_string(),
        model_name,
        user_id,
        rating: new_rating,
        review_text: new_text,
        tags: new_tags,
        created_at,
        updated_at,
    })
}

/// 評価を削除
pub async fn delete_model_review(review_id: &str) -> Result<(), AppError> {
    use crate::database::connection::get_connection;
    use rusqlite::params;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    let rows_affected = conn.execute(
        "DELETE FROM model_reviews WHERE id = ?1",
        params![review_id],
    ).map_err(|e| AppError::DatabaseError {
        message: format!("モデルレビュー削除エラー: {}", e),
    })?;
    
    if rows_affected == 0 {
        return Err(AppError::ApiError {
            message: "レビューが見つかりません".to_string(),
            code: "REVIEW_NOT_FOUND".to_string(),
        });
    }
    
    Ok(())
}

