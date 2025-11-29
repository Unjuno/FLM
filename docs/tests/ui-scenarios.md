# UI Manual Test Scenarios
> Status: Draft | Audience: QA / Release engineers | Updated: 2025-11-20

## 1. Setup Wizard (Phase 2)
| Step | Action | Expected Result | Notes |
|------|--------|----------------|-------|
| 1 | Launch UI (`flm-ui --wizard`) | Welcome screen shows version + Core API hash | Verify `core-api-v1.0.0` tag |
| 2 | Engine detection screen → "Detect" | List of installed engines with status badges | Matches `flm engines detect` output |
| 3 | Proxy mode selection = `local-http` | Port field defaults to 8080 / HTTPS disabled | Warning banner reminding to keep firewall closed |
| 4 | Apply firewall script (preview only) | Script text + diff preview displayed | No admin prompt yet |
| 5 | Finish | Summary shows CLI equivalents + log path | Log saved to `%LOCALAPPDATA%\flm\logs` |

## 2. ACME HTTP-01 Flow
1. Wizard: choose `https-acme`, challenge `http-01`, domain `dev.example.test`
2. UI verifies port 80 availability → success banner
3. Click “Request Certificate”  
   - Spinner < 90s  
   - Shows certificate expiry + path
4. Open browser to `https://dev.example.test:8443/v1/models` → returns JSON
5. Stop wizard → ensures `ProxyHandle.https_port = port+1` in status panel

## 3. ACME DNS-01 Flow
1. Create DNS credential via CLI `flm secrets dns add --provider cloudflare`
2. Wizard challenge = `dns-01`, select stored credential
3. Wizard displays TXT record preview, waits for propagation (progress bar)
4. Certificate issued < 120s, record auto-deleted
5. Wizard logs include `dns_profile_id`

## 4. Firewall Automation
| OS | Action | Expected |
|----|--------|----------|
| Windows | Click “Apply script” (requires admin) | UAC prompt → `netsh advfirewall` rules created |
| macOS | Run command preview manually | `pfctl` script succeeds, log saved to `/var/log/flm-firewall.log` |
| Linux | Use `sudo` prompt | `ufw allow 8080` + `ufw allow 8081` executed |

Rollback: Click “Rollback script” → removes rules, log appended.

## 5. API Key Provisioning
1. Wizard page “Security”
2. Click “Generate API Key” → modal shows plaintext key once
3. Confirm copy + close → key hidden, list updated
4. Test request: UI sends sample chat via Proxy, displays `request_id`

## 6. Error Handling
- Simulate engine absence → detection table shows `InstalledOnly` rows with fix hints
- ACME failure → UI displays error from `ProxyHandle.last_error` and offers fallback to `dev-selfsigned`
- Security DB read-only mode → wizard blocks API key generation, links to `docs/guides/MIGRATION_GUIDE.md`

## 7. Regression Checklist
- Screenshots captured for each wizard step
- Logs uploaded to CI artifact
- Manual sign-off recorded in release checklist referencing this file

## 8. Security UI Automation Coverage
| Flow | Automation | Notes |
|------|------------|-------|
| IP blocklist (Botnet保護) | `archive/prototype/tests/unit/security-botnet-ui.test.tsx` | 解除/一括解除/サマリ値をjsdomで検証。ログ: `reports/security-ui-tests-20251126.log` |
| Intrusion detection filters | 同上 | IP + score フィルタをデターミニスティックな試行データで確認 |
| Security audit logs | 同上 | イベント/重要度/IPフィルタ、およびバッジ表示を自動化 |

## 9. Botnet / Firewall Gap Coverage（追加が必要）
### 9.1 外部公開バインドでの自動セキュリティ有効化
- 前提: Setup Wizard を `https-acme` モードで起動し、`SecurityPolicy.policy_json` のボットネット機能が既定値のまま。
- 手順:
  1. バインド先ホストを `0.0.0.0` に設定し Security パネルを開く。
  2. バインド先を `127.0.0.1` に戻し、同パネルを再読込。
  3. トグル/バッジ表示を比較し、自動/手動の説明を撮影する。
- 期待結果:
  - 外部公開（`0.0.0.0`）では自動IPブロック/侵入検知/異常検知/リソース保護/IPレート制限/監査ログが強制有効＋「ボットネット対策自動化」バナーが表示される。
  - ローカル（`127.0.0.1`）ではこれらの機能が無効化され、警告バナーが「ローカルではボットネット機能無効」と一致する。

### 9.2 異常検知しきい値と自動ブロック挙動
- 前提: Security パネルで `anomaly_detection` が有効、`request_rate_threshold=100`、テスト用トラフィックジェネレータを接続。
- 手順:
  1. UI から `request_rate_threshold` を 50 に変更し保存。
  2. テストトラフィックを 60req/s で送出し、UI の異常検知フィードを確認。
  3. 変更を 150 に戻し、再度 120req/s を送出してログを比較。
- 期待結果:
  - 低い閾値では自動ブロックが発火し、イベントに「Auto block (anomaly detection)」が記録される。
  - 高い閾値では警告のみでブロックされず、履歴に保存される。

### 9.3 リソース保護 + IPレート制限の連動
- 前提: `ResourceProtection::with_thresholds` が 90%/90%/100接続に設定された環境。
- 手順:
  1. テストボタンから CPU/メモリ負荷シミュレーションを開始し、UI のリソースパネルを監視。
  2. 同時に IP レート制限スライダーを最小値に設定し、同一IPから高頻度リクエストを送る。
  3. リソース警告が解除されたあと、IP 解放が UI に反映されるまでを確認。
- 期待結果:
  - 閾値超過で新規接続拒否バナーが表示され、`audit_logs` に「resource_throttle」種別が追記される。
  - IPレート制限の緩和で接続が復旧し、トースト通知が閉じる。

### 9.4 Firewall スクリプト生成の OS / ホワイトリスト差分
- 前提: Setup Wizard Step4、`ip_whitelist` に IPv4 と IPv6 CIDR を登録済み。
- 手順:
  1. OS 自動検出が Windows になるようネイティブプラグインをモックし、プレビューを取得。
  2. macOS/Linux を順にシミュレートし、それぞれのプレビュー＆ロールバックを比較。
  3. 任意の IP を削除し、スクリプトの RemoteAddress/allow 行が減ることを確認。
- 期待結果:
  - OS ごとに PowerShell/pfctl/ufw テンプレが選ばれ、IPv6 エントリは `LocalAddress ::` などに切り替わる。
  - Rollback セクションが常に表示され、`logs/security/firewall-*.log` への書き込み場所が注記される。

### 9.5 Firewall 自動適用失敗時のフォールバック
- 前提: Windows 環境で管理者権限を拒否する（UACダイアログをキャンセル）。
- 手順:
  1. 「Apply script」を押して UAC プロンプトをキャンセル。
  2. UI が `ipc.system_firewall_apply` 失敗イベントを受け取るまで待機。
  3. 「手動手順を表示」をクリックし、`SECURITY_FIREWALL_GUIDE.md` のリンク動作を確認。
- 期待結果:
  - 失敗ダイアログにエラーコード + ガイドリンクが表示される。
  - ログへの書き込みが継続し、再試行でも同じ履歴が積み上がることを確認。

