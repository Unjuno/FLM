//! Security modules for botnet protection
//!
//! This module contains security features for protecting against botnet attacks:
//! - IP blocklist management
//! - Intrusion detection
//! - Anomaly detection (future)
//! - Resource protection (future)

pub mod ip_blocklist;
pub mod intrusion_detection;

pub use ip_blocklist::{IpBlocklist, BlocklistEntry};
pub use intrusion_detection::IntrusionDetection;

