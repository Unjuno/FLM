// Error Log Repository
// エラーログのデータアクセス層

use rusqlite::{Connection, Row, params};
use chrono::Utc;
use crate::database::DatabaseError;

/// エラーログエンティティ
#[derive(Debug, Clone)]
pub struct ErrorLog {
    pub id: String,
    pub error_category: String,
    pub error_message: String,
    pub error_stack: Option<String>,
    pub context: Option<String>,
    pub source: Option<String>,
    pub api_id: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: String,
}

impl ErrorLog {
    fn from_row(row: &Row) -> Result<Self, rusqlite::Error> {
        Ok(ErrorLog {
            id: row.get(0)?,
            error_category: row.get(1)?,
            error_message: row.get(2)?,
            error_stack: row.get(3)?,
            context: row.get(4)?,
            source: row.get(5)?,
            api_id: row.get(6)?,
            user_agent: row.get(7)?,
            created_at: row.get(8)?,
        })
    }
}

/// エラーログリポジトリ
pub struct ErrorLogRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ErrorLogRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// エラーログを作成
    pub fn create(&self, error_log: &ErrorLog) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO error_logs 
            (id, error_category, error_message, error_stack, context, source, api_id, user_agent, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                error_log.id,
                error_log.error_category,
                error_log.error_message,
                error_log.error_stack,
                error_log.context,
                error_log.source,
                error_log.api_id,
                error_log.user_agent,
                error_log.created_at,
            ],
        )?;
        Ok(())
    }

    /// エラーログを取得（IDで）
    pub fn find_by_id(&self, id: &str) -> Result<Option<ErrorLog>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, error_category, error_message, error_stack, context, source, api_id, user_agent, created_at FROM error_logs WHERE id = ?1"
        )?;
        
        let mut rows = stmt.query_map(params![id], |row| {
            ErrorLog::from_row(row)
        })?;
        
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    /// エラーログ一覧を取得（フィルタ付き）
    pub fn find_with_filters(
        &self,
        error_category: Option<&str>,
        api_id: Option<&str>,
        limit: Option<i32>,
        offset: Option<i32>,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<ErrorLog>, DatabaseError> {
        let mut query = String::from(
            "SELECT id, error_category, error_message, error_stack, context, source, api_id, user_agent, created_at FROM error_logs WHERE 1=1"
        );
        let mut params_vec: Vec<&dyn rusqlite::ToSql> = Vec::new();

        if let Some(category) = error_category {
            query.push_str(" AND error_category = ?");
            params_vec.push(category);
        }

        if let Some(api_id) = api_id {
            query.push_str(" AND api_id = ?");
            params_vec.push(api_id);
        }

        if let Some(start_date) = start_date {
            query.push_str(" AND created_at >= ?");
            params_vec.push(start_date);
        }

        if let Some(end_date) = end_date {
            query.push_str(" AND created_at <= ?");
            params_vec.push(end_date);
        }

        query.push_str(" ORDER BY created_at DESC");

        if let Some(limit) = limit {
            query.push_str(&format!(" LIMIT {}", limit));
            if let Some(offset) = offset {
                query.push_str(&format!(" OFFSET {}", offset));
            }
        }

        let mut stmt = self.conn.prepare(&query)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
            ErrorLog::from_row(row)
        })?;

        let mut error_logs = Vec::new();
        for row in rows {
            error_logs.push(row?);
        }

        Ok(error_logs)
    }

    /// エラーログの総件数を取得
    pub fn count_with_filters(
        &self,
        error_category: Option<&str>,
        api_id: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<i64, DatabaseError> {
        let mut query = String::from("SELECT COUNT(*) FROM error_logs WHERE 1=1");
        let mut params_vec: Vec<&dyn rusqlite::ToSql> = Vec::new();

        if let Some(category) = error_category {
            query.push_str(" AND error_category = ?");
            params_vec.push(category);
        }

        if let Some(api_id) = api_id {
            query.push_str(" AND api_id = ?");
            params_vec.push(api_id);
        }

        if let Some(start_date) = start_date {
            query.push_str(" AND created_at >= ?");
            params_vec.push(start_date);
        }

        if let Some(end_date) = end_date {
            query.push_str(" AND created_at <= ?");
            params_vec.push(end_date);
        }

        let mut stmt = self.conn.prepare(&query)?;
        let count: i64 = stmt.query_row(
            rusqlite::params_from_iter(params_vec.iter()),
            |row| row.get(0),
        )?;

        Ok(count)
    }

    /// 古いエラーログを削除（保持期間を超えたログ）
    pub fn delete_old_logs(&self, days_to_keep: i32) -> Result<usize, DatabaseError> {
        let cutoff_date = Utc::now()
            .checked_sub_signed(chrono::Duration::days(days_to_keep as i64))
            .ok_or_else(|| DatabaseError::Other("日付計算エラー".to_string()))?
            .to_rfc3339();

        let deleted = self.conn.execute(
            "DELETE FROM error_logs WHERE created_at < ?1",
            params![cutoff_date],
        )?;

        Ok(deleted)
    }
}

