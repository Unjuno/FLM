//! Tests for EngineProcessController implementation

use flm_cli::adapters::DefaultEngineProcessController;
use flm_core::domain::models::EngineKind;
use flm_core::ports::EngineProcessController;

#[test]
fn test_process_controller_detect_binaries() {
    let controller = DefaultEngineProcessController::new();
    let binaries = controller.detect_binaries();

    // We can't guarantee engines are installed, so we just check the structure
    // If engines are found, verify they have correct properties
    for binary in &binaries {
        assert!(!binary.engine_id.is_empty());
        assert!(!binary.binary_path.is_empty());
        // Verify kind matches engine_id
        if binary.engine_id.contains("ollama") {
            assert_eq!(binary.kind, EngineKind::Ollama);
        } else if binary.engine_id.contains("llamacpp") {
            assert_eq!(binary.kind, EngineKind::LlamaCpp);
        }
    }
}

#[test]
fn test_process_controller_detect_running() {
    let controller = DefaultEngineProcessController::new();
    let runtimes = controller.detect_running();

    // We can't guarantee engines are running, so we just check the structure
    for runtime in &runtimes {
        assert!(!runtime.engine_id.is_empty());
        assert!(!runtime.base_url.is_empty());
        assert!(runtime.base_url.starts_with("http://"));
    }
}

#[test]
fn test_process_controller_vllm_detection() {
    // Test vLLM detection with environment variable
    std::env::set_var("VLLM_PORT", "9000");
    std::env::set_var("VLLM_HOST", "127.0.0.1");

    let controller = DefaultEngineProcessController::new();
    let runtimes = controller.detect_running();

    // Check if vLLM runtime is detected
    let vllm_runtime = runtimes.iter().find(|r| r.kind == EngineKind::Vllm);
    if let Some(runtime) = vllm_runtime {
        assert_eq!(runtime.port, Some(9000));
        assert!(runtime.base_url.contains("127.0.0.1"));
        assert!(runtime.base_url.contains("9000"));
    }

    // Clean up
    std::env::remove_var("VLLM_PORT");
    std::env::remove_var("VLLM_HOST");
}

#[test]
fn test_process_controller_lmstudio_detection() {
    // Test LM Studio detection with environment variable
    std::env::set_var("LMSTUDIO_API_HOST", "192.168.1.100");

    let controller = DefaultEngineProcessController::new();
    let runtimes = controller.detect_running();

    // Check if LM Studio runtime is detected
    let lmstudio_runtime = runtimes.iter().find(|r| r.kind == EngineKind::LmStudio);
    if let Some(runtime) = lmstudio_runtime {
        assert_eq!(runtime.port, Some(1234));
        assert!(runtime.base_url.contains("192.168.1.100"));
    }

    // Clean up
    std::env::remove_var("LMSTUDIO_API_HOST");
}

#[test]
fn test_process_controller_llamacpp_detection() {
    // Test llama.cpp detection with environment variable
    std::env::set_var("LLAMA_CPP_PORT", "9090");

    let controller = DefaultEngineProcessController::new();
    let runtimes = controller.detect_running();

    // Check if llama.cpp runtime is detected
    let llamacpp_runtime = runtimes.iter().find(|r| r.kind == EngineKind::LlamaCpp);
    if let Some(runtime) = llamacpp_runtime {
        assert_eq!(runtime.port, Some(9090));
        assert!(runtime.base_url.contains("9090"));
    }

    // Clean up
    std::env::remove_var("LLAMA_CPP_PORT");
}

#[test]
fn test_process_controller_llamacpp_binary_detection() {
    use std::fs;
    use std::io::Write;
    use tempfile::NamedTempFile;

    // Create a temporary binary file to simulate llama.cpp binary
    let mut temp_file = NamedTempFile::new().expect("Failed to create temp file");
    #[cfg(target_os = "windows")]
    {
        // On Windows, we need .exe extension
        let temp_path = temp_file.path().with_extension("exe");
        temp_file = NamedTempFile::new_in(temp_path.parent().unwrap())
            .expect("Failed to create temp exe file");
    }
    temp_file
        .write_all(b"fake binary")
        .expect("Failed to write to temp file");
    let temp_path = temp_file.path().to_path_buf();
    temp_file
        .persist(&temp_path)
        .expect("Failed to persist temp file");

    // Set LLAMA_CPP_PATH environment variable
    std::env::set_var("LLAMA_CPP_PATH", temp_path.to_str().unwrap());

    let controller = DefaultEngineProcessController::new();
    let binaries = controller.detect_binaries();

    // Check if llama.cpp binary is detected
    let llamacpp_binary = binaries.iter().find(|b| b.kind == EngineKind::LlamaCpp);
    if let Some(binary) = llamacpp_binary {
        assert_eq!(binary.kind, EngineKind::LlamaCpp);
        assert!(binary.engine_id.contains("llamacpp"));
        assert_eq!(binary.binary_path, temp_path.to_string_lossy().to_string());
    }

    // Clean up
    std::env::remove_var("LLAMA_CPP_PATH");
    let _ = fs::remove_file(&temp_path);
}
