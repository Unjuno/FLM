//! Axum middleware for authentication and policy enforcement

use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use flm_core::services::SecurityService;
use ipnet::IpNet;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time::timeout;
use tracing::{error, warn};
use crate::security::{IpBlocklist, IntrusionDetection};
use crate::utils;

/// Application state for the proxy server
#[derive(Clone)]
pub struct AppState {
    pub security_service: Arc<SecurityService<crate::adapters::SqliteSecurityRepository>>,
    pub security_repo: Arc<crate::adapters::SqliteSecurityRepository>,
    pub engine_service: Arc<flm_core::services::EngineService>,
    pub engine_repo: Arc<dyn flm_core::ports::EngineRepository + Send + Sync>,
    /// Rate limit state: API key ID -> (request count, reset time)
    pub rate_limit_state: Arc<RwLock<std::collections::HashMap<String, (u32, Instant)>>>,
    /// Trusted proxy IP addresses (for X-Forwarded-For header validation)
    pub trusted_proxy_ips: Vec<String>,
    /// IP blocklist for botnet protection
    pub ip_blocklist: Arc<IpBlocklist>,
    /// Intrusion detection system
    pub intrusion_detection: Arc<IntrusionDetection>,
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
            warn!(error_type = "no_policy", "No security policy configured. Denying access for security.");
            return create_forbidden_response("No security policy configured. Access denied.")
                .into_response();
        }
        Err(_) => {
            // Error fetching policy - fail closed for security
            // Log error and deny access (don't expose error details)
            error!(error_type = "policy_fetch_error", "Failed to fetch security policy. Denying access for security.");
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
            error!(error_type = "invalid_policy_json", "Invalid security policy JSON. Denying access for security.");
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

    // 3. Check rate limit
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

                    let (allowed, remaining, reset_time) = check_rate_limit_with_info(
                        &state,
                        api_key_id,
                        rpm as u32,
                        burst as u32,
                    )
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
                        warn!(error_type = "reset_timestamp_calc_failed", "Failed to calculate reset timestamp. Using current time.");
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs()
                    }
                };
                if let Ok(reset_value) = axum::http::HeaderValue::from_str(&reset_timestamp.to_string()) {
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
    let user_agent = headers.get("user-agent")
        .and_then(|h| h.to_str().ok());
    
    // Check for intrusion patterns
    let score = state.intrusion_detection.check_request(
        &client_ip,
        &path,
        &method,
        user_agent,
    ).await;
    
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
                    Some(&path_clone),
                    user_agent_clone.as_deref(),
                    Some(&method_clone),
                )
                .await;
            
            // Check if should block
            let (should_block, block_duration) = intrusion_detection.should_block(&client_ip_for_db).await;
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
                let _ = security_repo
                    .save_audit_log(
                        &format!("{}-intrusion", id),
                        None,
                        &path_clone,
                        403,
                        None,
                        Some("intrusion"),
                        "high",
                        Some(&client_ip_str),
                        Some(&serde_json::json!({
                            "score": current_score,
                            "block_duration_seconds": block_duration,
                            "failures_recorded": failures_to_record
                        }).to_string()),
                    )
                    .await;
            }
        });
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
            let _ = security_repo
                .save_audit_log(
                    &request_id,
                    None,
                    &endpoint,
                    403,
                    None,
                    Some("ip_blocked"),
                    "high",
                    Some(&client_ip_str),
                    Some(&serde_json::json!({
                        "reason": "ip_blocked"
                    }).to_string()),
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
    // Skip authentication for /health endpoint
    if request.uri().path() == "/health" {
        return next.run(request).await;
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
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &endpoint,
                        401,
                        None,
                        Some("auth_failure"),
                        "medium",
                        Some(&client_ip_str),
                        Some(&serde_json::json!({
                            "reason": "missing_authorization_header"
                        }).to_string()),
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
            let _ = security_repo
                .save_audit_log(
                    &request_id,
                    None,
                    &endpoint,
                    401,
                    None,
                    Some("auth_failure"),
                    "medium",
                    Some(&client_ip_str),
                    Some(&serde_json::json!({
                        "reason": "invalid_authorization_format"
                    }).to_string()),
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
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &endpoint,
                        401,
                        None,
                        Some("auth_failure"),
                        "medium",
                        Some(&client_ip_str),
                        Some(&serde_json::json!({
                            "reason": "invalid_or_revoked_api_key"
                        }).to_string()),
                    )
                    .await;
                
                // Sync to database if block was applied
                if should_block {
                    if let Err(e) = ip_blocklist_for_sync.sync_to_db(&security_repo_for_sync).await {
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
                let _ = security_repo
                    .save_audit_log(
                        &request_id,
                        None,
                        &endpoint,
                        500,
                        None,
                        Some("auth_failure"),
                        "high",
                        Some(&client_ip_str),
                        Some(&serde_json::json!({
                            "reason": "verification_error"
                        }).to_string()),
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
fn extract_client_ip(
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
            "127.0.0.1"
                .parse()
                .unwrap_or_else(|_| {
                    error!(error_type = "ip_parse_failed", "CRITICAL: Failed to parse 127.0.0.1, this should never happen");
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
    _rpm: u32,
    burst: u32,
) -> (bool, u32, std::time::SystemTime) {
    let mut rate_limit_state = state.rate_limit_state.write().await;
    let now = Instant::now();
    let window_duration = Duration::from_secs(60); // 1 minute window

        // Try to load from database if not in memory cache
        let (count, reset_time) = if let Some((mem_count, mem_reset)) = rate_limit_state.get(api_key_id) {
            (*mem_count, *mem_reset)
        } else {
            // Load from database
            if let Ok(Some((db_count, db_reset_at))) = state.security_repo
                .fetch_rate_limit_state(api_key_id)
                .await
            {
                // Parse reset_at timestamp
                if let Ok(reset_chrono) = chrono::DateTime::parse_from_rfc3339(&db_reset_at) {
                let reset_system = reset_chrono.with_timezone(&chrono::Utc);
                let reset_duration = reset_system
                    .signed_duration_since(chrono::Utc::now())
                    .to_std()
                    .unwrap_or_default();
                let reset_instant = now + reset_duration;
                
                // If expired, reset
                if now > reset_instant {
                    (0, now + window_duration)
                } else {
                    (db_count, reset_instant)
                }
            } else {
                // Invalid timestamp, reset
                (0, now + window_duration)
            }
        } else {
            // Not in database, create new entry
            (0, now + window_duration)
        }
    };

    // Store in memory cache
    rate_limit_state.insert(api_key_id.to_string(), (count, reset_time));

    // Reset if window has expired
    let (count, reset_time) = if now > reset_time {
        (0, now + window_duration)
    } else {
        (count, reset_time)
    };

    // Check if limit exceeded (before incrementing)
    let allowed = count < burst;
    let remaining = if count < burst {
        burst.saturating_sub(count + 1)
    } else {
        0
    };

    // Increment count if allowed
    let new_count = if allowed { count + 1 } else { count };
    rate_limit_state.insert(api_key_id.to_string(), (new_count, reset_time));

    // Persist to database asynchronously (don't block the request)
    let security_repo = Arc::clone(&state.security_repo);
    let api_key_id_clone = api_key_id.to_string();
    let reset_at = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(
            reset_time.saturating_duration_since(now).as_secs() as i64
        ))
        .unwrap_or_else(chrono::Utc::now)
        .to_rfc3339();
    
    tokio::spawn(async move {
        if let Err(e) = security_repo.save_rate_limit_state(&api_key_id_clone, new_count, &reset_at).await {
            error!(error_type = "rate_limit_persist_failed", api_key_id = %utils::mask_identifier(&api_key_id_clone), "Failed to persist rate limit state: {}", e);
        }
    });

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
pub async fn add_security_headers(
    request: Request,
    next: Next,
) -> Response {
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
pub async fn request_timeout_middleware(
    request: Request,
    next: Next,
) -> Response {
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
pub async fn streaming_timeout_middleware(
    request: Request,
    next: Next,
) -> Response {
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
    let latency_ms = start_time
        .elapsed()
        .ok()
        .map(|d| d.as_millis() as u64);
    
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
        if let Err(e) = security_repo
            .save_audit_log(
                &request_id,
                api_key_id.as_deref(),
                &endpoint_clone,
                status,
                latency_ms,
                event_type,
                severity,
                Some(&client_ip_str_clone),
                None, // details can be added later for specific events
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
