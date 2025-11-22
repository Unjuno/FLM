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

