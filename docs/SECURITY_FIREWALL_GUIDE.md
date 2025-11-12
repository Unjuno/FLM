# ファイアウォール設定ガイド

このドキュメントは、FLMを外部公開する際のファイアウォール設定方法を説明します。

---

## 目次

1. [概要](#概要)
2. [IPホワイトリスト機能](#ipホワイトリスト機能)
3. [OS別ファイアウォール設定](#os別ファイアウォール設定)
4. [セキュリティベストプラクティス](#セキュリティベストプラクティス)

---

## 概要

FLMを外部公開する場合、以下のセキュリティ対策を実施することを強く推奨します：

1. **IPホワイトリスト機能の使用**（推奨）
2. **OSレベルのファイアウォール設定**
3. **APIキー認証の有効化**
4. **HTTPSの使用**

---

## IPホワイトリスト機能

### 概要

FLMには、IPホワイトリスト機能が実装されています。この機能を使用することで、許可されたIPアドレスのみアクセスを許可できます。

### 設定方法

#### 環境変数による設定

認証プロキシサーバー起動時に、以下の環境変数を設定してください：

```bash
# IPホワイトリストを有効化
ENABLE_IP_WHITELIST=1

# 許可するIPアドレスを指定（カンマ区切り）
IP_WHITELIST=192.168.1.100,10.0.0.50,203.0.113.0/24
```

#### CIDR表記のサポート

IPホワイトリストでは、CIDR表記を使用してIPアドレスの範囲を指定できます：

- `192.168.1.100` - 単一のIPアドレス
- `192.168.1.0/24` - 192.168.1.0 から 192.168.1.255 までの範囲
- `10.0.0.0/8` - 10.0.0.0 から 10.255.255.255 までの範囲

#### 設定例

**例1: 単一のIPアドレスを許可**
```bash
ENABLE_IP_WHITELIST=1
IP_WHITELIST=203.0.113.50
```

**例2: 複数のIPアドレスを許可**
```bash
ENABLE_IP_WHITELIST=1
IP_WHITELIST=203.0.113.50,203.0.113.51,203.0.113.52
```

**例3: IPアドレス範囲を許可**
```bash
ENABLE_IP_WHITELIST=1
IP_WHITELIST=192.168.1.0/24,10.0.0.0/8
```

**例4: 単一IPアドレスと範囲の組み合わせ**
```bash
ENABLE_IP_WHITELIST=1
IP_WHITELIST=203.0.113.50,192.168.1.0/24
```

### 注意事項

- **localhostは常に許可**: `127.0.0.1`、`::1`、`localhost`は常にアクセス可能です
- **ヘルスチェックエンドポイント**: `/health`エンドポイントはIPホワイトリストの対象外です
- **ホワイトリストが空の場合**: IPホワイトリストが有効でホワイトリストが空の場合、すべてのアクセスが拒否されます

---

## OS別ファイアウォール設定

### Windows

#### Windows Defender ファイアウォール

1. **コントロールパネル** → **システムとセキュリティ** → **Windows Defender ファイアウォール**
2. **詳細設定**をクリック
3. **受信の規則** → **新しい規則**
4. **ポート**を選択 → **次へ**
5. **TCP**を選択し、ポート番号を入力（例: 8080, 8081）
6. **接続を許可する**を選択 → **次へ**
7. **ドメイン**、**プライベート**、**パブリック**のいずれかを選択 → **次へ**
8. 規則に名前を付けて完了

#### PowerShellコマンド

```powershell
# ポート8080を許可（特定のIPアドレスのみ）
New-NetFirewallRule -DisplayName "FLM API - Port 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow -RemoteAddress 203.0.113.50

# ポート8081を許可（特定のIPアドレスのみ）
New-NetFirewallRule -DisplayName "FLM API - Port 8081" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow -RemoteAddress 203.0.113.50

# ポート範囲を許可（CIDR表記は使用できないため、個別に設定）
New-NetFirewallRule -DisplayName "FLM API - Port 8080-8081" -Direction Inbound -LocalPort 8080,8081 -Protocol TCP -Action Allow -RemoteAddress 192.168.1.0/24
```

### macOS

#### システム設定

1. **システム設定** → **ネットワーク** → **ファイアウォール**
2. **ファイアウォールオプション**をクリック
3. **+**ボタンをクリックしてアプリケーションを追加
4. FLMアプリケーションを選択
5. **接続を許可**を選択

#### コマンドライン（pfctl）

```bash
# ポート8080を許可（特定のIPアドレスのみ）
sudo pfctl -a flm -f - <<EOF
pass in on en0 proto tcp from 203.0.113.50 to any port 8080
pass in on en0 proto tcp from 203.0.113.50 to any port 8081
EOF
```

### Linux

#### UFW (Ubuntu Firewall)

```bash
# ポート8080を許可（特定のIPアドレスのみ）
sudo ufw allow from 203.0.113.50 to any port 8080
sudo ufw allow from 203.0.113.50 to any port 8081

# IPアドレス範囲を許可（CIDR表記）
sudo ufw allow from 192.168.1.0/24 to any port 8080
sudo ufw allow from 192.168.1.0/24 to any port 8081

# ファイアウォールを有効化
sudo ufw enable
```

#### firewalld (CentOS/RHEL)

```bash
# ポート8080を許可（特定のIPアドレスのみ）
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="203.0.113.50" port protocol="tcp" port="8080" accept'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="203.0.113.50" port protocol="tcp" port="8081" accept'

# IPアドレス範囲を許可
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="8080" accept'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="8081" accept'

# 設定を再読み込み
sudo firewall-cmd --reload
```

#### iptables

```bash
# ポート8080を許可（特定のIPアドレスのみ）
sudo iptables -A INPUT -p tcp -s 203.0.113.50 --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp -s 203.0.113.50 --dport 8081 -j ACCEPT

# IPアドレス範囲を許可
sudo iptables -A INPUT -p tcp -s 192.168.1.0/24 --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp -s 192.168.1.0/24 --dport 8081 -j ACCEPT

# その他のアクセスを拒否（既存のルールを確認してから実行）
sudo iptables -A INPUT -p tcp --dport 8080 -j DROP
sudo iptables -A INPUT -p tcp --dport 8081 -j DROP
```

---

## セキュリティベストプラクティス

### 1. 多層防御の実装

以下のセキュリティ対策を組み合わせて使用することを推奨します：

1. **IPホワイトリスト機能**（アプリケーションレベル）
2. **OSレベルのファイアウォール**（システムレベル）
3. **APIキー認証**（アプリケーションレベル）
4. **HTTPS**（通信の暗号化）

### 2. 最小権限の原則

- 必要なIPアドレスのみを許可
- 不要なポートは開放しない
- 定期的にアクセスログを確認

### 3. 定期的な監査

- アクセスログの定期的な確認
- 許可されたIPアドレスの見直し
- セキュリティアップデートの実施

### 4. ネットワークセグメンテーション

可能な場合は、FLMを専用のネットワークセグメントに配置し、必要な通信のみを許可してください。

---

## トラブルシューティング

### IPホワイトリストが機能しない

1. **環境変数の確認**
   - `ENABLE_IP_WHITELIST=1`が設定されているか確認
   - `IP_WHITELIST`に正しいIPアドレスが設定されているか確認

2. **ログの確認**
   - サーバーのログでIPアドレスが正しく取得されているか確認
   - 拒否されたIPアドレスがログに記録されているか確認

3. **プロキシ経由のアクセス**
   - リバースプロキシ経由でアクセスする場合、`X-Forwarded-For`ヘッダーが正しく設定されているか確認

### ファイアウォール設定が機能しない

1. **ファイアウォールの状態確認**
   - ファイアウォールが有効になっているか確認
   - ルールが正しく適用されているか確認

2. **ポートの確認**
   - 使用しているポート番号が正しいか確認
   - 他のアプリケーションがポートを使用していないか確認

3. **ネットワーク設定の確認**
   - ネットワークインターフェースが正しく設定されているか確認
   - ルーティング設定が正しいか確認

---

## 参考資料

- [Windows Defender ファイアウォール](https://support.microsoft.com/ja-jp/windows/windows-%E3%82%B7%E3%83%A5%E3%83%BC%E3%82%BF%E3%83%BC%E3%81%AE%E3%83%95%E3%82%A1%E3%82%A4%E3%82%A2%E3%82%A6%E3%82%A9%E3%83%BC%E3%83%AB%E3%82%92%E9%96%8B%E3%81%8B%E3%81%AA%E3%81%84%E3%81%A7%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84-9420422a-8e21-47eb-986b-d5a3b873cd44)
- [macOS ファイアウォール](https://support.apple.com/ja-jp/guide/mac-help/mh11783/mac)
- [UFW (Ubuntu Firewall)](https://help.ubuntu.com/community/UFW)
- [firewalld (CentOS/RHEL)](https://access.redhat.com/documentation/ja-jp/red_hat_enterprise_linux/8/html/securing_networks/using-and-configuring-firewalld_securing-networks)

---

**最終更新日**: 2025年1月

