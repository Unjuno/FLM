//! Botnet protection security tests
//!
//! Tests for IP blocklist, intrusion detection, and resource protection functionality.
//! See `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`

use flm_proxy::security::intrusion_detection::IntrusionDetection;
use flm_proxy::security::ip_blocklist::IpBlocklist;
use flm_proxy::security::resource_protection::ResourceProtection;
use std::net::IpAddr;
use std::str::FromStr;

#[tokio::test]
async fn test_ip_blocklist_is_blocked_initially_false() {
    let blocklist = IpBlocklist::new();
    let ip = IpAddr::from_str("192.168.1.100").unwrap();

    assert!(
        !blocklist.is_blocked(&ip).await,
        "IP should not be blocked initially"
    );
}

#[tokio::test]
async fn test_ip_blocklist_record_failure_warning_only() {
    let blocklist = IpBlocklist::new();
    let ip = IpAddr::from_str("192.168.1.101").unwrap();

    // Record 1-4 failures (warning only, no block)
    for i in 1..=4 {
        let should_block = blocklist.record_failure(ip).await;
        assert!(!should_block, "Should not block after {i} failures");
        assert!(
            !blocklist.is_blocked(&ip).await,
            "IP should not be blocked after {i} failures"
        );
    }
}

#[tokio::test]
async fn test_ip_blocklist_record_failure_5_times_30min_block() {
    let blocklist = IpBlocklist::new();
    let ip = IpAddr::from_str("192.168.1.102").unwrap();

    // Record 4 failures (warning only)
    for _ in 0..4 {
        blocklist.record_failure(ip).await;
    }

    // 5th failure should trigger 30-minute block
    let should_block = blocklist.record_failure(ip).await;
    assert!(should_block, "Should block after 5 failures");
    assert!(
        blocklist.is_blocked(&ip).await,
        "IP should be blocked after 5 failures"
    );
}

#[tokio::test]
async fn test_ip_blocklist_record_failure_10_times_24h_block() {
    let blocklist = IpBlocklist::new();
    let ip = IpAddr::from_str("192.168.1.103").unwrap();

    // Record 9 failures
    for _ in 0..9 {
        blocklist.record_failure(ip).await;
    }

    // 10th failure should trigger 24-hour block
    let should_block = blocklist.record_failure(ip).await;
    assert!(should_block, "Should block after 10 failures");
    assert!(
        blocklist.is_blocked(&ip).await,
        "IP should be blocked after 10 failures"
    );
}

#[tokio::test]
async fn test_ip_blocklist_record_failure_20_times_permanent_block() {
    let blocklist = IpBlocklist::new();
    let ip = IpAddr::from_str("192.168.1.104").unwrap();

    // Record 19 failures
    for _ in 0..19 {
        blocklist.record_failure(ip).await;
    }

    // 20th failure should trigger permanent block
    let should_block = blocklist.record_failure(ip).await;
    assert!(should_block, "Should block after 20 failures");
    assert!(
        blocklist.is_blocked(&ip).await,
        "IP should be permanently blocked after 20 failures"
    );
}

#[tokio::test]
async fn test_ip_blocklist_unblock() {
    let blocklist = IpBlocklist::new();
    let ip = IpAddr::from_str("192.168.1.105").unwrap();

    // Block the IP
    for _ in 0..5 {
        blocklist.record_failure(ip).await;
    }
    assert!(blocklist.is_blocked(&ip).await, "IP should be blocked");

    // Unblock
    blocklist.unblock(&ip).await;
    assert!(!blocklist.is_blocked(&ip).await, "IP should be unblocked");
}

#[tokio::test]
async fn test_intrusion_detection_sql_injection() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.200").unwrap();

    // SQL injection pattern
    let score = detection
        .check_request(&ip, "/v1/models?id=1' OR '1'='1", "GET", None)
        .await;
    assert!(
        score >= 20,
        "SQL injection should score at least 20, got {score}"
    );
}

#[tokio::test]
async fn test_intrusion_detection_path_traversal() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.201").unwrap();

    // Path traversal pattern
    let score = detection
        .check_request(&ip, "/v1/../../etc/passwd", "GET", None)
        .await;
    assert!(
        score >= 20,
        "Path traversal should score at least 20, got {score}"
    );
}

#[tokio::test]
async fn test_intrusion_detection_suspicious_user_agent() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.202").unwrap();

    // Suspicious User-Agent
    let score = detection
        .check_request(&ip, "/v1/models", "GET", Some("sqlmap/1.0"))
        .await;
    assert!(
        score >= 10,
        "Suspicious User-Agent should score at least 10, got {score}"
    );
}

#[tokio::test]
async fn test_intrusion_detection_empty_user_agent() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.203").unwrap();

    // Empty User-Agent
    let score = detection
        .check_request(&ip, "/v1/models", "GET", None)
        .await;
    assert!(
        score >= 10,
        "Empty User-Agent should score at least 10, got {score}"
    );
}

#[tokio::test]
async fn test_intrusion_detection_unusual_method() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.204").unwrap();

    // Unusual HTTP method (TRACE)
    let score = detection
        .check_request(&ip, "/v1/models", "TRACE", Some("Mozilla/5.0"))
        .await;
    assert!(
        score >= 10,
        "Unusual method should score at least 10, got {score}"
    );
}

