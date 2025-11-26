//! Axum middleware for authentication and policy enforcement

use crate::adapters::{AuditLogMetadata, IntrusionRequestContext};
use crate::security::{AnomalyDetection, IntrusionDetection, IpBlocklist, ResourceProtection};
use crate::utils;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use flm_core::domain::proxy::ProxyEgressConfig;
use flm_core::services::SecurityService;
use ipnet::IpNet;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time::timeout;
use tracing::{error, warn};

/// Rate limit tracking for an API key
#[derive(Clone, Copy)]
pub struct RateLimitStateEntry {
    pub minute_count: u32,
    pub minute_reset: Instant,
    pub tokens_available: f64,
    pub last_refill: Instant,
}

impl RateLimitStateEntry {
    fn new(now: Instant, burst_capacity: u32) -> Self {
        let window_duration = Duration::from_secs(60);
        Self {
            minute_count: 0,
            minute_reset: now + window_duration,
            tokens_available: burst_capacity as f64,
            last_refill: now,
        }
    }
}

/// Application state for the proxy server
#[derive(Clone)]
pub struct AppState {
    pub security_service: Arc<SecurityService<crate::adapters::SqliteSecurityRepository>>,
    pub security_repo: Arc<crate::adapters::SqliteSecurityRepository>,
    pub engine_service: Arc<flm_core::services::EngineService>,
    pub engine_repo: Arc<dyn flm_core::ports::EngineRepository + Send + Sync>,
    /// Rate limit state: API key ID -> token bucket + RPM counters
    pub rate_limit_state: Arc<RwLock<std::collections::HashMap<String, RateLimitStateEntry>>>,
    /// IP-based rate limit state: IP address -> (request count, reset time)
    pub ip_rate_limit_state: Arc<RwLock<std::collections::HashMap<IpAddr, (u32, Instant)>>>,
    /// Trusted proxy IP addresses (for X-Forwarded-For header validation)
    pub trusted_proxy_ips: Vec<String>,
    /// IP blocklist for botnet protection
    pub ip_blocklist: Arc<IpBlocklist>,
    /// Intrusion detection system
    pub intrusion_detection: Arc<IntrusionDetection>,
    /// Anomaly detection system
    pub anomaly_detection: Arc<AnomalyDetection>,
    /// Resource protection system
    pub resource_protection: Arc<ResourceProtection>,
    /// Effective egress configuration (for telemetry/logging)
    pub egress: ProxyEgressConfig,
}

