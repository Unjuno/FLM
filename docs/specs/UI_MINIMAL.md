# FLM Minimal UI Specification
> Status: Canonical | Audience: UI engineers | Updated: 2025-11-20

## 1. 目的と基本方針
- 対象ユーザー: 個人利用・シングルユーザー環境（マルチユーザー/RBAC非対応）
- Phase 2 で実装する最小 UI の範囲と要件を明確化し、CLI と同等の機能を GUI から操作できるようにする。
- 設定・状態取得・キー管理などのコア操作は Rust Core API（EngineService / ProxyService / SecurityService / ConfigService）を IPC 経由で呼び出し、CLI subprocess の起動は禁止。チャット疎通確認のみ Proxy の HTTP エンドポイントを直接呼び出す。
- UI はステータス表示と操作トリガーに徹し、追加ロジックは持たない。

## 2. 主要タブと機能

### Dashboard
| 項目 | 内容 | Core API |
|------|------|----------|
| Engine Status | すべてのエンジンの状態、レイテンシ、Capabilities を一覧表示 | `EngineService::detect_engines` |
| Proxy Status | 現在のモード/ポート/ACMEドメイン/Listenアドレス、Start/Stop ボタン | `ProxyService::status` |
| Security Alerts | APIキー数、IPホワイトリスト設定、レート制限設定の有無など | `SecurityService::list_api_keys`, `SecurityService::list_policies` |

**Proxy Status のエンドポイントURL表示**:
- `ProxyHandle.listen_addr` が `0.0.0.0` または `::` の場合、技術的なバインドアドレスをそのまま表示しない
- ユーザー向けに実際に使用可能なURLを表示:
  - **ローカルアクセス用**: `http://localhost:{port}` または `https://localhost:{https_port}`
  - **同一ネットワーク内アクセス用**: `http://{local_ip}:{port}` または `https://{local_ip}:{https_port}`
    （`local_ip` は OS のネットワークインターフェースから取得した実際のIPアドレス、例: `192.168.1.100`）
  - **外部アクセス用**（`acme_domain` が設定されている場合）: `https://{acme_domain}:{https_port}`
- 各URLに「コピー」ボタンを配置
- 用途別に説明文を追加（例: "このPCからアクセス"、"同じネットワーク内の他のデバイスから"、"インターネット経由でアクセス"）
- 詳細は `docs/specs/CORE_API.md` の「ProxyHandle のユーザー向けエンドポイントURL生成」セクションを参照

### API Setup
- モデル選択 (`flm://engine/model` 形式のドロップダウン)、エンジン再検出ボタン。
- APIキー管理：一覧表示、新規作成（作成直後のみ平文キーを表示）、失効。
- セキュリティポリシー編集：IPリスト/CORS/Rate-limit をフォームで編集。JSON編集は「Advanced」トグルで開き、保存時に Core 側バリデーション必須。Phase1/2ではグローバルポリシー `"default"` のみを扱う。
- Config 値（例: Proxy デフォルトポート）を閲覧/更新。

### Chat Tester
- Proxy経由で `/v1/chat/completions` を叩き、レスポンス/SSE を画面に表示する疎通ツール。
- Proxy endpoint 情報は `ProxyService::status` から取得。`/v1/models` を HTTP で取得してモデル選択リストを構成し、UI上は `flm://engine/model` 形式で表示する。リクエスト送信時は `/v1/chat/completions` の `model` フィールドへ OpenAI互換の `id` をセットする。HTTPレスポンスと `request_id` を UI に表示し、ログと照合できるようにする。