#[tokio::test]
async fn test_intrusion_detection_multiple_patterns() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.205").unwrap();

    // Multiple patterns: SQL injection + path traversal
    let score = detection
        .check_request(
            &ip,
            "/v1/models?id=1' OR '1'='1/../../etc/passwd",
            "GET",
            None,
        )
        .await;
    assert!(
        score >= 40,
        "Multiple patterns should score at least 40, got {score}"
    );
}

#[tokio::test]
async fn test_intrusion_detection_score_accumulation() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.206").unwrap();

    // First request with SQL injection
    let score1 = detection
        .check_request(&ip, "/v1/models?id=1'", "GET", None)
        .await;
    assert!(score1 >= 20, "First request should score at least 20");

    // Second request with path traversal
    let score2 = detection
        .check_request(&ip, "/v1/../etc/passwd", "GET", None)
        .await;
    assert!(score2 >= 20, "Second request should score at least 20");

    // Check accumulated score
    let total_score = detection.get_score(&ip).await;
    assert!(
        total_score >= 40,
        "Total score should be at least 40, got {total_score}"
    );
}

#[tokio::test]
async fn test_intrusion_detection_should_block_100_plus() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.207").unwrap();

    // Accumulate score to 100+
    for _ in 0..5 {
        detection
            .check_request(&ip, "/v1/models?id=1' OR '1'='1", "GET", None)
            .await;
    }

    let (should_block, _duration) = detection.should_block(&ip).await;
    assert!(should_block, "Should block when score >= 100");
}

#[tokio::test]
async fn test_intrusion_detection_reset_score() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.208").unwrap();

    // Accumulate some score
    detection
        .check_request(&ip, "/v1/models?id=1'", "GET", None)
        .await;
    assert!(detection.get_score(&ip).await > 0, "Score should be > 0");

    // Reset score
    detection.reset_score(&ip).await;
    assert_eq!(
        detection.get_score(&ip).await,
        0,
        "Score should be 0 after reset"
    );
}

#[tokio::test]
async fn test_intrusion_detection_normal_request_no_score() {
    let detection = IntrusionDetection::new();
    let ip = IpAddr::from_str("192.168.1.209").unwrap();

    // Normal request (no suspicious patterns)
    let score = detection
        .check_request(&ip, "/v1/models", "GET", Some("Mozilla/5.0"))
        .await;
    assert_eq!(score, 0, "Normal request should score 0, got {score}");
}

// Resource Protection Tests

#[tokio::test]
async fn test_resource_protection_initial_state() {
    let protection = ResourceProtection::new();

    // Initially, protection should not be active
    assert!(
        !protection.is_protection_active().await,
        "Protection should not be active initially"
    );

    // Initial CPU and memory usage should be 0.0
    let cpu_usage = protection.get_last_cpu_usage().await;
    let memory_usage = protection.get_last_memory_usage().await;
    assert_eq!(cpu_usage, 0.0, "Initial CPU usage should be 0.0");
    assert_eq!(memory_usage, 0.0, "Initial memory usage should be 0.0");
}

#[tokio::test]
async fn test_resource_protection_should_throttle_below_threshold() {
    // Set thresholds very high so we won't throttle
    let protection = ResourceProtection::new().with_thresholds(1.5, 1.5); // 150% threshold (impossible to exceed)

    // Should not throttle when usage is below threshold
    let should_throttle = protection.should_throttle().await;
    assert!(
        !should_throttle,
        "Should not throttle when usage is below threshold"
    );
    assert!(
        !protection.is_protection_active().await,
        "Protection should not be active when below threshold"
    );
}

#[tokio::test]
async fn test_resource_protection_cpu_usage_retrieval() {
    let protection = ResourceProtection::new();

    // Get CPU usage (should trigger actual system check)
    let cpu_usage = protection.get_last_cpu_usage().await;

    // CPU usage should be between 0.0 and 1.0
    assert!(
        (0.0..=1.0).contains(&cpu_usage),
        "CPU usage should be between 0.0 and 1.0, got {cpu_usage}"
    );
}

#[tokio::test]
async fn test_resource_protection_memory_usage_retrieval() {
    let protection = ResourceProtection::new();

    // Get memory usage (should trigger actual system check)
    let memory_usage = protection.get_last_memory_usage().await;

    // Memory usage should be between 0.0 and 1.0
    assert!(
        (0.0..=1.0).contains(&memory_usage),
        "Memory usage should be between 0.0 and 1.0, got {memory_usage}"
    );
}

#[tokio::test]
async fn test_resource_protection_caching() {
    let protection = ResourceProtection::new();

    // First call should trigger system check
    let cpu1 = protection.get_last_cpu_usage().await;
    let memory1 = protection.get_last_memory_usage().await;

    // Immediate second call should return cached value
    let cpu2 = protection.get_last_cpu_usage().await;
    let memory2 = protection.get_last_memory_usage().await;

    // Cached values should match
    assert_eq!(cpu1, cpu2, "CPU usage should be cached");
    assert_eq!(memory1, memory2, "Memory usage should be cached");
}

#[tokio::test]
async fn test_resource_protection_status_tracking() {
    let protection = ResourceProtection::new();

    // Initially inactive
    assert!(
        !protection.is_protection_active().await,
        "Protection should be inactive initially"
    );

    // Call should_throttle to update status
    let _ = protection.should_throttle().await;

    // Status should be updated (though likely still inactive if system is not overloaded)
    let _ = protection.is_protection_active().await;
}
