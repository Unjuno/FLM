# SECURITY_FIREWALL_GUIDE
> Status: Canonical | Audience: UI backend / Ops | Updated: 2025-11-18

外部公開時に必要となる OS レベルのファイアウォール設定と、Setup Wizard Step 4 が自動生成・実行する処理を定義する。

## 1. 前提
- `ProxyService::status` で取得した待受ポート（デフォルト: HTTP 8080 / HTTPS 8081）と、`SecurityService::policy_get` で取得した許可 IP / CIDR を対象とする。
- Wizard は OS 判定後、`system_firewall_preview` でスクリプト文字列を生成し、「管理者権限で適用」で昇格済みシェル経由の `system_firewall_apply` を実行する。
- 昇格を拒否された場合は本ガイドの手順を案内し、ユーザーまたは管理者に手動実行してもらう。
- 適用前にバックアップ（例: `netsh advfirewall export`, `sudo pfctl -sr`, `sudo ufw status numbered`）を推奨。

## 2. Windows
### 2.1 操作概要
1. Step 4 のプレビューでポート / 許可 IP を確認。
2. 「管理者権限で適用」を押し、UAC ダイアログを許可。
3. `New-NetFirewallRule` の stdout/stderr/exit code を Wizard が表示。失敗時はここにある手動手順を提示。

### 2.2 手動コマンド例
```powershell
New-NetFirewallRule `
  -DisplayName "FLM Proxy HTTPS" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort <PORT> `
  -RemoteAddress <CIDR/IP>
```
削除:
```powershell
Remove-NetFirewallRule -DisplayName "FLM Proxy HTTPS"
```

## 3. macOS
### 3.1 操作概要
- `pfctl` アンカー（例: `/etc/pf.anchors/flm`）を生成し、`/etc/pf.conf` から `anchor "flm"` を参照。
- Wizard は `sudo` 昇格で `pfctl -f /etc/pf.conf && pfctl -e` を実行。パスワード入力は OS 標準ダイアログに任せる。

### 3.2 手動コマンド例
```bash
sudo tee /etc/pf.anchors/flm >/dev/null <<'EOF'
pass in proto tcp from <CIDR/IP> to any port <PORT> keep state
EOF
sudo pfctl -f /etc/pf.conf && sudo pfctl -e
```

## 4. Linux
### 4.1 UFW (Ubuntu 等)
```bash
sudo ufw allow proto tcp from <CIDR/IP> to any port <PORT> comment 'FLM Proxy'
sudo ufw reload
```
削除:
```bash
sudo ufw delete allow proto tcp from <CIDR/IP> to any port <PORT>
```

### 4.2 firewalld (CentOS/RHEL 等)
```bash
sudo firewall-cmd --permanent \
  --add-rich-rule="rule family='ipv4' source address='<CIDR/IP>' port protocol='tcp' port='<PORT>' accept"
sudo firewall-cmd --reload
```

### 4.3 iptables
`ufw`/`firewalld` が無効な環境のみ提示する。
```bash
sudo iptables -A INPUT -p tcp -s <CIDR/IP> --dport <PORT> -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

## 5. Wizard 連携
- プレビューカードには OS 名、ポート、許可 IP、生成スクリプト、Shell 種別（PowerShell / bash 等）を表示し、「Apply / Copy / Save」を提供。
- `system_firewall_preview(os, port, allowed_ips)` → `{ script: String, shell: "powershell" | "bash" }`
- `system_firewall_apply(script, shell)` → `{ stdout: String, stderr: String, exit_code: i32 }`
- exit_code ≠ 0 の場合は失敗扱いとし、本ガイド該当章と手動チェックを案内する。

## 6. 手動チェック
- `nmap <host> -p <port>` または `Test-NetConnection -ComputerName <host> -Port <port>` で開放状態を検証。
- Proxy 停止時は不要なルールを削除し、露出を最小化する。
- ルール適用ログは Wizard から `logs/security/firewall-<timestamp>.log` へ追記する。

## 7. トラブルシューティング
- **権限不足**: 昇格ダイアログを許可していない。管理者セッションで再実行。
- **重複ルール**: 同名ルールが存在する場合は一度削除してから適用。
- **外部未到達**: OS ファイアウォール以外（ルーター / クラウド SG）のポート開放も確認。

---
このガイドは Phase2 以降も随時更新する。

