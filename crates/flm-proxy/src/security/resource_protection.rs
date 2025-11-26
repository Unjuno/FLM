//! Resource protection system
//!
//! This module provides resource monitoring functionality to detect and prevent resource exhaustion.
//! See `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` section 2.4

use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::System;
use tokio::sync::RwLock;
use tracing::warn;

/// Resource protection manager
///
/// Monitors CPU and memory usage and automatically throttles requests when thresholds are exceeded.
pub struct ResourceProtection {
    /// CPU usage threshold (0.0-1.0, where 1.0 = 100%)
    cpu_threshold: f64,
    /// Memory usage threshold (0.0-1.0, where 1.0 = 100%)
    memory_threshold: f64,
    /// Last CPU check time
    last_cpu_check: Arc<RwLock<Instant>>,
    /// Last memory check time
    last_memory_check: Arc<RwLock<Instant>>,
    /// Check interval (to avoid excessive system calls)
    check_interval: Duration,
    /// Last known CPU usage (0.0-1.0)
    last_cpu_usage: Arc<RwLock<f64>>,
    /// Last known memory usage (0.0-1.0)
    last_memory_usage: Arc<RwLock<f64>>,
    /// Whether resource protection is currently active (throttling new connections)
    protection_active: Arc<RwLock<bool>>,
    /// Shared sysinfo system handle
    system: Arc<RwLock<System>>,
}

impl ResourceProtection {
    /// Create a new resource protection system
    pub fn new() -> Self {
        Self {
            cpu_threshold: 0.9,    // 90%
            memory_threshold: 0.9, // 90%
            last_cpu_check: Arc::new(RwLock::new(Instant::now())),
            last_memory_check: Arc::new(RwLock::new(Instant::now())),
            check_interval: Duration::from_secs(5), // Check every 5 seconds
            last_cpu_usage: Arc::new(RwLock::new(0.0)),
            last_memory_usage: Arc::new(RwLock::new(0.0)),
            protection_active: Arc::new(RwLock::new(false)),
            system: Arc::new(RwLock::new(System::new())),
        }
    }

    /// Create a new resource protection system with custom thresholds (for testing)
    /// Create a new resource protection system with custom thresholds (for testing)
    #[cfg(any(test, feature = "test-utils"))]
    pub fn with_thresholds(mut self, cpu_threshold: f64, memory_threshold: f64) -> Self {
        self.cpu_threshold = cpu_threshold;
        self.memory_threshold = memory_threshold;
        self
    }

    /// Check if new connections should be throttled
    ///
    /// Returns `true` if resource usage exceeds thresholds and new connections should be rejected.
    pub async fn should_throttle(&self) -> bool {
        // Check CPU usage
        let cpu_usage = self.get_cpu_usage().await;
        if cpu_usage > self.cpu_threshold {
            warn!(
                cpu_usage = cpu_usage,
                threshold = self.cpu_threshold,
                "CPU usage exceeds threshold"
            );
            *self.protection_active.write().await = true;
            return true;
        }

        // Check memory usage
        let memory_usage = self.get_memory_usage().await;
        if memory_usage > self.memory_threshold {
            warn!(
                memory_usage = memory_usage,
                threshold = self.memory_threshold,
                "Memory usage exceeds threshold"
            );
            *self.protection_active.write().await = true;
            return true;
        }

        // Both are below threshold, disable protection
        *self.protection_active.write().await = false;
        false
    }

    /// Get current CPU usage (0.0-1.0)
    ///
    /// Uses cached value if check interval hasn't elapsed.
    async fn get_cpu_usage(&self) -> f64 {
        let mut last_check = self.last_cpu_check.write().await;
        let now = Instant::now();

        if now.duration_since(*last_check) < self.check_interval {
            // Return cached value
            return *self.last_cpu_usage.read().await;
        }

        // Update check time
        *last_check = now;

        // Refresh CPU metrics
        let mut system = self.system.write().await;
        system.refresh_cpu();

        let cpu_usage = if system.cpus().is_empty() {
            0.0
        } else {
            let total: f64 = system.cpus().iter().map(|cpu| cpu.cpu_usage() as f64).sum();
            let avg = total / system.cpus().len() as f64;
            (avg / 100.0).clamp(0.0, 1.0)
        };

        // Update cached value
        *self.last_cpu_usage.write().await = cpu_usage;

        cpu_usage
    }

    /// Get current memory usage (0.0-1.0)
    ///
    /// Uses cached value if check interval hasn't elapsed.
    async fn get_memory_usage(&self) -> f64 {
        let mut last_check = self.last_memory_check.write().await;
        let now = Instant::now();

        if now.duration_since(*last_check) < self.check_interval {
            // Return cached value
            return *self.last_memory_usage.read().await;
        }

        // Update check time
        *last_check = now;

        // Refresh memory metrics
        let mut system = self.system.write().await;
        system.refresh_memory();

        let total_memory = system.total_memory();
        let used_memory = system.used_memory();
        let memory_usage = if total_memory == 0 {
            0.0
        } else {
            (used_memory as f64 / total_memory as f64).clamp(0.0, 1.0)
        };

        // Update cached value
        *self.last_memory_usage.write().await = memory_usage;

        memory_usage
    }

    /// Get current protection status
    pub async fn is_protection_active(&self) -> bool {
        *self.protection_active.read().await
    }

    /// Get last known CPU usage
    pub async fn get_last_cpu_usage(&self) -> f64 {
        *self.last_cpu_usage.read().await
    }

    /// Get last known memory usage
    pub async fn get_last_memory_usage(&self) -> f64 {
        *self.last_memory_usage.read().await
    }
}

impl Default for ResourceProtection {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_resource_protection_should_throttle() {
        let protection = ResourceProtection::new().with_thresholds(1.5, 1.5);
        let should_throttle = protection.should_throttle().await;
        assert!(
            !should_throttle,
            "Should not throttle when usage is below threshold"
        );
    }

    #[tokio::test]
    async fn test_resource_protection_status() {
        let protection = ResourceProtection::new();

        let is_active = protection.is_protection_active().await;
        assert!(!is_active, "Protection should not be active initially");

        let cpu_usage = protection.get_last_cpu_usage().await;
        let memory_usage = protection.get_last_memory_usage().await;
        assert_eq!(cpu_usage, 0.0);
        assert_eq!(memory_usage, 0.0);
    }
}