/// Policy middleware
///
/// This middleware applies SecurityPolicy rules:
/// 1. IP whitelist check
/// 2. CORS headers
/// 3. Rate limiting
///
/// Note: This should run after authentication middleware to have access to the API key.
pub async fn policy_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    // Get client IP from request
    let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);

    // Get security policy
    let policy = match state.security_service.get_policy("default").await {
        Ok(Some(policy)) => policy,
        Ok(None) => {
            // No policy configured - fail closed for security
            // Log warning and deny access
            warn!(
                error_type = "no_policy",
                "No security policy configured. Denying access for security."
            );
            return create_forbidden_response("No security policy configured. Access denied.")
                .into_response();
        }
        Err(_) => {
            // Error fetching policy - fail closed for security
            // Log error and deny access (don't expose error details)
            error!(
                error_type = "policy_fetch_error",
                "Failed to fetch security policy. Denying access for security."
            );
            return create_forbidden_response("Security policy error. Access denied.")
                .into_response();
        }
    };

    // Parse policy JSON
    let policy_json: serde_json::Value = match serde_json::from_str(&policy.policy_json) {
        Ok(json) => json,
        Err(_) => {
            // Invalid policy JSON - fail closed for security
            // Don't expose parsing error details
            error!(
                error_type = "invalid_policy_json",
                "Invalid security policy JSON. Denying access for security."
            );
            return create_forbidden_response("Invalid security policy. Access denied.")
                .into_response();
        }
    };

    // 1. Check IP whitelist
    if let Some(ip_whitelist) = policy_json.get("ip_whitelist") {
        if let Some(ip_list) = ip_whitelist.as_array() {
            if !ip_list.is_empty() {
                let allowed = ip_list.iter().any(|ip_entry| {
                    if let Some(ip_str) = ip_entry.as_str() {
                        check_ip_allowed(&client_ip, ip_str)
                    } else {
                        false
                    }
                });

                if !allowed {
                    return create_forbidden_response("IP address not in whitelist")
                        .into_response();
                }
            }
        }
    }

    // 2. Extract CORS headers from policy
    let cors_headers = extract_cors_headers(&policy_json);

    // 3. Check IP-based rate limit (1000 req/min default)
    // This is in addition to API key-based rate limiting
    {
        let ip_rate_limit_rpm = 1000u32; // Default: 1000 requests per minute
        let ip_rate_limit_burst = 1000u32;
        let (allowed, _, _) = check_ip_rate_limit_with_info(
            &state,
            &client_ip,
            ip_rate_limit_rpm,
            ip_rate_limit_burst,
        )
        .await;
        if !allowed {
            return create_rate_limit_response().into_response();
        }
    }

    // 4. Check API key-based rate limit
    // Get API key ID from request extensions (set by auth_middleware)
    // Note: auth_middleware runs before policy_middleware, so the API key ID
    // should be available in request extensions if authentication succeeded.
    let rate_limit_info = if let Some(api_key_id) = request.extensions().get::<String>() {
        if let Some(rate_limit) = policy_json.get("rate_limit") {
            if let Some(rpm) = rate_limit.get("rpm").and_then(|v| v.as_u64()) {
                if rpm > 0 {
                    let burst = rate_limit
                        .get("burst")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(rpm);

                    let (allowed, remaining, reset_time) =
                        check_rate_limit_with_info(&state, api_key_id, rpm as u32, burst as u32)
                            .await;

                    if !allowed {
                        return create_rate_limit_response().into_response();
                    }

                    Some((remaining, reset_time))
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        // No API key ID in extensions - this means auth_middleware didn't set it
        // This can happen if the endpoint doesn't require auth (like /health)
        // or if auth failed. In either case, skip rate limiting.
        None
    };

    // All checks passed, continue with request
    let mut response = next.run(request).await;

    // Add CORS headers to response
    let headers = response.headers_mut();
    for (key, value) in cors_headers {
        headers.insert(key, value);
    }

    // Add rate limit headers if rate limiting is active
    if let Some((remaining, reset_time)) = rate_limit_info {
        if let Some(rate_limit) = policy_json.get("rate_limit") {
            if let Some(rpm) = rate_limit.get("rpm").and_then(|v| v.as_u64()) {
                let burst = rate_limit
                    .get("burst")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(rpm);

                // X-RateLimit-Limit
                if let Ok(limit_value) = axum::http::HeaderValue::from_str(&burst.to_string()) {
                    headers.insert(
                        axum::http::HeaderName::from_static("x-ratelimit-limit"),
                        limit_value,
                    );
                }

                // X-RateLimit-Remaining
                if let Ok(remaining_value) =
                    axum::http::HeaderValue::from_str(&remaining.to_string())
                {
                    headers.insert(
                        axum::http::HeaderName::from_static("x-ratelimit-remaining"),
                        remaining_value,
                    );
                }

                // X-RateLimit-Reset (Unix timestamp)
                let reset_timestamp = match reset_time.duration_since(std::time::UNIX_EPOCH) {
                    Ok(duration) => duration.as_secs(),
                    Err(_) => {
                        warn!(
                            error_type = "reset_timestamp_calc_failed",
                            "Failed to calculate reset timestamp. Using current time."
                        );
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs()
                    }
                };
                if let Ok(reset_value) =
                    axum::http::HeaderValue::from_str(&reset_timestamp.to_string())
                {
                    headers.insert(
                        axum::http::HeaderName::from_static("x-ratelimit-reset"),
                        reset_value,
                    );
                }
            }
        }
    }

    response
}

/// Intrusion detection middleware
///
/// This middleware checks requests for suspicious patterns and assigns scores.
/// Should run before IP block check.
pub async fn intrusion_detection_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    // Skip intrusion detection for /health endpoint
    if request.uri().path() == "/health" {
        return next.run(request).await;
    }

    // Extract client IP
    let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);
    let path = request.uri().path().to_string();
    let method = request.method().to_string();
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok());

    // Check for intrusion patterns
    let score = state
        .intrusion_detection
        .check_request(&client_ip, &path, &method, user_agent)
        .await;

    // If score > 0, log the intrusion attempt
    if score > 0 {
        let security_repo = Arc::clone(&state.security_repo);
        let intrusion_detection = Arc::clone(&state.intrusion_detection);
        let ip_blocklist = Arc::clone(&state.ip_blocklist);
        let client_ip_for_db = client_ip;
        let client_ip_str = client_ip_for_db.to_string();
        let path_clone = path.clone();
        let method_clone = method.clone();
        let user_agent_clone = user_agent.map(|s| s.to_string());

        tokio::spawn(async move {
            let current_score = intrusion_detection.get_score(&client_ip_for_db).await;
            let id = format!(
                "{}-{}",
                chrono::Utc::now().timestamp_millis(),
                rand::random::<u64>()
            );

            // Save to database
            let _ = security_repo
                .save_intrusion_attempt(
                    &id,
                    &client_ip_for_db,
                    "multiple_patterns",
                    current_score,
                    IntrusionRequestContext {
                        request_path: Some(&path_clone),
                        user_agent: user_agent_clone.as_deref(),
                        method: Some(&method_clone),
                    },
                )
                .await;

            // Check if should block
            let (should_block, block_duration) =
                intrusion_detection.should_block(&client_ip_for_db).await;
            if should_block {
                // Add to IP blocklist by recording failures
                // Score 100-199 -> 1 hour block (equivalent to ~10 failures)
                // Score 200+ -> 24 hour block (equivalent to ~20 failures)
                let failures_to_record = if current_score >= 200 {
                    20 // Permanent block threshold
                } else if current_score >= 100 {
                    10 // 24-hour block threshold
                } else {
                    0 // Don't block yet
                };

                for _ in 0..failures_to_record {
                    let _ = ip_blocklist.record_failure(client_ip_for_db).await;
                }

                // Log the intrusion event
                let request_id = format!("{id}-intrusion");
                let detail_json = serde_json::json!({
                    "score": current_score,
                    "block_duration_seconds": block_duration,
                    "failures_recorded": failures_to_record
                })
                .to_string();
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &path_clone,
                        403,
                        None,
                        Some("intrusion"),
                        AuditLogMetadata {
                            severity: "high",
                            ip: Some(&client_ip_str),
                            details: Some(detail_json.as_str()),
                        },
                    )
                    .await;
            }
        });
    }

    next.run(request).await
}

