//! Mock SOCKS5 server for testing Tor/SOCKS5 egress functionality
//!
//! This module provides a minimal SOCKS5 server implementation for testing
//! proxy egress modes (Tor and CustomSocks5).

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

/// SOCKS5 protocol constants
const SOCKS5_VERSION: u8 = 0x05;
const SOCKS5_AUTH_NONE: u8 = 0x00;
const SOCKS5_CMD_CONNECT: u8 = 0x01;
const SOCKS5_ATYP_IPV4: u8 = 0x01;
const SOCKS5_ATYP_DOMAIN: u8 = 0x03;
const SOCKS5_REP_SUCCESS: u8 = 0x00;
const SOCKS5_REP_CONNECTION_REFUSED: u8 = 0x05;

/// Mock SOCKS5 server handle
pub struct MockSocks5Server {
    port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
    handle: Option<tokio::task::JoinHandle<()>>,
}

impl MockSocks5Server {
    /// Start a mock SOCKS5 server on the specified port
    pub async fn start(port: u16) -> Result<Self, std::io::Error> {
        let listener = TcpListener::bind(format!("127.0.0.1:{port}")).await?;
        let actual_port = listener.local_addr()?.port();

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let mut shutdown_rx = shutdown_rx;

        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, _)) => {
                                tokio::spawn(handle_socks5_connection(stream));
                            }
                            Err(_) => break,
                        }
                    }
                    _ = &mut shutdown_rx => {
                        break;
                    }
                }
            }
        });

        Ok(Self {
            port: actual_port,
            shutdown_tx: Some(shutdown_tx),
            handle: Some(handle),
        })
    }

    /// Get the port the server is listening on
    pub fn port(&self) -> u16 {
        self.port
    }

    /// Get the endpoint string (host:port)
    pub fn endpoint(&self) -> String {
        format!("127.0.0.1:{}", self.port)
    }

    /// Stop the mock server
    pub async fn stop(self) {
        if let Some(tx) = self.shutdown_tx {
            let _ = tx.send(());
        }
        if let Some(handle) = self.handle {
            let _ = handle.await;
        }
    }
}

/// Handle a SOCKS5 connection
async fn handle_socks5_connection(mut stream: TcpStream) {
    // SOCKS5 handshake: client sends version and authentication methods
    let mut buf = [0u8; 2];
    if stream.read_exact(&mut buf).await.is_err() {
        return;
    }

    let version = buf[0];
    let num_methods = buf[1];

    if version != SOCKS5_VERSION {
        return;
    }

    // Read authentication methods
    let mut methods = vec![0u8; num_methods as usize];
    if stream.read_exact(&mut methods).await.is_err() {
        return;
    }

    // Respond with "no authentication required"
    let response = [SOCKS5_VERSION, SOCKS5_AUTH_NONE];
    if stream.write_all(&response).await.is_err() {
        return;
    }

    // SOCKS5 request: client sends connection request
    let mut request_buf = [0u8; 4];
    if stream.read_exact(&mut request_buf).await.is_err() {
        return;
    }

    let cmd = request_buf[1];
    let atyp = request_buf[3];

    if cmd != SOCKS5_CMD_CONNECT {
        // Send error response
        let error_response = [
            SOCKS5_VERSION,
            SOCKS5_REP_CONNECTION_REFUSED,
            0x00,
            SOCKS5_ATYP_IPV4,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
        ];
        let _ = stream.write_all(&error_response).await;
        return;
    }

    // Read address based on address type
    let mut addr_buf = Vec::new();
    match atyp {
        SOCKS5_ATYP_IPV4 => {
            addr_buf.resize(4 + 2, 0); // IPv4 + port
        }
        SOCKS5_ATYP_DOMAIN => {
            let mut len_buf = [0u8; 1];
            if stream.read_exact(&mut len_buf).await.is_err() {
                return;
            }
            let domain_len = len_buf[0] as usize;
            addr_buf.resize(domain_len + 2, 0); // domain + port
        }
        _ => {
            // Unsupported address type
            return;
        }
    }

    if stream.read_exact(&mut addr_buf).await.is_err() {
        return;
    }

    // Send success response
    let success_response = [
        SOCKS5_VERSION,
        SOCKS5_REP_SUCCESS,
        0x00,
        SOCKS5_ATYP_IPV4,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
    ];

    if stream.write_all(&success_response).await.is_err() {
        return;
    }

    // Keep connection alive for a short time to simulate successful connection
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
}

/// Helper function to verify SOCKS5 endpoint connectivity
pub async fn verify_socks5_endpoint(endpoint: &str) -> Result<(), String> {
    use std::time::Duration;
    use tokio::time::timeout;

    match timeout(Duration::from_secs(3), TcpStream::connect(endpoint)).await {
        Ok(Ok(_stream)) => Ok(()),
        Ok(Err(e)) => Err(format!("Connection failed: {e}")),
        Err(_) => Err("Connection timeout".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_socks5_server_start_stop() {
        let server = MockSocks5Server::start(0).await.unwrap();
        let port = server.port();
        assert!(port > 0);

        // Verify endpoint is reachable
        let endpoint = server.endpoint();
        let result = verify_socks5_endpoint(&endpoint).await;
        assert!(result.is_ok(), "Mock server should be reachable");

        server.stop().await;
    }

    #[tokio::test]
    async fn test_mock_socks5_server_multiple_connections() {
        let server = MockSocks5Server::start(0).await.unwrap();
        let endpoint = server.endpoint();

        // Try multiple connections
        for _ in 0..3 {
            let result = verify_socks5_endpoint(&endpoint).await;
            assert!(result.is_ok(), "Should be able to connect multiple times");
        }

        server.stop().await;
    }
}
