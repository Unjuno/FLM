//! Intrusion detection system
//!
//! This module provides intrusion detection functionality to detect suspicious access patterns.
//! See `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` section 2.2

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

/// Intrusion score for an IP address
#[derive(Clone, Debug)]
pub struct IntrusionScore {
    pub score: u32,
    pub first_detection: Instant,
    pub last_detection: Instant,
    pub patterns: Vec<String>,
}

/// Intrusion detection manager
///
/// Detects suspicious access patterns and assigns scores to IP addresses.
/// When a score exceeds thresholds, the IP is automatically blocked.
pub struct IntrusionDetection {
    /// In-memory cache: IP -> IntrusionScore
    ip_scores: Arc<RwLock<HashMap<IpAddr, IntrusionScore>>>,
}

impl IntrusionDetection {
    /// Create a new intrusion detection system
    pub fn new() -> Self {
        Self {
            ip_scores: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check a request for intrusion patterns
    ///
    /// Returns the score increment for this request.
    pub async fn check_request(
        &self,
        ip: &IpAddr,
        path: &str,
        method: &str,
        user_agent: Option<&str>,
    ) -> u32 {
        let mut score = 0u32;
        let mut detected_patterns = Vec::new();

        // 1. SQL injection attempt
        if path.contains('\'') || path.contains(';') || path.contains("--") || path.contains("/*") || path.contains("*/") {
            score += 20;
            detected_patterns.push("sql_injection".to_string());
        }

        // 2. Path traversal attempt
        if path.contains("../") || path.contains("..\\") || path.contains("%2e%2e%2f") {
            score += 20;
            detected_patterns.push("path_traversal".to_string());
        }

        // 3. Suspicious User-Agent
        if let Some(ua) = user_agent {
            let ua_lower = ua.to_lowercase();
            if ua_lower.contains("sqlmap") || ua_lower.contains("nikto") || 
               ua_lower.contains("nmap") || ua_lower.contains("masscan") {
                score += 10;
                detected_patterns.push("suspicious_user_agent".to_string());
            }
        } else {
            // Empty User-Agent
            score += 10;
            detected_patterns.push("empty_user_agent".to_string());
        }

        // 4. Unusual HTTP methods
        if method != "GET" && method != "POST" && method != "PUT" && method != "DELETE" && method != "PATCH" {
            if method == "TRACE" || method == "OPTIONS" {
                score += 10;
                detected_patterns.push("unusual_method".to_string());
            }
        }

        // Update score for this IP
        if score > 0 {
            let mut ip_scores = self.ip_scores.write().await;
            let now = Instant::now();
            
            let entry = ip_scores.entry(*ip).or_insert_with(|| IntrusionScore {
                score: 0,
                first_detection: now,
                last_detection: now,
                patterns: Vec::new(),
            });
            
            entry.score += score;
            entry.last_detection = now;
            entry.patterns.extend(detected_patterns);
        }

        score
    }

    /// Get current score for an IP address
    pub async fn get_score(&self, ip: &IpAddr) -> u32 {
        let ip_scores = self.ip_scores.read().await;
        ip_scores.get(ip).map(|s| s.score).unwrap_or(0)
    }

    /// Check if an IP should be blocked based on score
    ///
    /// Returns (should_block, block_duration_seconds)
    pub async fn should_block(&self, ip: &IpAddr) -> (bool, Option<u64>) {
        let ip_scores = self.ip_scores.read().await;
        
        if let Some(score_entry) = ip_scores.get(ip) {
            let score = score_entry.score;
            
            if score >= 200 {
                // 24-hour block
                (true, Some(86400))
            } else if score >= 100 {
                // 1-hour block
                (true, Some(3600))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        }
    }

    /// Reset score for an IP address
    pub async fn reset_score(&self, ip: &IpAddr) {
        let mut ip_scores = self.ip_scores.write().await;
        ip_scores.remove(ip);
    }

    /// Get all IPs with scores
    pub async fn get_scored_ips(&self) -> Vec<(IpAddr, IntrusionScore)> {
        let ip_scores = self.ip_scores.read().await;
        ip_scores
            .iter()
            .map(|(ip, score)| (*ip, score.clone()))
            .collect()
    }
}

impl Default for IntrusionDetection {
    fn default() -> Self {
        Self::new()
    }
}