/// Anomaly detection middleware
///
/// This middleware checks requests for unusual patterns and assigns scores.
/// Should run after intrusion detection and before IP block check.
pub async fn anomaly_detection_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    // Skip anomaly detection for /health endpoint
    if request.uri().path() == "/health" {
        return next.run(request).await;
    }

    // Extract client IP
    let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);
    let path = request.uri().path().to_string();
    let method = request.method().to_string();

    // Get request body size (if available)
    let body_size = request
        .headers()
        .get("content-length")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse::<usize>().ok());

    // Record request start time
    let request_start = Instant::now();

    // Process request
    let response = next.run(request).await;

    // Calculate request duration
    let request_duration = request_start.elapsed();

    // Check if response is 404
    let is_404 = response.status() == StatusCode::NOT_FOUND;

    // Check for anomalies
    let score = state
        .anomaly_detection
        .check_request(
            &client_ip,
            &path,
            &method,
            body_size,
            Some(request_duration),
            is_404,
        )
        .await;

    // If score > 0, log the anomaly and check if should block
    if score > 0 {
        let security_repo = Arc::clone(&state.security_repo);
        let anomaly_detection = Arc::clone(&state.anomaly_detection);
        let ip_blocklist = Arc::clone(&state.ip_blocklist);
        let client_ip_for_db = client_ip;
        let client_ip_str = client_ip_for_db.to_string();
        let path_clone = path.clone();
        let method_clone = method.clone();

        tokio::spawn(async move {
            let current_score = anomaly_detection.get_score(&client_ip_for_db).await;
            let id = format!(
                "{}-{}",
                chrono::Utc::now().timestamp_millis(),
                rand::random::<u64>()
            );

            // Save to database (if we have an anomaly_detections table)
            // For now, we'll log it as an audit log entry
            let detail_json = serde_json::json!({
                "anomaly_score": current_score,
                "path": path_clone,
                "method": method_clone,
                "body_size": body_size,
                "request_duration_ms": request_duration.as_millis(),
                "is_404": is_404
            })
            .to_string();
            let _ = security_repo
                .save_audit_log(
                    &id,
                    None,
                    &path_clone,
                    200, // Status code doesn't matter for anomaly detection
                    None,
                    Some("anomaly"),
                    AuditLogMetadata {
                        severity: "medium",
                        ip: Some(&client_ip_str),
                        details: Some(detail_json.as_str()),
                    },
                )
                .await;

            // Check if should block
            let (should_block, block_duration) =
                anomaly_detection.should_block(&client_ip_for_db).await;
            if should_block {
                // Add to IP blocklist by recording failures
                // Score 100-199 -> 1 hour block (equivalent to ~10 failures)
                // Score 200+ -> 24 hour block (equivalent to ~20 failures)
                let failures_to_record = if current_score >= 200 {
                    20 // Permanent block threshold
                } else if current_score >= 100 {
                    10 // 24-hour block threshold
                } else {
                    0 // Don't block yet
                };

                for _ in 0..failures_to_record {
                    let _ = ip_blocklist.record_failure(client_ip_for_db).await;
                }

                // Log the block event
                let request_id = format!("{id}-anomaly-block");
                let detail_json = serde_json::json!({
                    "score": current_score,
                    "block_duration_seconds": block_duration,
                    "failures_recorded": failures_to_record
                })
                .to_string();
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &path_clone,
                        403,
                        None,
                        Some("anomaly_block"),
                        AuditLogMetadata {
                            severity: "high",
                            ip: Some(&client_ip_str),
                            details: Some(detail_json.as_str()),
                        },
                    )
                    .await;
            }
        });
    }

    response
}

/// Resource protection middleware
///
/// This middleware checks resource usage (CPU/memory) and throttles new connections if thresholds are exceeded.
/// Should run before IP block check.
pub async fn resource_protection_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    // Skip resource protection for /health endpoint
    if request.uri().path() == "/health" {
        return next.run(request).await;
    }

    // Check if resource protection is active
    if state.resource_protection.should_throttle().await {
        let security_repo = Arc::clone(&state.security_repo);
        let resource_protection = Arc::clone(&state.resource_protection);
        let endpoint = request.uri().path().to_string();
        let request_id = format!(
            "{}-{}",
            chrono::Utc::now().timestamp_millis(),
            rand::random::<u64>()
        );

        // Log resource alert
        tokio::spawn(async move {
            let cpu_usage = resource_protection.get_last_cpu_usage().await;
            let memory_usage = resource_protection.get_last_memory_usage().await;
            let detail_json = serde_json::json!({
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "cpu_threshold": 0.9,
                "memory_threshold": 0.9
            })
            .to_string();
            let _ = security_repo
                .save_audit_log(
                    &request_id,
                    None,
                    &endpoint,
                    503, // Service Unavailable
                    None,
                    Some("resource_alert"),
                    AuditLogMetadata {
                        severity: "high",
                        ip: None,
                        details: Some(detail_json.as_str()),
                    },
                )
                .await;
        });

        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "error": {
                    "message": "Service temporarily unavailable due to high resource usage",
                    "type": "resource_throttle",
                    "code": "resource_throttle"
                }
            })),
        )
            .into_response();
    }

    next.run(request).await
}

