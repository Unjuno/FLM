//! Anomaly detection system
//!
//! This module provides anomaly detection functionality to detect unusual request patterns.
//! See `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` section 2.3

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Anomaly score for an IP address
#[derive(Clone, Debug)]
pub struct AnomalyScore {
    pub score: u32,
    pub first_detection: Instant,
    pub last_detection: Instant,
    pub anomaly_types: Vec<String>,
    /// Request timestamps for rate tracking (last 60 seconds)
    request_timestamps: Vec<Instant>,
    /// Request timestamps for per-second tracking (last 1 second)
    recent_requests: Vec<Instant>,
    /// Failed endpoint access patterns (endpoint -> count)
    failed_endpoints: HashMap<String, u32>,
    /// Request patterns for duplicate detection (path+method -> count)
    request_patterns: HashMap<String, u32>,
    /// Request body sizes for distribution analysis
    body_sizes: Vec<usize>,
    /// Request durations for distribution analysis
    request_durations: Vec<Duration>,
}

/// Anomaly detection manager
///
/// Detects unusual request patterns and assigns scores to IP addresses.
/// When a score exceeds thresholds, the IP is automatically blocked.
pub struct AnomalyDetection {
    /// In-memory cache: IP -> AnomalyScore
    ip_scores: Arc<RwLock<HashMap<IpAddr, AnomalyScore>>>,
    /// Thresholds
    requests_per_second_threshold: u32,
    requests_per_minute_threshold: u32,
    max_request_body_size: usize,
    max_request_duration: Duration,
}

impl AnomalyDetection {
    /// Create a new anomaly detection system
    pub fn new() -> Self {
        Self {
            ip_scores: Arc::new(RwLock::new(HashMap::new())),
            requests_per_second_threshold: 100,
            requests_per_minute_threshold: 1000,
            max_request_body_size: 10 * 1024 * 1024, // 10MB
            max_request_duration: Duration::from_secs(60),
        }
    }

