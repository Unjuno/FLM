# E2E Tests for Tauri Application

This directory contains end-to-end tests for the FLM Tauri application.

## Prerequisites

- Tauri application must be built and available
- The application should be running or the tests should be run in a Tauri environment

## Test Structure

### `tauri-app.test.ts`
Main E2E test file covering:
- Application info and greeting
- Engine detection flow
- Proxy management flow
- Security features flow
- Configuration management

### `helpers.ts`
Helper functions for E2E tests:
- Tauri availability checking
- Wait utilities
- Safe command invocation
- Resource cleanup

### `fixtures.ts`
Test fixtures and data:
- Test configurations
- Test data generators
- Common test objects

## Running Tests

### With Tauri App Running
```bash
# Start the Tauri app first
npm run tauri:dev

# In another terminal, run tests
npm test -- tests/e2e
```

### Without Tauri App
The tests will skip if Tauri is not available, but some tests may fail. It's recommended to run these tests with the Tauri app running.

## Test Scenarios

### 1. Application Info
- Get app information
- Greet user

### 2. Engine Detection Flow
- Detect available engines
- List models for an engine

### 3. Proxy Management Flow
- Start proxy
- Check proxy status
- Stop proxy

### 4. Security Features Flow
- List API keys
- Create API key
- Get security policy
- Set security policy

### 5. Configuration Management
- List configuration
- Get platform information

## Notes

- Tests are designed to be resilient and will skip if Tauri is not available
- Some tests may fail if required resources (engines, models) are not available
- Tests clean up resources when possible, but manual cleanup may be needed

## Future Enhancements

- UI interaction tests using Playwright
- Visual regression tests
- Performance tests
- Accessibility tests in E2E context