/// IP block check middleware
///
/// This middleware checks if the client IP is blocked before processing the request.
/// Should run before authentication middleware.
pub async fn ip_block_check_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    // Skip block check for /health endpoint
    if request.uri().path() == "/health" {
        return next.run(request).await;
    }

    // Extract client IP
    let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);

    // Check if IP is blocked
    if state.ip_blocklist.is_blocked(&client_ip).await {
        let client_ip_str = client_ip.to_string();
        let security_repo = Arc::clone(&state.security_repo);
        let request_id = format!(
            "{}-{}",
            chrono::Utc::now().timestamp_millis(),
            rand::random::<u64>()
        );
        let endpoint = request.uri().path().to_string();

        // Log blocked request
        tokio::spawn(async move {
            let detail_json = serde_json::json!({
                "reason": "ip_blocked"
            })
            .to_string();
            let _ = security_repo
                .save_audit_log(
                    &request_id,
                    None,
                    &endpoint,
                    403,
                    None,
                    Some("ip_blocked"),
                    AuditLogMetadata {
                        severity: "high",
                        ip: Some(&client_ip_str),
                        details: Some(detail_json.as_str()),
                    },
                )
                .await;
        });

        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": {
                    "message": "IP address is blocked",
                    "type": "ip_blocked",
                    "code": "ip_blocked"
                }
            })),
        )
            .into_response();
    }

    next.run(request).await
}

/// Authentication middleware
///
/// This middleware extracts the Bearer token from the Authorization header
/// and verifies it using SecurityService.
/// Note: `/health` endpoint is exempt from authentication.
pub async fn auth_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Response {
    // Skip authentication for /health endpoint and honeypot endpoints
    let path = request.uri().path();
    if path == "/health" {
        return next.run(request).await;
    }

    if matches!(
        path,
        "/admin" | "/api/v1/users" | "/wp-admin" | "/phpmyadmin"
    ) {
        return create_not_found_response().into_response();
    }

    // Extract Authorization header
    let auth_header = match headers.get("authorization").and_then(|h| h.to_str().ok()) {
        Some(h) => h,
        None => {
            // No authorization header - record failure
            let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);
            let ip_blocklist: Arc<IpBlocklist> = Arc::clone(&state.ip_blocklist);
            let security_repo = Arc::clone(&state.security_repo);
            let client_ip_str = client_ip.to_string();
            let request_id = format!(
                "{}-{}",
                chrono::Utc::now().timestamp_millis(),
                rand::random::<u64>()
            );
            let endpoint = request.uri().path().to_string();

            // Record failure and check if should block
            let should_block = ip_blocklist.record_failure(client_ip).await;

            // Log security event
            tokio::spawn(async move {
                let detail_json = serde_json::json!({
                    "reason": "missing_authorization_header"
                })
                .to_string();
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &endpoint,
                        401,
                        None,
                        Some("auth_failure"),
                        AuditLogMetadata {
                            severity: "medium",
                            ip: Some(&client_ip_str),
                            details: Some(detail_json.as_str()),
                        },
                    )
                    .await;

                // Sync to database if needed
                if should_block {
                    // Sync will be handled by background task
                }
            });

            return create_unauthorized_response().into_response();
        }
    };

    // Check if it's a Bearer token
    if !auth_header.starts_with("Bearer ") {
        // Invalid authorization format - record failure
        let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);
        let ip_blocklist: Arc<IpBlocklist> = Arc::clone(&state.ip_blocklist);
        let security_repo = Arc::clone(&state.security_repo);
        let client_ip_str = client_ip.to_string();
        let request_id = format!(
            "{}-{}",
            chrono::Utc::now().timestamp_millis(),
            rand::random::<u64>()
        );
        let endpoint = request.uri().path().to_string();

        // Record failure
        let _ = ip_blocklist.record_failure(client_ip).await;

        // Log security event
        tokio::spawn(async move {
            let detail_json = serde_json::json!({
                "reason": "invalid_authorization_format"
            })
            .to_string();
            let _ = security_repo
                .save_audit_log(
                    &request_id,
                    None,
                    &endpoint,
                    401,
                    None,
                    Some("auth_failure"),
                    AuditLogMetadata {
                        severity: "medium",
                        ip: Some(&client_ip_str),
                        details: Some(detail_json.as_str()),
                    },
                )
                .await;
        });

        return create_unauthorized_response().into_response();
    }

    // Extract the token
    let token = match auth_header.strip_prefix("Bearer ") {
        Some(t) => t,
        None => {
            return create_unauthorized_response().into_response();
        }
    };

    // Extract client IP for audit logging and blocklist
    let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);
    let client_ip_str = client_ip.to_string();
    let ip_blocklist: Arc<IpBlocklist> = Arc::clone(&state.ip_blocklist);

    // Verify the API key
    match state.security_service.verify_api_key(token).await {
        Ok(Some(record)) => {
            // API key is valid, continue to next middleware/handler
            // Store API key ID in request extensions for rate limiting
            request.extensions_mut().insert(record.id.clone());
            next.run(request).await
        }
        Ok(None) => {
            // API key is invalid or revoked - record failure and log security event
            let security_repo = Arc::clone(&state.security_repo);
            let request_id = format!(
                "{}-{}",
                chrono::Utc::now().timestamp_millis(),
                rand::random::<u64>()
            );
            let endpoint = request.uri().path().to_string();
            let ip_blocklist_for_sync: Arc<IpBlocklist> = Arc::clone(&ip_blocklist);
            let security_repo_for_sync = security_repo.clone();

            // Record failure and check if should block
            let should_block = ip_blocklist.record_failure(client_ip).await;

            // Log security event
            tokio::spawn(async move {
                let detail_json = serde_json::json!({
                    "reason": "invalid_or_revoked_api_key"
                })
                .to_string();
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &endpoint,
                        401,
                        None,
                        Some("auth_failure"),
                        AuditLogMetadata {
                            severity: "medium",
                            ip: Some(&client_ip_str),
                            details: Some(detail_json.as_str()),
                        },
                    )
                    .await;

                // Sync to database if block was applied
                if should_block {
                    if let Err(e) = ip_blocklist_for_sync
                        .sync_to_db(&security_repo_for_sync)
                        .await
                    {
                        error!(error = %e, "Failed to sync IP blocklist to database");
                    }
                }
            });

            create_unauthorized_response().into_response()
        }
        Err(_) => {
            // Error during verification - log security event (don't record failure for errors)
            let security_repo = Arc::clone(&state.security_repo);
            let request_id = format!(
                "{}-{}",
                chrono::Utc::now().timestamp_millis(),
                rand::random::<u64>()
            );
            let endpoint = request.uri().path().to_string();
            tokio::spawn(async move {
                let detail_json = serde_json::json!({
                    "reason": "verification_error"
                })
                .to_string();
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &endpoint,
                        500,
                        None,
                        Some("auth_failure"),
                        AuditLogMetadata {
                            severity: "high",
                            ip: Some(&client_ip_str),
                            details: Some(detail_json.as_str()),
                        },
                    )
                    .await;
            });
            create_internal_error_response().into_response()
        }
    }
}