    /// Record a request and check for anomalies
    ///
    /// Returns the score increment for this request.
    pub async fn check_request(
        &self,
        ip: &IpAddr,
        path: &str,
        method: &str,
        body_size: Option<usize>,
        request_duration: Option<Duration>,
        is_404: bool,
    ) -> u32 {
        let mut score = 0u32;
        let mut detected_anomalies = Vec::new();
        let now = Instant::now();

        let mut ip_scores = self.ip_scores.write().await;
        let entry = ip_scores.entry(*ip).or_insert_with(|| AnomalyScore {
            score: 0,
            first_detection: now,
            last_detection: now,
            anomaly_types: Vec::new(),
            request_timestamps: Vec::new(),
            recent_requests: Vec::new(),
            failed_endpoints: HashMap::new(),
            request_patterns: HashMap::new(),
            body_sizes: Vec::new(),
            request_durations: Vec::new(),
        });

        // Clean old timestamps (older than 60 seconds)
        entry
            .request_timestamps
            .retain(|&ts| now.duration_since(ts) <= Duration::from_secs(60));
        entry
            .recent_requests
            .retain(|&ts| now.duration_since(ts) <= Duration::from_secs(1));

        // Clean old body sizes and durations (keep last 100 for distribution analysis)
        if entry.body_sizes.len() > 100 {
            entry.body_sizes.drain(0..entry.body_sizes.len() - 100);
        }
        if entry.request_durations.len() > 100 {
            entry
                .request_durations
                .drain(0..entry.request_durations.len() - 100);
        }

        // Score decay: reduce score over time to reduce false positives
        // Score decays by 1 point per minute since last detection
        if entry.score > 0 {
            let minutes_since_last = entry.last_detection.elapsed().as_secs() / 60;
            if minutes_since_last > 0 {
                let decay = minutes_since_last.min(entry.score as u64) as u32;
                entry.score = entry.score.saturating_sub(decay);
            }
        }

        // 1. Check for high request rate (per second)
        entry.recent_requests.push(now);
        if entry.recent_requests.len() as u32 >= self.requests_per_second_threshold {
            score += 30;
            detected_anomalies.push("high_request_rate_per_second".to_string());
        }

        // 2. Check for high request rate (per minute)
        entry.request_timestamps.push(now);
        if entry.request_timestamps.len() as u32 >= self.requests_per_minute_threshold {
            score += 30;
            detected_anomalies.push("high_request_rate_per_minute".to_string());
        }

        // 3. Check for oversized request body
        if let Some(size) = body_size {
            if size > self.max_request_body_size {
                score += 20;
                detected_anomalies.push("oversized_request_body".to_string());
            }

            // Track body size for distribution analysis
            entry.body_sizes.push(size);

            // Check for abnormal body size distribution (statistical outlier)
            if entry.body_sizes.len() >= 10 {
                let avg_size: usize =
                    entry.body_sizes.iter().sum::<usize>() / entry.body_sizes.len();
                let variance: usize = entry
                    .body_sizes
                    .iter()
                    .map(|&s| {
                        let diff = if s > avg_size {
                            s - avg_size
                        } else {
                            avg_size - s
                        };
                        diff * diff
                    })
                    .sum::<usize>()
                    / entry.body_sizes.len();
                let std_dev = (variance as f64).sqrt() as usize;

                // If current size is more than 3 standard deviations from mean, it's an outlier
                if size > avg_size + 3 * std_dev
                    || (size < avg_size && avg_size > size + 3 * std_dev)
                {
                    score += 15;
                    detected_anomalies.push("abnormal_body_size_distribution".to_string());
                }
            }
        }

        // 4. Check for long request duration
        if let Some(duration) = request_duration {
            if duration > self.max_request_duration {
                score += 15;
                detected_anomalies.push("long_request_duration".to_string());
            }

            // Track duration for distribution analysis
            entry.request_durations.push(duration);

            // Check for abnormal duration distribution (statistical outlier)
            if entry.request_durations.len() >= 10 {
                let avg_duration = entry.request_durations.iter().sum::<Duration>()
                    / entry.request_durations.len() as u32;
                let variance: u64 = entry
                    .request_durations
                    .iter()
                    .map(|&d| {
                        let diff = if d > avg_duration {
                            (d - avg_duration).as_millis() as u64
                        } else {
                            (avg_duration - d).as_millis() as u64
                        };
                        diff * diff
                    })
                    .sum::<u64>()
                    / entry.request_durations.len() as u64;
                let std_dev_ms = (variance as f64).sqrt() as u64;

                // If current duration is more than 3 standard deviations from mean, it's an outlier
                let duration_ms = duration.as_millis() as u64;
                let avg_ms = avg_duration.as_millis() as u64;
                if duration_ms > avg_ms + 3 * std_dev_ms
                    || (duration_ms < avg_ms && avg_ms > duration_ms + 3 * std_dev_ms)
                {
                    score += 10;
                    detected_anomalies.push("abnormal_duration_distribution".to_string());
                }
            }
        }

        // 5. Check for repeated 404 errors (failed endpoint access)
        if is_404 {
            let count = entry.failed_endpoints.entry(path.to_string()).or_insert(0);
            *count += 1;
            if *count >= 10 {
                score += 10;
                detected_anomalies.push("repeated_404_errors".to_string());
            }
        }

        // 6. Check for duplicate request patterns (improved detection)
        let pattern_key = format!("{method}:{path}");
        let current_count = {
            let count = entry
                .request_patterns
                .entry(pattern_key.clone())
                .or_insert(0);
            *count += 1;
            *count
        };

        // Check for excessive duplicate patterns (more sophisticated)
        // If a single pattern accounts for more than 80% of requests, it's suspicious
        // Calculate total_patterns after the entry() borrow is released
        let total_patterns: u32 = entry.request_patterns.values().sum();
        if total_patterns >= 20 {
            let pattern_ratio = (current_count as f64) / (total_patterns as f64);
            if pattern_ratio > 0.8 {
                score += 15;
                detected_anomalies.push("excessive_duplicate_pattern".to_string());
            } else if current_count >= 50 {
                score += 10;
                detected_anomalies.push("duplicate_request_pattern".to_string());
            }
        } else if current_count >= 50 {
            score += 10;
            detected_anomalies.push("duplicate_request_pattern".to_string());
        }

        // Check for rapid pattern switching (potential scanning behavior)
        if entry.request_patterns.len() > 20 && entry.request_timestamps.len() >= 20 {
            // If we see many different patterns in a short time, it might be scanning
            let unique_patterns = entry.request_patterns.len();
            let time_span = if entry.request_timestamps.len() >= 2 {
                let oldest = entry.request_timestamps.iter().min().unwrap();
                let newest = entry.request_timestamps.iter().max().unwrap();
                newest.duration_since(*oldest)
            } else {
                Duration::from_secs(0)
            };

            // If we see more than 20 unique patterns in less than 10 seconds, it's suspicious
            if unique_patterns > 20 && time_span < Duration::from_secs(10) {
                score += 20;
                detected_anomalies.push("rapid_pattern_switching".to_string());
            }
        }

        // Update score
        if score > 0 {
            entry.score += score;
            entry.last_detection = now;
            entry.anomaly_types.extend(detected_anomalies);
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
    pub async fn get_scored_ips(&self) -> Vec<(IpAddr, AnomalyScore)> {
        let ip_scores = self.ip_scores.read().await;
        ip_scores
            .iter()
            .map(|(ip, score)| (*ip, score.clone()))
            .collect()
    }
}

impl Default for AnomalyDetection {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[tokio::test]
    async fn test_anomaly_detection_oversized_body() {
        let detection = AnomalyDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        // Test oversized body
        let score = detection
            .check_request(
                &ip,
                "/test",
                "POST",
                Some(11 * 1024 * 1024), // 11MB > 10MB threshold
                None,
                false,
            )
            .await;
        assert!(score >= 20, "Oversized body should trigger anomaly");
    }

    #[tokio::test]
    async fn test_anomaly_detection_long_duration() {
        let detection = AnomalyDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        // Test long duration
        let score = detection
            .check_request(
                &ip,
                "/test",
                "GET",
                None,
                Some(Duration::from_secs(61)), // 61s > 60s threshold
                false,
            )
            .await;
        assert!(score >= 15, "Long duration should trigger anomaly");
    }

    #[tokio::test]
    async fn test_anomaly_detection_repeated_404() {
        let detection = AnomalyDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        // Test repeated 404 errors
        for _ in 0..10 {
            let _ = detection
                .check_request(&ip, "/nonexistent", "GET", None, None, true)
                .await;
        }

        let score = detection.get_score(&ip).await;
        assert!(score >= 10, "Repeated 404 errors should trigger anomaly");
    }

    #[tokio::test]
    async fn test_anomaly_detection_should_block() {
        let detection = AnomalyDetection::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        // Accumulate score to trigger block
        for _ in 0..4 {
            // Each oversized body adds 20 points, 4 * 20 = 80 (not enough)
            let _ = detection
                .check_request(&ip, "/test", "POST", Some(11 * 1024 * 1024), None, false)
                .await;
        }

        let (should_block, _) = detection.should_block(&ip).await;
        assert!(!should_block, "Score 80 should not trigger block");

        // Add more to reach 100
        let _ = detection
            .check_request(&ip, "/test", "POST", Some(11 * 1024 * 1024), None, false)
            .await;

        let (should_block, duration) = detection.should_block(&ip).await;
        assert!(should_block, "Score >= 100 should trigger 1-hour block");
        assert_eq!(duration, Some(3600), "Should block for 1 hour");
    }
}
