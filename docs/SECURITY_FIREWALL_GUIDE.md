# SECURITY_FIREWALL_GUIDE
> Status: Canonical | Audience: UI backend / Ops | Updated: 2025-11-18

外部公開時に必要となる OS レベルのファイアウォール設定と、Setup Wizard Step 4 が自動生成・実行する処理を定義する。

## 1. 前提
- `ProxyService::status` で取得した待受ポート群（デフォルト: `[8080, 8081]`）と、`SecurityService::get_policy` の `allowed_ips`（IPv4/IPv6 混在可）を入力にする。
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
$ports = @(8080, 8081)                 # HTTP / HTTPS
$cidrs = @("203.0.113.0/24", "2001:db8::/48")
foreach ($port in $ports) {
  foreach ($cidr in $cidrs) {
    New-NetFirewallRule `
      -DisplayName "FLM Proxy $port $cidr" `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort $port `
      -RemoteAddress $cidr
  }
}
```
削除（Wizardは display_name を "FLM Proxy <port> <cidr>" 形式で付与）:
```powershell
Get-NetFirewallRule -DisplayName "FLM Proxy *" | Remove-NetFirewallRule
```

## 3. macOS
### 3.1 操作概要
- `pfctl` アンカー（例: `/etc/pf.anchors/flm`）を生成し、`/etc/pf.conf` から `anchor "flm"` を参照。
- Wizard は `sudo` 昇格で `pfctl -f /etc/pf.conf && pfctl -e` を実行。パスワード入力は OS 標準ダイアログに任せる。

### 3.2 手動コマンド例
```bash
sudo tee /etc/pf.anchors/flm >/dev/null <<'EOF'
table <flm_allow> persist { 203.0.113.0/24, 2001:db8::/48 }
pass in proto tcp from <flm_allow> to any port { 8080 8081 } keep state
EOF
sudo pfctl -f /etc/pf.conf && sudo pfctl -e
```

## 4. Linux
### 4.1 UFW (Ubuntu 等)
```bash
for cidr in 203.0.113.0/24 2001:db8::/48; do
  sudo ufw allow proto tcp from "$cidr" to any port 8080 comment 'FLM Proxy HTTP'
  sudo ufw allow proto tcp from "$cidr" to any port 8081 comment 'FLM Proxy HTTPS'
done
sudo ufw reload
```
削除:
```bash
sudo ufw status numbered  # 番号を確認
sudo ufw delete <RULE_NUMBER>
```

### 4.2 firewalld (CentOS/RHEL 等)
```bash
for cidr in 203.0.113.0/24 2001:db8::/48; do
  family=$( [[ $cidr == *:* ]] && echo ipv6 || echo ipv4 )
  for port in 8080 8081; do
    sudo firewall-cmd --permanent \
      --add-rich-rule="rule family='${family}' source address='${cidr}' port protocol='tcp' port='${port}' accept"
  done
done
sudo firewall-cmd --reload
```

### 4.3 iptables
`ufw`/`firewalld` が無効な環境のみ提示する。
```bash
sudo iptables -A INPUT -p tcp -s 203.0.113.0/24 -m multiport --dports 8080,8081 -j ACCEPT
sudo ip6tables -A INPUT -p tcp -s 2001:db8::/48 -m multiport --dports 8080,8081 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
sudo ip6tables-save | sudo tee /etc/iptables/rules.v6
```

## 5. Wizard 連携
- プレビューカードには OS 名、ポート、許可 IP、生成スクリプト、Shell 種別（PowerShell / bash 等）を表示し、「Apply / Copy / Save」を提供。
- `system_firewall_preview(os, ports, allowed_ips)` → `{ script: String, shell: "powershell" | "bash" }` （ports は `[8080,8081]` など複数値。スクリプトはすべての組み合わせを生成）
- `system_firewall_apply(script, shell)` → `{ stdout: String, stderr: String, exit_code: i32 }`
- exit_code ≠ 0 の場合は失敗扱いとし、本ガイド該当章と手動チェックを案内する。
- Wizard バックエンドは `AppData/flm/logs/security/`（OS別の標準アプリデータ配下）に `firewall-<timestamp>.log` を保存し、ディレクトリが無ければ作成する。アクセス権はユーザー権限(700/600相当)で管理し、CLI からは読み書きしない。

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