/// Extract client IP from request
///
/// Security: Only trusts X-Forwarded-For and X-Real-IP headers if the request
/// comes from a trusted proxy IP. Otherwise, uses the direct connection IP.
pub fn extract_client_ip(
    request: &Request,
    headers: &HeaderMap,
    trusted_proxy_ips: &[String],
) -> IpAddr {
    // Get the direct connection IP (the IP that connected to us)
    let direct_ip = request
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|addr| addr.ip())
        .unwrap_or_else(|| {
            // Fallback to localhost if connection info is not available
            // This should never fail, but handle it gracefully to prevent panic
            "127.0.0.1".parse().unwrap_or_else(|_| {
                error!(
                    error_type = "ip_parse_failed",
                    "CRITICAL: Failed to parse 127.0.0.1, this should never happen"
                );
                std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1))
            })
        });

    // If no trusted proxies configured, only use direct connection IP
    // This prevents IP spoofing attacks
    if trusted_proxy_ips.is_empty() {
        return direct_ip;
    }

    // Check if the direct connection is from a trusted proxy
    let is_trusted_proxy = trusted_proxy_ips.iter().any(|trusted_ip_str| {
        // Support both plain IP and CIDR notation
        if trusted_ip_str.contains('/') {
            // CIDR notation
            if let Ok(net) = trusted_ip_str.parse::<ipnet::IpNet>() {
                net.contains(&direct_ip)
            } else {
                false
            }
        } else {
            // Plain IP address
            if let Ok(trusted_ip) = trusted_ip_str.parse::<IpAddr>() {
                trusted_ip == direct_ip
            } else {
                false
            }
        }
    });

    // Only use X-Forwarded-For/X-Real-IP if request is from trusted proxy
    if is_trusted_proxy {
        // Try X-Forwarded-For header first (for proxy scenarios)
        if let Some(forwarded_for) = headers.get("x-forwarded-for") {
            if let Ok(forwarded_str) = forwarded_for.to_str() {
                // X-Forwarded-For can contain multiple IPs, take the first one
                if let Some(first_ip) = forwarded_str.split(',').next() {
                    if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                        return ip;
                    }
                }
            }
        }

        // Try X-Real-IP header
        if let Some(real_ip) = headers.get("x-real-ip") {
            if let Ok(real_ip_str) = real_ip.to_str() {
                if let Ok(ip) = real_ip_str.parse::<IpAddr>() {
                    return ip;
                }
            }
        }
    }

    // Fallback to direct connection IP
    direct_ip
}

