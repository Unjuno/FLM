# Load Test Scripts

This directory contains k6 load test scripts for the FLM proxy server.

## Scripts

### `k6-basic.js`
Basic load test with sustained 100 req/min load.
- **Duration**: ~12 minutes
- **Load**: 120 req/min sustained
- **Metrics**: P50, P95, P99 latency, error rate

### `k6-stress.js`
Stress test with peak and extreme load.
- **Duration**: ~16 minutes
- **Load**: 480 req/min peak, 1020 req/min stress
- **Metrics**: P95, P99 latency, error rate (relaxed thresholds)

### `k6-memory.js`
Long-running test for memory leak detection.
- **Duration**: ~70 minutes (1 hour sustained)
- **Load**: 120 req/min sustained
- **Metrics**: Response time stability, error rate

### `k6-concurrent.js`
Concurrent connections test.
- **Duration**: ~19 minutes
- **Load**: 10, 50, 100 concurrent connections
- **Metrics**: P50, P95, P99 latency, error rate

## Prerequisites

- k6: https://k6.io/docs/getting-started/installation/
- FLM proxy running on port 9000 (or specify with `PROXY_URL`)

## Usage

### Basic Load Test
```bash
PROXY_URL=http://localhost:9000 API_KEY=your-api-key k6 run scripts/load-test/k6-basic.js
```

### Stress Test
```bash
PROXY_URL=http://localhost:9000 API_KEY=your-api-key k6 run scripts/load-test/k6-stress.js
```

### Memory Leak Detection
```bash
PROXY_URL=http://localhost:9000 API_KEY=your-api-key k6 run scripts/load-test/k6-memory.js
```

### Concurrent Connections Test
```bash
PROXY_URL=http://localhost:9000 API_KEY=your-api-key k6 run scripts/load-test/k6-concurrent.js
```

## Environment Variables

- `PROXY_URL`: Proxy server URL (default: `http://localhost:9000`)
- `API_KEY`: API key for authenticated endpoints (optional)

## Output

Results are displayed in the console. For JSON output, use:

```bash
k6 run --out json=results.json scripts/load-test/k6-basic.js
```

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines using the existing `ci-proxy-load.sh` or `ci-proxy-load.ps1` scripts, or directly in GitHub Actions workflows.

