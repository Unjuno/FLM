//! Tests for EngineProcessController implementation

use flm_cli::adapters::DefaultEngineProcessController;
use flm_core::domain::models::EngineKind;
use flm_core::ports::EngineProcessController;

#[test]
fn test_process_controller_detect_binaries() {
    let controller = DefaultEngineProcessController::new();
    let binaries = controller.detect_binaries();

    // We can't guarantee Ollama is installed, so we just check the structure
    // If Ollama is found, verify it has correct properties
    for binary in &binaries {
        assert!(!binary.engine_id.is_empty());
        assert!(!binary.binary_path.is_empty());
        // If it's Ollama, verify the kind
        if binary.engine_id.contains("ollama") {
            assert_eq!(binary.kind, EngineKind::Ollama);
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
