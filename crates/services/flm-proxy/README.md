# flm-proxy

FLM Proxy Server - Secure HTTP(S) proxy for LLM engines.

This crate provides:
- Axum-based HTTP/HTTPS proxy server
- Authentication middleware (Bearer API Key)
- Security features (IP blocklist, anomaly detection, rate limiting)
- OpenAI-compatible API endpoints (`/v1/chat/completions`, `/v1/models`)
- Multiple proxy modes (local-http, dev-selfsigned, https-acme, packaged-ca)

## Status

Phase 1B: Core proxy functionality completed.
- ✅ HTTP/HTTPS proxy server implementation
- ✅ Authentication middleware
- ✅ Security features (IP blocklist, intrusion detection, anomaly detection)
- ✅ OpenAI-compatible API endpoints
- ✅ Integration with EngineService and SecurityService
- ✅ Multiple proxy modes support
- ⏳ Packaged-CA mode (Phase 3)

## Architecture

```
flm-proxy/
├── src/
│   ├── controller.rs      # AxumProxyController - main proxy controller
│   ├── middleware.rs      # Authentication, rate limiting, CORS middleware
│   ├── security/          # Security features
│   │   ├── ip_blocklist.rs
│   │   ├── intrusion_detection.rs
│   │   ├── anomaly_detection.rs
│   │   └── resource_protection.rs
│   ├── adapters.rs        # Adapter implementations
│   ├── engine_repo.rs     # Engine repository integration
│   ├── http_client.rs     # HTTP client for forwarding requests
│   ├── process_controller.rs  # Process controller integration
│   └── daemon.rs          # Daemon mode support
└── tests/
    ├── integration_test.rs    # Integration tests
    └── botnet_security_test.rs  # Security feature tests
```

## Proxy Modes

### `local-http`
- Local network only, no TLS
- Default mode for development
- Binds to `127.0.0.1` by default

### `dev-selfsigned`
- Self-signed certificate for HTTPS
- LAN / development use only
- Requires manual certificate installation

### `https-acme`
- ACME (Let's Encrypt) certificate issuance
- For internet-facing deployments
- Supports HTTP-01 and DNS-01 challenges

### `packaged-ca` (Phase 3)
- Package-bundled root CA certificate
- Auto-installed to OS trust store
- For general distribution

## API Endpoints

- `POST /v1/chat/completions` - OpenAI-compatible chat completions
- `GET /v1/models` - List available models
- `GET /health` - Health check endpoint

## Security Features

- **IP Blocklist**: Automatic blocking of suspicious IPs
- **Intrusion Detection**: Pattern-based attack detection
- **Anomaly Detection**: Behavioral anomaly detection
- **Rate Limiting**: Per-IP and per-API-key rate limiting
- **Resource Protection**: CPU and memory usage monitoring

## Usage

The proxy is typically started via the CLI:

```bash
flm proxy start --mode local-http --port 8080
```

For daemon mode:

```bash
flm proxy start --mode https-acme --domain example.com --email admin@example.com
```

See `docs/specs/PROXY_SPEC.md` for complete specification.

