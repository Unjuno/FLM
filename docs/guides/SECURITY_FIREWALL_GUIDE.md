# SECURITY_FIREWALL_GUIDE
> Status: Canonical | Audience: UI backend / Ops | Updated: 2025-11-20

外部公開時に必要となる OS レベルのファイアウォール設定と、Setup Wizard Step 4 が自動生成・実行する処理を定義する。

## 1. 前提
- `ProxyService::status` で取得した待受ポート群（デフォルト: `[8080, 8081]`）と、`SecurityService::get_policy` が返す `SecurityPolicy.policy_json` 内の `ip_whitelist`（IPv4/IPv6 混在可）を入力にする。
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
- `system_firewall_preview(os, ports, ip_whitelist)` → `{ script: String, shell: "powershell" | "bash" }` （ports は `[8080,8081]` など複数値。`ip_whitelist` は `SecurityPolicy.policy_json` から取得した配列。スクリプトはすべての組み合わせを生成）
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

## 8. 証明書管理（packaged-ca モード）

### 8.1 インストール時の自動登録

パッケージ版では、インストール時にルートCA証明書 (`flm-ca.crt`) がOS信頼ストアへ自動登録されます。これにより、ブラウザ警告なしでHTTPS通信が可能になります。

**Windows**:
```powershell
# インストーラが自動実行（UAC確認あり）
Import-Certificate -FilePath "$INSTDIR\flm-ca.crt" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

**macOS**:
```bash
# インストーラが自動実行（sudo確認あり）
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  "$INSTDIR/flm-ca.crt"
```

**Linux**:
```bash
# インストーラが自動実行（sudo確認あり）
sudo cp flm-ca.crt /usr/local/share/ca-certificates/flm-ca.crt
sudo update-ca-certificates
```

### 8.2 証明書の削除（アンインストール時）

アンインストール時に証明書を削除する場合は、以下のいずれかの方法を使用できます。

#### 方法1: アンインストールスクリプトを使用（推奨）

**Windows (PowerShell)**:
```powershell
# アンインストールスクリプトを実行
.\resources\scripts\uninstall-ca.ps1

# 確認なしで削除
.\resources\scripts\uninstall-ca.ps1 -Force
```

**macOS/Linux**:
```bash
# アンインストールスクリプトを実行
./resources/scripts/uninstall-ca.sh
```

#### 方法2: 手動削除

**Windows**:
```powershell
Get-ChildItem Cert:\LocalMachine\Root | 
  Where-Object { $_.Subject -like "*FLM Local CA*" } | 
  Remove-Item
```

**macOS**:
```bash
sudo security delete-certificate -c "FLM Local CA" /Library/Keychains/System.keychain
```

**Linux**:
```bash
sudo rm /usr/local/share/ca-certificates/flm-ca.crt
sudo update-ca-certificates
```

### 8.3 証明書の確認

インストール済みの証明書を確認する方法:

**Windows**:
```powershell
Get-ChildItem Cert:\LocalMachine\Root | 
  Where-Object { $_.Subject -like "*FLM Local CA*" }
```

**macOS**:
```bash
security find-certificate -c "FLM Local CA" -a /Library/Keychains/System.keychain
```

**Linux**:
```bash
ls -la /usr/local/share/ca-certificates/flm-ca.crt
```

### 8.4 ローテーション

ルートCA証明書の有効期限（10年）が近づいた場合、新バージョンのインストールで新しいルートCAが自動的に配布されます。アプリ起動時に期限切れ警告が表示される場合は、最新版へのアップデートを推奨します。

## 9. パッケージングのセキュリティ検証

### 9.1 ダウンロード後の検証

パッケージをダウンロードした後、以下の方法で整合性を検証することを推奨します。

#### ハッシュ値の確認

**Windows**:
```powershell
certutil -hashfile flm-installer.exe SHA256
# 出力されたハッシュ値を公式サイトの値と比較
```

**macOS/Linux**:
```bash
shasum -a 256 flm-installer.dmg
# または
sha256sum flm-installer.dmg
# 出力されたハッシュ値を公式サイトの値と比較
```

#### 署名の確認

**Windows**:
1. インストーラファイルを右クリック
2. 「プロパティ」を選択
3. 「デジタル署名」タブを確認
4. 署名が有効であることを確認

**macOS**:
```bash
codesign -vv flm-installer.dmg
# 出力に "satisfies its Designated Requirement" と表示されれば有効
```

**Linux** (将来実装):
```bash
gpg --verify flm-installer.AppImage.asc flm-installer.AppImage
```

### 9.2 インストール時の確認

インストール中に表示される確認ダイアログを必ず確認してください:

* **証明書のインストール確認**: 「FLM Local CA 証明書を信頼しますか？」というダイアログが表示された場合、信頼できるソースからのインストールであることを確認してから「はい」を選択
* **管理者権限の確認**: UAC/sudo の確認が表示された場合、インストーラが管理者権限を要求している理由を理解してから許可

### 9.3 インストール後の検証

インストール後、以下の方法で証明書が正しくインストールされたことを確認できます:

**Windows**:
```powershell
Get-ChildItem Cert:\LocalMachine\Root | 
  Where-Object { $_.Subject -like "*FLM Local CA*" }
```

**macOS**:
```bash
security find-certificate -c "FLM Local CA" -a /Library/Keychains/System.keychain
```

**Linux**:
```bash
ls -la /usr/local/share/ca-certificates/flm-ca.crt
```

### 9.4 セキュリティインシデント時の対応

パッケージの改ざんや秘密鍵の漏洩が疑われる場合:

1. **即座にインストールを中止**: 疑わしいパッケージはインストールしない
2. **公式サイトで確認**: 公式サイトでセキュリティ情報を確認
3. **証明書の削除**: 既にインストール済みの場合は、セクション8.2の手順で証明書を削除
4. **報告**: セキュリティインシデントを報告（GitHub Issues またはセキュリティ連絡先）

---
このガイドは Phase2 以降も随時更新する。

