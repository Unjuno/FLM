//! Axum middleware for authentication and policy enforcement

use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use flm_core::services::SecurityService;
use ipnet::IpNet;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Application state for the proxy server
#[derive(Clone)]
pub struct AppState {
    pub security_service: Arc<SecurityService<crate::adapters::SqliteSecurityRepository>>,
    pub engine_service: Arc<flm_core::services::EngineService>,
    pub engine_repo: Arc<dyn flm_core::ports::EngineRepository + Send + Sync>,
    /// Rate limit state: API key ID -> (request count, reset time)
    pub rate_limit_state: Arc<RwLock<std::collections::HashMap<String, (u32, Instant)>>>,
    /// Trusted proxy IP addresses (for X-Forwarded-For header validation)
    pub trusted_proxy_ips: Vec<String>,
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
    mut request: Request,
    next: Next,
) -> Response {
    // Get client IP from request
    // Note: request is mut to allow access to extensions, but we only read from it
    let client_ip = extract_client_ip(&request, &headers, &state.trusted_proxy_ips);

    // Get security policy
    let policy = match state.security_service.get_policy("default").await {
        Ok(Some(policy)) => policy,
        Ok(None) => {
            // No policy configured - fail closed for security
            // Log warning and deny access
            eprintln!("WARNING: No security policy configured. Denying access for security.");
            return create_forbidden_response("No security policy configured. Access denied.")
                .into_response();
        }
        Err(e) => {
            // Error fetching policy - fail closed for security
            // Log error and deny access
            eprintln!("ERROR: Failed to fetch security policy: {}. Denying access for security.", e);
            return create_forbidden_response("Security policy error. Access denied.")
                .into_response();
        }
    };

    // Parse policy JSON
    let policy_json: serde_json::Value = match serde_json::from_str(&policy.policy_json) {
        Ok(json) => json,
        Err(e) => {
            // Invalid policy JSON - fail closed for security
            eprintln!("ERROR: Invalid security policy JSON: {}. Denying access for security.", e);
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
                        eprintln!("WARNING: Failed to calculate reset timestamp. Using current time.");
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
            return create_unauthorized_response().into_response();
        }
    };

    // Check if it's a Bearer token
    if !auth_header.starts_with("Bearer ") {
        return create_unauthorized_response().into_response();
    }

    // Extract the token
    let token = match auth_header.strip_prefix("Bearer ") {
        Some(t) => t,
        None => {
            return create_unauthorized_response().into_response();
        }
    };

    // Verify the API key
    match state.security_service.verify_api_key(token).await {
        Ok(Some(record)) => {
            // API key is valid, continue to next middleware/handler
            // Store API key ID in request extensions for rate limiting
            request.extensions_mut().insert(record.id.clone());
            next.run(request).await
        }
        Ok(None) => {
            // API key is invalid or revoked
            create_unauthorized_response().into_response()
        }
        Err(_) => {
            // Error during verification
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
            "127.0.0.1"
                .parse()
                .expect("127.0.0.1 is a valid IP address")
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
async fn check_rate_limit_with_info(
    state: &AppState,
    api_key_id: &str,
    _rpm: u32,
    burst: u32,
) -> (bool, u32, std::time::SystemTime) {
    let mut rate_limit_state = state.rate_limit_state.write().await;
    let now = Instant::now();
    let window_duration = Duration::from_secs(60); // 1 minute window

    // Get or create rate limit entry
    let (count, reset_time) = rate_limit_state
        .entry(api_key_id.to_string())
        .or_insert_with(|| (0, now + window_duration));

    // Reset if window has expired
    if now > *reset_time {
        *count = 0;
        *reset_time = now + window_duration;
    }

    // Check if limit exceeded (before incrementing)
    let allowed = *count < burst;
    let remaining = if *count < burst {
        burst.saturating_sub(*count + 1)
    } else {
        0
    };

    // Increment count if allowed
    if allowed {
        *count += 1;
    }

    // Convert reset_time to SystemTime for header
    // reset_time is an Instant, so we calculate the duration until reset
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