/// Check if an IP address is allowed by the whitelist entry
fn check_ip_allowed(client_ip: &IpAddr, whitelist_entry: &str) -> bool {
    if whitelist_entry.contains('/') {
        // CIDR notation
        match whitelist_entry.parse::<IpNet>() {
            Ok(net) => net.contains(client_ip),
            Err(_) => false,
        }
    } else {
        // Plain IP address
        match whitelist_entry.parse::<IpAddr>() {
            Ok(ip) => ip == *client_ip,
            Err(_) => false,
        }
    }
}

/// Check rate limit for an API key
/// Returns (allowed, remaining, reset_time)
/// Uses hybrid approach: memory cache + database persistence
async fn check_rate_limit_with_info(
    state: &AppState,
    api_key_id: &str,
    rpm: u32,
    burst: u32,
) -> (bool, u32, std::time::SystemTime) {
    let rpm = rpm.max(1);
    let burst_capacity = if burst == 0 { rpm } else { burst };
    let now = Instant::now();
    let window_duration = Duration::from_secs(60); // 1 minute window

    let should_load_db = {
        let state_read = state.rate_limit_state.read().await;
        !state_read.contains_key(api_key_id)
    };

    let db_snapshot = if should_load_db {
        if let Ok(Some((db_count, db_reset_at))) =
            state.security_repo.fetch_rate_limit_state(api_key_id).await
        {
            if let Ok(reset_chrono) = chrono::DateTime::parse_from_rfc3339(&db_reset_at) {
                let reset_utc = reset_chrono.with_timezone(&chrono::Utc);
                let now_utc = chrono::Utc::now();
                if let Ok(reset_duration) = reset_utc.signed_duration_since(now_utc).to_std() {
                    if reset_duration > Duration::ZERO {
                        Some((db_count.min(rpm), reset_duration))
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let mut rate_limit_state = state.rate_limit_state.write().await;
    // Load or initialize state (prefer memory, fallback to DB snapshot)
    let entry = match rate_limit_state.entry(api_key_id.to_string()) {
        std::collections::hash_map::Entry::Occupied(occupied) => occupied.into_mut(),
        std::collections::hash_map::Entry::Vacant(vacant) => {
            let mut entry = RateLimitStateEntry::new(now, burst_capacity);
            if let Some((count, duration)) = db_snapshot {
                entry.minute_count = count;
                entry.minute_reset = now + duration;
            }
            vacant.insert(entry)
        }
    };

    if entry.minute_reset <= now {
        entry.minute_count = 0;
        entry.minute_reset = now + window_duration;
    }

    // Refill token bucket based on rpm (tokens per minute)
    let fill_rate_per_sec = rpm as f64 / window_duration.as_secs() as f64;
    let elapsed_since_refill = now
        .checked_duration_since(entry.last_refill)
        .unwrap_or_default()
        .as_secs_f64();
    if elapsed_since_refill > 0.0 {
        entry.tokens_available = (entry.tokens_available
            + elapsed_since_refill * fill_rate_per_sec)
            .min(burst_capacity as f64);
        entry.last_refill = now;
    }

    let minute_limit_reached = entry.minute_count >= rpm;
    let burst_limit_reached = entry.tokens_available < 1.0;
    let allowed = !(minute_limit_reached || burst_limit_reached);

    if allowed {
        entry.minute_count = entry.minute_count.saturating_add(1);
        entry.tokens_available = (entry.tokens_available - 1.0).max(0.0);
    }

    // Remaining requests consider both rpm window and burst capacity
    let rpm_remaining = rpm.saturating_sub(entry.minute_count);
    let burst_remaining = entry.tokens_available.floor() as u32;
    let remaining = rpm_remaining.min(burst_remaining);

    // Persist to database asynchronously (don't block the request)
    let reset_duration = entry.minute_reset.saturating_duration_since(now);
    let security_repo = Arc::clone(&state.security_repo);
    let api_key_id_clone = api_key_id.to_string();
    let minute_count_snapshot = entry.minute_count;
    let reset_at = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(reset_duration.as_secs() as i64))
        .unwrap_or_else(chrono::Utc::now)
        .to_rfc3339();

    tokio::spawn(async move {
        if let Err(e) = security_repo
            .save_rate_limit_state(&api_key_id_clone, minute_count_snapshot, &reset_at)
            .await
        {
            error!(error_type = "rate_limit_persist_failed", api_key_id = %utils::mask_identifier(&api_key_id_clone), "Failed to persist rate limit state: {}", e);
        }
    });

    let reset_system_time = std::time::SystemTime::now() + reset_duration;

    (allowed, remaining, reset_system_time)
}

/// Check IP-based rate limit
///
/// Returns (allowed, remaining, reset_time)
async fn check_ip_rate_limit_with_info(
    state: &AppState,
    ip: &IpAddr,
    _rpm: u32,
    burst: u32,
) -> (bool, u32, std::time::SystemTime) {
    let mut ip_rate_limit_state = state.ip_rate_limit_state.write().await;
    let now = Instant::now();
    let window_duration = Duration::from_secs(60); // 1 minute window

    // Get current state for this IP
    let (count, reset_time) = if let Some((mem_count, mem_reset)) = ip_rate_limit_state.get(ip) {
        (*mem_count, *mem_reset)
    } else {
        // New IP, create entry
        (0, now + window_duration)
    };

    // Reset if window has expired
    let (count, reset_time) = if now > reset_time {
        (0, now + window_duration)
    } else {
        (count, reset_time)
    };

    // Check if limit would be exceeded after incrementing
    let new_count = count + 1;
    let allowed = new_count <= burst;

    // Calculate remaining requests (after this request is counted, if allowed)
    let remaining = if allowed {
        burst.saturating_sub(new_count)
    } else {
        0
    };

    // Always increment count for tracking purposes (even if over limit)
    ip_rate_limit_state.insert(*ip, (new_count, reset_time));

    // Convert reset_time to SystemTime for header
    let reset_duration = reset_time.saturating_duration_since(now);
    let reset_system_time = std::time::SystemTime::now() + reset_duration;

    (allowed, remaining, reset_system_time)
}

/// Create unauthorized response (401)
fn create_unauthorized_response() -> (StatusCode, axum::Json<serde_json::Value>) {
    (
        StatusCode::UNAUTHORIZED,
        axum::Json(serde_json::json!({
        "error": {
            "message": "Invalid API key",
            "type": "authentication_error",
            "code": "invalid_api_key"
        }
        })),
    )
}

/// Create forbidden response (403)
fn create_forbidden_response(message: &str) -> (StatusCode, axum::Json<serde_json::Value>) {
    (
        StatusCode::FORBIDDEN,
        axum::Json(serde_json::json!({
            "error": {
                "message": message,
                "type": "access_denied",
                "code": "forbidden"
            }
        })),
    )
}

/// Extract CORS headers from policy JSON
fn extract_cors_headers(
    policy_json: &serde_json::Value,
) -> Vec<(axum::http::HeaderName, axum::http::HeaderValue)> {
    let mut headers = Vec::new();

    if let Some(cors) = policy_json.get("cors") {
        // Access-Control-Allow-Origin
        if let Some(origin) = cors.get("allowed_origins") {
            if let Some(origins) = origin.as_array() {
                if !origins.is_empty() {
                    // For simplicity, use the first origin or "*" if empty
                    let origin_value = origins.first().and_then(|o| o.as_str()).unwrap_or("*");
                    if let Ok(value) = axum::http::HeaderValue::from_str(origin_value) {
                        let name =
                            axum::http::HeaderName::from_static("access-control-allow-origin");
                        headers.push((name, value));
                    }
                }
            } else if let Some(origin_str) = origin.as_str() {
                if let Ok(value) = axum::http::HeaderValue::from_str(origin_str) {
                    let name = axum::http::HeaderName::from_static("access-control-allow-origin");
                    headers.push((name, value));
                }
            }
        }

        // Access-Control-Allow-Methods
        if let Some(methods) = cors.get("allowed_methods") {
            if let Some(methods_array) = methods.as_array() {
                let methods_str: Vec<String> = methods_array
                    .iter()
                    .filter_map(|m| m.as_str().map(|s| s.to_uppercase()))
                    .collect();
                if !methods_str.is_empty() {
                    let methods_value = methods_str.join(", ");
                    if let Ok(value) = axum::http::HeaderValue::from_str(&methods_value) {
                        let name =
                            axum::http::HeaderName::from_static("access-control-allow-methods");
                        headers.push((name, value));
                    }
                }
            }
        }

        // Access-Control-Allow-Headers
        if let Some(headers_list) = cors.get("allowed_headers") {
            if let Some(headers_array) = headers_list.as_array() {
                let headers_str: Vec<String> = headers_array
                    .iter()
                    .filter_map(|h| h.as_str().map(|s| s.to_string()))
                    .collect();
                if !headers_str.is_empty() {
                    let headers_value = headers_str.join(", ");
                    if let Ok(value) = axum::http::HeaderValue::from_str(&headers_value) {
                        let name =
                            axum::http::HeaderName::from_static("access-control-allow-headers");
                        headers.push((name, value));
                    }
                }
            }
        }
    }

    headers
}

/// Create rate limit response (429)
fn create_rate_limit_response() -> (StatusCode, axum::Json<serde_json::Value>) {
    (
        StatusCode::TOO_MANY_REQUESTS,
        axum::Json(serde_json::json!({
            "error": {
                "message": "Rate limit exceeded",
                "type": "rate_limit_error",
                "code": "rate_limit_exceeded"
            }
        })),
    )
}

/// Create not found response (404)
fn create_not_found_response() -> (StatusCode, axum::Json<serde_json::Value>) {
    (
        StatusCode::NOT_FOUND,
        axum::Json(serde_json::json!({
            "error": {
                "message": "The requested resource was not found",
                "type": "invalid_request_error",
                "code": "not_found"
            }
        })),
    )
}

/// Create internal server error response (500)
fn create_internal_error_response() -> (StatusCode, axum::Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        axum::Json(serde_json::json!({
            "error": {
                "message": "Internal server error",
                "type": "server_error",
                "code": "internal_error"
            }
        })),
    )
}

/// Add security headers to all responses
///
/// This middleware adds security headers to prevent XSS, clickjacking,
/// MIME type sniffing, and other attacks.
pub async fn add_security_headers(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    // X-Content-Type-Options: Prevent MIME type sniffing
    let value = axum::http::HeaderValue::from_static("nosniff");
    headers.insert(axum::http::header::X_CONTENT_TYPE_OPTIONS, value);

    // X-Frame-Options: Prevent clickjacking
    let value = axum::http::HeaderValue::from_static("DENY");
    headers.insert(
        axum::http::header::HeaderName::from_static("x-frame-options"),
        value,
    );

    // X-XSS-Protection: Enable XSS filter (legacy browsers)
    let value = axum::http::HeaderValue::from_static("1; mode=block");
    headers.insert(
        axum::http::header::HeaderName::from_static("x-xss-protection"),
        value,
    );

    // Referrer-Policy: Prevent referrer leakage
    let value = axum::http::HeaderValue::from_static("no-referrer");
    headers.insert(
        axum::http::header::HeaderName::from_static("referrer-policy"),
        value,
    );

    // Content-Security-Policy: Restrict resource loading
    let csp = "default-src 'self'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'";
    if let Ok(value) = axum::http::HeaderValue::from_str(csp) {
        headers.insert(
            axum::http::header::HeaderName::from_static("content-security-policy"),
            value,
        );
    }

    // Permissions-Policy: Restrict browser features
    let permissions = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";
    if let Ok(value) = axum::http::HeaderValue::from_str(permissions) {
        headers.insert(
            axum::http::header::HeaderName::from_static("permissions-policy"),
            value,
        );
    }

    response
}

/// Request timeout middleware
///
/// This middleware applies a 60-second timeout to non-streaming requests.
/// Streaming requests should not use this middleware.
pub async fn request_timeout_middleware(request: Request, next: Next) -> Response {
    const TIMEOUT_DURATION: Duration = Duration::from_secs(60);

    match timeout(TIMEOUT_DURATION, next.run(request)).await {
        Ok(response) => response,
        Err(_) => {
            // Timeout occurred
            (
                StatusCode::REQUEST_TIMEOUT,
                Json(serde_json::json!({
                    "error": {
                        "message": "Request timeout",
                        "type": "timeout_error",
                        "code": "request_timeout"
                    }
                })),
            )
                .into_response()
        }
    }
}

/// Streaming timeout middleware
///
/// This middleware applies a 30-minute timeout to streaming requests.
/// Streaming requests can take longer, but we still need a timeout to prevent resource exhaustion.
pub async fn streaming_timeout_middleware(request: Request, next: Next) -> Response {
    const TIMEOUT_DURATION: Duration = Duration::from_secs(1800); // 30 minutes

    match timeout(TIMEOUT_DURATION, next.run(request)).await {
        Ok(response) => response,
        Err(_) => {
            // Timeout occurred
            (
                StatusCode::REQUEST_TIMEOUT,
                Json(serde_json::json!({
                    "error": {
                        "message": "Streaming request timeout",
                        "type": "timeout_error",
                        "code": "streaming_timeout"
                    }
                })),
            )
                .into_response()
        }
    }
}

/// Audit logging middleware
///
/// This middleware logs all requests to the audit_logs table.
/// Logs are saved asynchronously to avoid blocking the request.
pub async fn audit_logging_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    use std::time::SystemTime;

    let start_time = SystemTime::now();
    let endpoint = request.uri().path().to_string();
    let headers = request.headers().clone();

    // Generate unique request ID using timestamp and random component
    let request_id = format!(
        "{}-{}",
        chrono::Utc::now().timestamp_millis(),
        rand::random::<u64>()
    );

    // Get API key ID from request extensions (set by auth_middleware)
    let api_key_id = request.extensions().get::<String>().cloned();

    // Extract client IP
    let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);
    let client_ip_str = client_ip.to_string();

    // Process request
    let response = next.run(request).await;

    // Calculate latency
    let latency_ms = start_time.elapsed().ok().map(|d| d.as_millis() as u64);

    // Get status code
    let status = response.status().as_u16();

    // Determine event type and severity based on status code
    let (event_type, severity) = if status == 200 || status == 201 {
        (Some("auth_success"), "low")
    } else if status == 401 {
        (Some("auth_failure"), "medium")
    } else if status == 403 {
        (Some("ip_blocked"), "high")
    } else if status >= 500 {
        (None, "high")
    } else {
        (None, "low")
    };

    // Save audit log asynchronously (don't block response)
    let security_repo = Arc::clone(&state.security_repo);
    let masked_api_key_id = api_key_id.as_ref().map(|id| utils::mask_identifier(id));
    let endpoint_clone = endpoint.clone();
    let client_ip_str_clone = client_ip_str.clone();
    tokio::spawn(async move {
        let metadata = AuditLogMetadata {
            severity,
            ip: Some(&client_ip_str_clone),
            details: None, // details can be added later for specific events
        };
        if let Err(e) = security_repo
            .save_audit_log(
                &request_id,
                api_key_id.as_deref(),
                &endpoint_clone,
                status,
                latency_ms,
                event_type,
                metadata,
            )
            .await
        {
            error!(
                error_type = "audit_log_failed",
                api_key_id = ?masked_api_key_id,
                endpoint = %endpoint_clone,
                "Failed to save audit log: {}", e
            );
        }
    });

    response
}