### Setup Wizard (External Publish)
- Dashboard から起動できるステッパーUIで「外部公開に必要な最小セット」を案内する。
- ステップ構成:
  1. **Pre-check**: `ProxyService::status`, `SecurityService::list_api_keys`, `SecurityService::get_policy` を呼び、APIキー・IPホワイトリスト・Proxyモードの不足を可視化。
  2. **Proxy Mode & Port**: 
     - パッケージ版では `packaged-ca` を既定とし（証明書はインストール時に自動登録済み）、外部サイトから警告なしでHTTPS利用可能であることを表示。
     - CLI版では `https-acme` を既定とし（CLI/Wizard が DNS-01 / HTTP-01 設定をガイド）、LAN / 開発用途のみ `dev-selfsigned` を選択可能にする。
     - 選択内容は `ProxyService::start` に引き渡し、ACME 再試行・手動証明書アップロード・自己署名ルート配布手順を案内する。
  3. **Security Policy**: IPホワイトリスト/CORS/RateLimit フォームを `SecurityService::set_policy` で確定。入力時に RFC1918/リンクローカルのみの場合は警告を出し、「手動で公開IPを追加してください」と案内する（`ip_whitelist` のバリデーションは UI 側で実施）。
  4. **Firewall Automation**: クライアントOSを自動検出し（Tauri側 Native API）、`ProxyService::status` で得た全待受ポート（例: 8080/8081）と `SecurityPolicy.policy_json` 内の `ip_whitelist`（IPv4/IPv6 CIDR 可）に応じたコマンドスクリプト（PowerShell, pfctl, ufw/firewalld 等）を生成。  
     - デフォルトは「プレビュー + コピー/保存」で、常に `docs/guides/SECURITY_FIREWALL_GUIDE.md` の手動手順を提示。HTTP/HTTPS 両ポートと複数 IP を網羅したスクリプトを出力する。  
     - 「管理者権限で適用」を選択した場合のみ UAC/sudo プロンプトを表示し、`ipc.system_firewall_apply(script, shell)` で昇格実行する。適用結果（stdout/stderr/exit_code）に加えてロールバック用スクリプトを自動保存し、結果ログを `AppData/flm/logs/security/firewall-*.log`（OS 標準アプリデータ配下、権限 700/600）へ追記する。  
     - 権限拒否・ヘッドレス環境では手動実行のみを案内し、Wizard 上で「適用済み」を明示的にチェックできるようにする（IPv6 / HTTP-only の場合も同じ）。
- Wizard 完了後に `SecurityService::get_policy` / `ProxyService::status` を再取得し、ダッシュボードへサマリカードを表示する。
- 完了画面では、ユーザー向けエンドポイントURL（`0.0.0.0` ではなく `localhost` や実際のIPアドレス）とAPIキーを表示し、コピーボタンを提供する。

## 3. ワイヤーフレーム（テキスト）
```
Dashboard
 ├─ Engine Status table
 ├─ Proxy Status panel
 └─ Security Alerts panel

API Setup
 ├─ Models selector (flm://engine/model)
 ├─ API Keys table + create/revoke actions
 └─ Security Policy editor (form + optional JSON advanced view)

Chat Tester
 ├─ Model selector & prompt input
 ├─ Options: stream, temperature (将来)
 └─ Response log (SSE streaming view + request_id + HTTP status)

Setup Wizard
 ├─ Step 1: Pre-check (Proxy/APIs/Policy)
 ├─ Step 2: Proxy mode & port form
 ├─ Step 3: Security policy editor (minimum IP validation)
 └─ Step 4: Firewall script preview + Apply/Copy buttons
```

## 4. IPC / HTTP フロー

| 操作 | 経路 | 備考 |
|------|------|------|
| Engine検出 | `ipc.detect_engines()` → `EngineService::detect_engines` | キャッシュ有無は Core 側に委譲 |
| Proxy開始/停止 | `ipc.proxy_start(config)` / `ipc.proxy_stop(handle)` | `ProxyConfig` をそのまま送る |
| Proxy状態取得 | `ipc.proxy_status()` → `ProxyService::status` | Chat Tester 等の前提データ |
| APIキー管理 | `ipc.api_keys_create/list/revoke` → `SecurityService` | 作成直後のみ平文キーをダイアログ表示 |
| セキュリティ設定 | `ipc.policy_get/set` → `SecurityService` | Phase2ではポリシーJSON全体を置き換える。保存前に Core でスキーマバリデーションを実施 |
| Config閲覧/更新 | `ipc.config_list/get/set` → `ConfigService` | 表示は key/value テーブル |
| Chatテスト | UI側で HTTP `/v1/chat/completions` にアクセス | Proxy status で取得した URL/Port を使用。SSE を UI でストリーム表示 |
| Wizard Pre-check | `ipc.proxy_status()`, `ipc.policy_get()`, `ipc.api_keys_list()` | 不足項目を算出し、次ステップのフォーム初期値に反映 |
| Wizard Firewall Preview | `ipc.system_firewall_preview(os, ports, ip_whitelist)` | Core外（Tauri側）に実装するネイティブモジュール。OS別テンプレートから実行予定スクリプト文字列を返す。`ip_whitelist` は `SecurityPolicy.policy_json` から取得した配列 |
| Wizard Firewall Apply | `ipc.system_firewall_apply(script, shell)` | 管理者権限でスクリプトを実行し、実行ログ（stdout/stderr/exit code）を返す。失敗時は SECURITY_FIREWALL_GUIDE へのリンクを表示 |

