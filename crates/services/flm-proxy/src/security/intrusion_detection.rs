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
        if path.contains('\'')
            || path.contains(';')
            || path.contains("--")
            || path.contains("/*")
            || path.contains("*/")
        {
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
            if ua_lower.contains("sqlmap")
                || ua_lower.contains("nikto")
                || ua_lower.contains("nmap")
                || ua_lower.contains("masscan")
            {
                score += 10;
                detected_patterns.push("suspicious_user_agent".to_string());
            }
        } else {
            // Empty User-Agent
            score += 10;
            detected_patterns.push("empty_user_agent".to_string());
        }

        // 4. Unusual HTTP methods
        if method != "GET"
            && method != "POST"
            && method != "PUT"
            && method != "DELETE"
            && method != "PATCH"
            && (method == "TRACE" || method == "OPTIONS")
        {
            score += 10;
            detected_patterns.push("unusual_method".to_string());
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

    /// Add score directly for an IP address (e.g., for honeypot access)
    ///
    /// Returns the new total score for the IP.
    pub async fn add_score(&self, ip: &IpAddr, points: u32, pattern: &str) -> u32 {
        let mut ip_scores = self.ip_scores.write().await;
        let now = Instant::now();

        let entry = ip_scores.entry(*ip).or_insert_with(|| IntrusionScore {
            score: 0,
            first_detection: now,
            last_detection: now,
            patterns: Vec::new(),
        });

        entry.score += points;
        entry.last_detection = now;
        if !entry.patterns.contains(&pattern.to_string()) {
            entry.patterns.push(pattern.to_string());
        }

        entry.score
    }
}

impl Default for IntrusionDetection {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[tokio::test]
    async fn test_intrusion_detection_new() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        assert_eq!(detection.get_score(&ip).await, 0);
    }

    #[tokio::test]
    async fn test_intrusion_detection_sql_injection() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        let score = detection
            .check_request(&ip, "/test?id=1' OR '1'='1", "GET", None)
            .await;
        assert!(score >= 20, "SQL injection should trigger score");

        let total_score = detection.get_score(&ip).await;
        assert!(total_score >= 20);
    }

    #[tokio::test]
    async fn test_intrusion_detection_path_traversal() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        let score = detection
            .check_request(&ip, "../../../etc/passwd", "GET", None)
            .await;
        assert!(score >= 20, "Path traversal should trigger score");
    }

    #[tokio::test]
    async fn test_intrusion_detection_suspicious_user_agent() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        let score = detection
            .check_request(&ip, "/test", "GET", Some("sqlmap"))
            .await;
        assert!(score >= 10, "Suspicious user agent should trigger score");
    }

    #[tokio::test]
    async fn test_intrusion_detection_empty_user_agent() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        let score = detection.check_request(&ip, "/test", "GET", None).await;
        assert!(score >= 10, "Empty user agent should trigger score");
    }

    #[tokio::test]
    async fn test_intrusion_detection_unusual_method() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        let score = detection.check_request(&ip, "/test", "TRACE", None).await;
        assert!(score >= 10, "Unusual method should trigger score");
    }

    #[tokio::test]
    async fn test_intrusion_detection_should_block() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        // Accumulate score to trigger block
        for _ in 0..5 {
            detection
                .check_request(&ip, "/test?id=1' OR '1'='1", "GET", None)
                .await;
        }

        let (should_block, duration) = detection.should_block(&ip).await;
        assert!(should_block, "Score >= 100 should trigger block");
        assert_eq!(duration, Some(3600), "Should block for 1 hour");

        // Add more to reach 200
        for _ in 0..5 {
            detection
                .check_request(&ip, "/test?id=1' OR '1'='1", "GET", None)
                .await;
        }

        let (should_block, duration) = detection.should_block(&ip).await;
        assert!(should_block, "Score >= 200 should trigger block");
        assert_eq!(duration, Some(86400), "Should block for 24 hours");
    }

    #[tokio::test]
    async fn test_intrusion_detection_reset_score() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        detection
            .check_request(&ip, "/test?id=1' OR '1'='1", "GET", None)
            .await;
        assert!(detection.get_score(&ip).await > 0);

        detection.reset_score(&ip).await;
        assert_eq!(detection.get_score(&ip).await, 0);
    }

    #[tokio::test]
    async fn test_intrusion_detection_add_score() {
        let detection = IntrusionDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        let score = detection.add_score(&ip, 50, "honeypot").await;
        assert_eq!(score, 50);

        let score = detection.add_score(&ip, 30, "honeypot").await;
        assert_eq!(score, 80);
    }

    #[tokio::test]
    async fn test_intrusion_detection_get_scored_ips() {
        let detection = IntrusionDetection::new();
        let ip1 = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        let ip2 = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 2));

        detection
            .check_request(&ip1, "/test?id=1' OR '1'='1", "GET", None)
            .await;
        detection
            .check_request(&ip2, "../../../etc/passwd", "GET", None)
            .await;

        let scored = detection.get_scored_ips().await;
        assert_eq!(scored.len(), 2);
    }
}
