//! Utility functions for security and logging

/// Mask sensitive identifiers (engine IDs, API key IDs, etc.)
///
/// Replaces the middle portion with asterisks to prevent information leakage
/// while still allowing some identification for debugging purposes.
pub fn mask_identifier(id: &str) -> String {
    if id.len() <= 8 {
        // For short IDs, mask all but first 2 characters
        let prefix = &id[..id.len().min(2)];
        format!("{prefix}***")
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
            let [o0, o1, o2, _] = ipv4.octets();
            format!("{o0}.{o1}.{o2}.***")
        }
        std::net::IpAddr::V6(ipv6) => {
            // Show first 64 bits, mask last 64 bits
            let [s0, s1, s2, s3, _, _, _, _] = ipv6.segments();
            format!("{s0:x}:{s1:x}:{s2:x}:{s3:x}:***")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

    #[test]
    fn test_mask_identifier_short() {
        assert_eq!(mask_identifier("ab"), "ab***");
        assert_eq!(mask_identifier("a"), "a***");
    }

    #[test]
    fn test_mask_identifier_medium() {
        // 8 characters or less are treated as short IDs
        assert_eq!(mask_identifier("abcdefgh"), "ab***");
        // 9+ characters show first 4 and last 4
        assert_eq!(mask_identifier("abcdefghi"), "abcd***fghi");
    }

    #[test]
    fn test_mask_identifier_long() {
        assert_eq!(mask_identifier("abcdefghijklmnop"), "abcd***mnop");
        assert_eq!(mask_identifier("12345678901234567890"), "1234***7890");
    }

    #[test]
    fn test_mask_ip_address_ipv4() {
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100));
        let masked = mask_ip_address(&ip);
        assert_eq!(masked, "192.168.1.***");
    }

    #[test]
    fn test_mask_ip_address_ipv6() {
        let ip = IpAddr::V6(Ipv6Addr::new(
            0x2001, 0x0db8, 0x85a3, 0x0000, 0x0000, 0x8a2e, 0x0370, 0x7334,
        ));
        let masked = mask_ip_address(&ip);
        assert!(masked.starts_with("2001:db8:85a3:0:***"));
    }
}