### Adapter専用 IPC (Firewall)
- `system_firewall_preview/apply` は Core API には含まれない。Tauri バックエンド（Adapter層）が OS 判定・昇格を実装し、Domain とは疎結合に保つ。
- Core との接点は Proxy/Policy 情報の取得のみで、Firewall コマンドは `docs/guides/SECURITY_FIREWALL_GUIDE.md` のテンプレートを参照して生成・実行する。生成/適用結果の永続ログはファイルベース（`logs/security/firewall-*.log`）に統一し、`security.db` の `audit_logs` には書き込まない。

## 5. UX / エラーハンドリングポリシー
- ロード状態を視覚的に示す（Engine table skeleton、ボタン disabled など）。
- すべてのエラー表示には `request_id` を含め、ログとの突合を容易にする。
- APIキー作成後は平文キーを一度だけ表示し、閉じたら再表示不可。
- Advanced JSON 編集は「本当に編集するか」警告と Core バリデーションを必須にする。
- 開発者向けデバッグモードを用意し、IPC リクエスト/レスポンスを確認可能にする（任意）。
- Setup Wizard 成功時は「Proxy/TLS 有効」「IPホワイトリスト適用」「ファイアウォール適用済みOSコマンド」の3項目をバッジ表示し、失敗ケースでは該当ステップのみ再実行できる UI（例: Step 4 だけやり直し）を提供。UAC/sudo拒否は「権限不足」エラーとして扱い、ガイドリンク (`docs/guides/SECURITY_FIREWALL_GUIDE.md`) をその場で提示する。

## 6. Firewall Automation IPC
- `system_firewall_preview`  
  - 入力: `os`（"windows" | "macos" | "linux"）、`ports`（待受ポート配列）、`ip_whitelist`（CIDR/IP配列。`SecurityPolicy.policy_json` の `ip_whitelist` キーから取得）  
  - 出力: `{ script: String, display_name: String, shell: "powershell" | "bash" }`。`script` は実行可能な PowerShell/pfctl/ufw 等のテンプレ。`display_name` は Wizard UI で表示するタイトル。
  - 例:
    ```json
    {
      "script": "$ports = @(8080,8081)\nforeach ($port in $ports) {\n  New-NetFirewallRule -DisplayName \"FLM Proxy $port\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -RemoteAddress 203.0.113.0/24\n}",
      "display_name": "Windows / PowerShell",
      "shell": "powershell"
    }
    ```
- `system_firewall_apply`  
  - 入力: `script`（preview で得た文字列）、`shell`。  
  - 実行: OS 標準の昇格 API を通じて実行し、`{ stdout, stderr, exit_code }` を返す。exit_code≠0 の場合は Wizard が失敗とみなす。
- どちらも Core API に依存せず、Tauri ネイティブプラグイン（Rust）として実装する。アクセス権を最小化するため、ファイアウォール設定以外の特権操作は許可しない。ログは `logs/security/firewall-*.log` に保存する。IPv6 対応が必要な場合は `ip_whitelist` から `:` を含む値を検知し、テンプレートを `New-NetFirewallRule -LocalAddress ::` などに切り替える。

## 7. 未決事項
- UI コンポーネントライブラリ（Tailwind / MUI など）、テーマカラー。
- 手動テストシナリオ（Phase2 開始時に `docs/tests/ui-scenarios.md` として整理）。
- Chat Tester での詳細パラメータ設定（Phase3 以降に拡張予定）。

---

**関連ドキュメント**:
- `docs/specs/CORE_API.md` - コアAPI仕様（UIが使用するAPI）
- `docs/specs/UI_EXTENSIONS.md` - UI拡張仕様
- `docs/specs/I18N_SPEC.md` - 国際化仕様
- `docs/specs/BRAND_GUIDELINE.md` - ブランドガイドライン
- `docs/guides/SECURITY_FIREWALL_GUIDE.md` - ファイアウォール設定ガイド
- `docs/planning/PLAN.md` - プロジェクト計画