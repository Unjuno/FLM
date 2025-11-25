# CLI→UI ハンドオフメモ

> Status: Draft | Audience: CLI / UI engineers | Updated: 2025-11-24

## IPC/データ契約

- すべての CLI コマンドは `{"version":"1.0","data":{...}}` 形式で JSON を出力（`--format text` 指定時のみテキスト）。UI から CLI を呼び出す場合は `version` を確認し、未知フィールドは無視できるよう `serde(default)` 付き DTO を利用する。
- `flm engines detect` は `config.db` の `engines_cache` (TTL 5分) を再利用する。UI 側で最新状態が必要な場合は `--fresh` を指定して CLI を呼び出す。
- `flm proxy start` のレスポンスには `endpoints.localhost`, `endpoints.local_network`, `endpoints.external` が含まれる。UI は `docs/specs/UI_MINIMAL.md` のウィザード手順に従って適切な URL を提示する。
- セキュリティ/設定系コマンド (`config`, `api-keys`, `security`) は `config.db` / `security.db` を直接操作するため、UI が同一DBを開く際はマイグレーション完了後に読み取り専用で開く（`docs/specs/CORE_API.md` 参照）。

## UI 実装で再利用すべき CLI フロー

1. **エンジン検出**: `flm engines detect --format json` の結果を UI 初回セットアップで利用し、ユーザーが選択したエンジンIDを `flm models list` へ渡す。CLI は `flm://{engine}/{model}` を返すため UI では変換不要。
2. **プロキシ制御**: UI から CLI をサブプロセス実行する場合は `proxy start` → `proxy status` → `proxy stop` の順で状態を同期。`proxy status` は複数ハンドルを返すので UI で PID/Port を紐づける。
3. **セキュリティポリシー**: UI で編集した JSON を `flm security policy set --format json --json <file>` に渡す。CLI は検証を実行するため UI 側で二重検証不要。

## 既知のギャップ / 想定する前提

- UI では CLI と同じ `cargo` ワークスペースを利用し IPC を行う想定（`docs/specs/UI_MINIMAL.md` の IPC 設計）。CLI 側で Breaking Change が入る場合は `version` を 2.x に引き上げ、UI でも同変更セットで更新する。
- `proxy start` の HTTPS モード（`dev-selfsigned`, `https-acme`）は証明書配置ステップを CLI でガイドする。UI は CLI 出力の `mode` と `endpoints` をそのまま Wizard に表示し、証明書の保存/削除は CLI に委任する。
- UI から CLI を呼び出す際は全コマンドで `--db-path-config` / `--db-path-security` を CLI 既定に合わせる。別パスを指定する場合は CLI と UI の双方で `Sqlite` ロックを避けるよう単一進程で実行する。

## 次のステップ

- UI 最小実装（`docs/specs/UI_MINIMAL.md`）では、上記 CLI 呼び出しを `tauri::command` でラップし、非同期で結果を待つ形にする。
- `flm proxy start` 成功後の `endpoints.external` を UI で表示する際は ACME モードのみ対象。ローカル開発では `local_network` URL を推奨表示として扱う。
- CLI 追加コマンド（model-profiles / api prompts / migrate legacy）が実装されたら、同じ形式で JSON 契約を記述して本メモを更新する。UI チームはそのままハンドラーを追加するだけで済むようフィールド名の整合性を維持する。

## Tauri IPC Command Stubs

| Tauri command | CLI invocation | Request payload → Response payload |
| --- | --- | --- |
| `cmd_detect_engines()` | `flm engines detect --format json [--fresh]` | Request: `{ "fresh": bool }` → Response mirrors CLI JSON (`{"version":"1.0","data":{"engines":[...]}}`). UI should surface `engine.id`, `status`, and show `--fresh` toggle. |
| `cmd_list_models(engine_id)` | `flm models list --engine <id> --format json` | Request: `{ "engine":"ollama" }` → Response: CLI `models` array with `flm://` IDs; UI passes selection downstream without transformation. |
| `cmd_proxy_start(opts)` | `flm proxy start ... --format json` | Request: `{ "mode":"local-http","port":8080,"bind":"127.0.0.1","acme_email":null,"acme_domain":null }`; CLI returns `data.status/mode/listen_addr/endpoints`. UI surfaces `data.endpoints.localhost/local_network/external`. |
| `cmd_proxy_status()` | `flm proxy status --format json` | Response is array of `ProxyHandle`. UI shows per-handle card with `mode`, `port`, `acme_domain`, `running`. |
| `cmd_security_policy_show()` | `flm security policy show --format json` | Response: `{ "version":"1.0","data": { ...policy JSON... } }`. UI writes to form. |
| `cmd_security_policy_set(policy_json)` | `flm security policy set --format json --json <tmpfile>` | Request accepts serialized policy. Return CLI `data` for confirmation; show validation errors from CLI error payload (`{"error":{...}}`). |
| `cmd_api_keys_create(label)` | `flm api-keys create --label <label> --format json` | Response includes new key. UI should clip `data.plaintext_key` to clipboard immediately; CLI already logs audit entry. |

### Error Handling Expectations

- All Tauri commands should bubble up CLI `stderr` as a toast/snackbar.  
- CLI error schema uses `{"error":{"message","type","code"}}`; UI should display `message` and map `code` to remediation hints.
- Timeout/IPC errors: wrap CLI execution in 60s timeout to avoid hung UI.

## Implemented IPC Commands (archive/prototype/src-tauri)

| `#[tauri::command]` | Description | Notes |
| --- | --- | --- |
| `ipc_detect_engines(fresh: bool)` | Runs `flm engines detect --format json [--fresh]` | Returns `serde_json::Value` directly. |
| `ipc_list_models(engine: Option<String>)` | Runs `flm models list --engine <id> --format json` | `engine` is optional (defaults to all). |
| `ipc_proxy_start(config: ProxyStartRequest)` | Wraps `flm proxy start … --format json` | Request fields: `mode`, `port`, `bind`, `engine_base_url`, `acme_email`, `acme_domain`, `no_daemon`. |
| `ipc_proxy_status()` | Wraps `flm proxy status --format json` | Returns `Vec<ProxyHandle>` JSON from CLI. |
| `ipc_security_policy_show()` | Wraps `flm security policy show --format json` | Used for policy editor initialization. |
| `ipc_security_policy_set(policy: Value)` | Wraps `flm security policy set --json <payload> --format json` | Accepts arbitrary JSON payload. |
| `ipc_api_keys_create(label: String)` | Wraps `flm api-keys create --label <label> --format json` | Returns newly created key response. |

### Error Mapping

All commands return `Result<Value, CliBridgeError>` where:

```
{
  "code": "<CLI_ERROR_CODE or CLI_EXECUTION_FAILED>",
  "message": "<human readable>",
  "stderr": "<stderr lines, optional>"
}
```

- On CLI JSON errors (`{"error":{...}}`), `code`/`message` propagate from CLI payload.
- Spawn failures → `CLI_EXECUTION_FAILED`.
- Timeout (>60s) → `CLI_TIMEOUT`.
- Non-JSON failures fall back to combined stdout/stderr text.

UI should surface `message` and optionally expand details when `stderr` is present. These commands live in `archive/prototype/src-tauri/src/commands/cli_bridge.rs` and are registered in the Tauri builder for immediate use.

