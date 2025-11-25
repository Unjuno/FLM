//! Utility functions for security and logging

/// Mask sensitive identifiers (engine IDs, API key IDs, etc.)
///
/// Replaces the middle portion with asterisks to prevent information leakage
/// while still allowing some identification for debugging purposes.
pub fn mask_identifier(id: &str) -> String {
    if id.len() <= 8 {
        // For short IDs, mask all but first 2 characters
        format!("{}***", &id[..id.len().min(2)])
    } else {
        // For longer IDs, show first 4 and last 4 characters
        let prefix = &id[..4.min(id.len())];
        let suffix = if id.len() > 8 {
            &id[id.len() - 4..]
        } else {
            ""
        };
        format!("{prefix}***{suffix}")
    }
}

/// Mask IP addresses for logging
///
/// Replaces the last octet with asterisks for IPv4,
/// or the last 64 bits for IPv6.
#[allow(dead_code)]
pub fn mask_ip_address(ip: &std::net::IpAddr) -> String {
    match ip {
        std::net::IpAddr::V4(ipv4) => {
            let octets = ipv4.octets();
            format!("{}.{}.{}.***", octets[0], octets[1], octets[2])
        }
        std::net::IpAddr::V6(ipv6) => {
            // Show first 64 bits, mask last 64 bits
            let segments = ipv6.segments();
            format!(
                "{:x}:{:x}:{:x}:{:x}:***",
                segments[0], segments[1], segments[2], segments[3]
            )
        }
    }
}
