# Test Strategy
> Status: Draft | Audience: QA / Release engineers | Updated: 2025-11-20

## 1. Testing Pyramid
| 層 | 対象 | 目的 | ツール |
|----|------|------|--------|
| ユニット | `flm-core` services/ports, CLI サブコマンド | ロジック検証、DTO 互換性 | `cargo test`, `insta` |
| 統合 | CLI↔Core, Proxy↔Core, DB マイグレーション | I/O 境界の整合性 | `cargo nextest`, sqlite in-memory |
| E2E | CLI/Proxy/Setup Wizard + 実エンジン | フェーズ毎の受入 | GitHub Actions, self-hosted runners |
| 手動 | UI 最小操作, Firewall wizard | ユーザーフロー/権限チェック | `tests/ui-scenarios.md` |

## 2. CI Workflows
### 2.1 `ci-cli`
- Matrix: `{os: [windows-latest, macos-latest, ubuntu-22.04]} × {engine: [ollama, vllm, lmstudio, llamacpp-mock]}`
- Steps:
  1. `cargo fmt --check`, `cargo clippy -- -D warnings`
  2. `cargo test -p flm-core`, `cargo test -p flm-cli`
  3. Integration smoke:  
     ```
     flm engines detect --format json
     flm models list --engine $engine
     flm proxy start --mode local-http --port 8080
     flm proxy status
     flm proxy stop --all
     ```
  4. Artifacts: detection JSON, proxy logs

### 2.2 `ci-proxy-load`
- Runner: Linux self-hosted (AVX2 enabled)
- Tools: `k6`, `wrk2`, mock SSE producer
- Scenario:
  - Start vLLM mock
  - `flm proxy start --mode dev-selfsigned --port 9000`
  - Run `k6 run scripts/proxy-load.js` (100 req/min, 10 min, SSE + non-SSE mix)
  - Collect P50/P95 latency, error率 < 0.5%

### 2.3 `ci-acme-smoke`
- Nightly schedule
- Matrix: `{challenge: [http-01, dns-01]}`
- Steps:
  1. Provision ephemeral domain (e.g., `ci-<sha>.example.test`)
  2. Execute `flm proxy start --mode https-acme --challenge $challenge --domain $domain --email ci@example.test`
  3. Verify certificate issuance < 90s
  4. Run HTTPS request + SSE
  5. Tear down domain/DNS records

## 3. Coverage Targets
- `flm-core`: line coverage 80%+, mutation score 60%+ (`cargo mutants` optional)
- CLI argument parsing: snapshotテストで全コマンドを固定
- Proxy handlers: request/response golden tests

## 4. Manual Verification
- `tests/ui-scenarios.md` を Phase ごとに更新
- Phase 1B ハイライト:
  - Setup Wizard で ACME (http-01/dns-01) を実行し、証明書発行ログを確認
  - Firewall script preview/apply/rollback
  - APIキー発行→Proxy経由でチャット送信→ログ確認

## 5. Regression Gates
| Gate | 条件 | 対応 |
|------|------|------|
| Engine detection | 4エンジン × 3 OS × 3 回失敗=0 | `ci-cli` で自動判定 |
| Proxy restart | `local-http/dev-selfsigned` 再起動中央値 < 3s | `ci-proxy-load` で測定 |
| ACME issuance | 両チャレンジ成功 (<90s) | `ci-acme-smoke` |
| Security DB | backup/restore 成功 | `cargo test -p flm-core security::` |

## 6. Tooling & Reporting
- Coverage: `cargo llvm-cov`
- Load tests: resultsアップロード (`artifacts/proxy-load/<sha>.json`)
- Dashboard: Grafana snapshot (latency, error率, ACME成功率)

## 7. Update Process
1. 仕様変更時は対象セクションを更新し、`Updated:` を書き換え
2. 新しいテストシナリオは `tests/ui-scenarios.md` にリンク
3. Phase 完了後は結果を `docs/EVALUATION_REPORT.md` に追記

