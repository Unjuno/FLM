// Network Utilities
// ネットワーク関連のユーティリティ関数

use std::net::Ipv4Addr;

/// ローカルネットワークIPアドレスを取得
/// プライベートIPアドレス（192.168.x.x, 10.x.x.x, 172.16-31.x.x）を優先して返します
pub fn get_local_ip_address() -> Option<String> {
    // まず、通常の接続を試みてローカルIPを取得
    // Windows/macOS/Linuxで共通の方法
    if let Ok(interfaces) = get_network_interfaces() {
        // プライベートIPアドレスを優先
        for ip in &interfaces {
            if is_private_ip(ip) {
                return Some(ip.clone());
            }
        }
        
        // プライベートIPがない場合は最初のIPv4を返す
        if let Some(first_ip) = interfaces.first() {
            return Some(first_ip.clone());
        }
    }
    
    None
}

/// ネットワークインターフェースのIPアドレス一覧を取得
#[cfg(target_os = "windows")]
fn get_network_interfaces() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    use std::process::Command;
    
    let output = Command::new("ipconfig")
        .output()?;
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut ips = Vec::new();
    
    for line in output_str.lines() {
        if line.contains("IPv4") || line.contains("IPv4 アドレス") {
            if let Some(ip_str) = line.split(':').nth(1) {
                let ip = ip_str.trim().to_string();
                if ip.parse::<Ipv4Addr>().is_ok() {
                    ips.push(ip);
                }
            }
        }
    }
    
    Ok(ips)
}

#[cfg(not(target_os = "windows"))]
fn get_network_interfaces() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    use std::process::Command;
    
    // Linux/macOSでifconfigまたはipコマンドを使用
    let output = if cfg!(target_os = "linux") {
        Command::new("ip")
            .arg("addr")
            .arg("show")
            .output()?
    } else {
        // macOS
        Command::new("ifconfig")
            .output()?
    };
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut ips = Vec::new();
    
    for line in output_str.lines() {
        if line.contains("inet ") && !line.contains("127.0.0.1") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            for part in parts {
                if part.starts_with("inet") {
                    continue;
                }
                // IPv4アドレスの形式をチェック（x.x.x.x）
                if part.contains('.') && !part.contains(':') {
                    let ip_str = part.split('/').next().unwrap_or(part).to_string();
                    if ip_str.parse::<Ipv4Addr>().is_ok() && ip_str != "127.0.0.1" {
                        ips.push(ip_str);
                        break;
                    }
                }
            }
        }
    }
    
    Ok(ips)
}

/// IPアドレスがプライベート（ローカルネットワーク用）かどうかを判定
fn is_private_ip(ip_str: &str) -> bool {
    if let Ok(ip) = ip_str.parse::<Ipv4Addr>() {
        let octets = ip.octets();
        
        // 192.168.x.x
        if octets[0] == 192 && octets[1] == 168 {
            return true;
        }
        
        // 10.x.x.x
        if octets[0] == 10 {
            return true;
        }
        
        // 172.16.x.x - 172.31.x.x
        if octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31 {
            return true;
        }
    }
    
    false
}

/// エンドポイントURLを生成（HTTP/HTTPS、ローカルIPとlocalhostの両方を含む）
pub fn format_endpoint_url(port: u16, api_id: Option<&str>) -> String {
    let local_ip = get_local_ip_address();
    let has_https = api_id.map(|id| crate::utils::certificate::certificate_exists(id)).unwrap_or(false);
    
    let protocol = if has_https { "https" } else { "http" };
    let https_port = if has_https { port + 1 } else { port };
    
    if let Some(ip) = local_ip {
        if has_https {
            format!("{protocol}://localhost:{https_port} または {protocol}://{ip}:{https_port} (HTTP→HTTPS自動リダイレクト: http://localhost:{port})")
        } else {
            format!("{protocol}://localhost:{port} または {protocol}://{ip}:{port}")
        }
    } else {
        if has_https {
            format!("{protocol}://localhost:{https_port} (HTTP→HTTPS自動リダイレクト: http://localhost:{port})")
        } else {
            format!("{protocol}://localhost:{port}")
        }
    }
}

/// エンドポイントURL（ローカルIPのみ）を生成
pub fn format_external_endpoint_url(port: u16, api_id: Option<&str>) -> Option<String> {
    let local_ip = get_local_ip_address()?;
    let has_https = api_id.map(|id| crate::utils::certificate::certificate_exists(id)).unwrap_or(false);
    let protocol = if has_https { "https" } else { "http" };
    let https_port = if has_https { port + 1 } else { port };
    Some(format!("{protocol}://{local_ip}:{https_port}"))
}


