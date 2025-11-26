//! Utility functions for FLM CLI

pub mod paths;

pub use paths::{
    get_app_data_dir, get_config_db_path, get_daemon_state_path, get_runtime_dir,
    get_security_db_path,
};
