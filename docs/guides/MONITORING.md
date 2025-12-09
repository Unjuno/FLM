# FLM Proxy モニタリングガイド

このドキュメントでは、FLM ProxyのメトリクスをPrometheusとGrafanaで監視する方法を説明します。

## 概要

FLM Proxyは、Prometheus互換のメトリクスを`/metrics`エンドポイントで提供します。これらのメトリクスを使用して、プロキシのパフォーマンス、セキュリティイベント、認証状況などを監視できます。

## 前提条件

- FLM Proxyが起動している
- Prometheusがインストール・設定されている
- Grafanaがインストール・設定されている（オプション）

## メトリクスエンドポイント

FLM Proxyは、以下のエンドポイントでメトリクスを提供します：

```
http://localhost:<port>/metrics
```

例：
```
http://localhost:8080/metrics
```

## 利用可能なメトリクス

### リクエストメトリクス

- `flm_proxy_requests_total` (counter): 総リクエスト数
- `flm_proxy_requests_success` (counter): 成功リクエスト数（2xx）
- `flm_proxy_requests_failed` (counter): 失敗リクエスト数（4xx, 5xx）
- `flm_proxy_requests_rate_limited` (counter): レート制限されたリクエスト数
- `flm_proxy_requests_blocked` (counter): ブロックされたリクエスト数（IPブロックリストなど）

### 接続メトリクス

- `flm_proxy_connections_active` (gauge): 現在のアクティブ接続数

### 認証メトリクス

- `flm_proxy_auth_success` (counter): 認証成功数
- `flm_proxy_auth_failure` (counter): 認証失敗数

### セキュリティメトリクス

- `flm_proxy_intrusions_detected` (counter): 侵入検知イベント数
- `flm_proxy_anomalies_detected` (counter): 異常検知イベント数

## Prometheus設定

### prometheus.yml の設定例

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'flm-proxy'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 複数のプロキシインスタンスを監視する場合

```yaml
scrape_configs:
  - job_name: 'flm-proxy'
    static_configs:
      - targets:
          - 'localhost:8080'
          - 'localhost:8081'
          - 'localhost:8082'
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Grafanaダッシュボードのインポート

### 手順

1. Grafanaにログイン
2. 左側のメニューから「Dashboards」→「Import」を選択
3. 「Upload JSON file」をクリック
4. `grafana/dashboards/flm-dashboard.json` を選択
5. 「Prometheus」データソースを選択
6. 「Import」をクリック

### ダッシュボードの内容

FLM Proxyダッシュボードには以下のパネルが含まれています：

- **Request Rate**: リクエストレート（リクエスト/秒）の時系列グラフ
- **Request Status Distribution**: リクエストステータスの分布（成功、失敗、レート制限、ブロック）の円グラフ
- **Active Connections**: アクティブ接続数の時系列グラフ
- **Authentication Rate**: 認証レート（成功/失敗）の時系列グラフ
- **Security Events Rate**: セキュリティイベントレート（侵入検知、異常検知）の時系列グラフ
- **Request Success Rate**: リクエスト成功率（%）のゲージ表示
- **Total Requests**: 総リクエスト数の統計表示
- **Total Failed Requests**: 総失敗リクエスト数の統計表示
- **Total Rate Limited**: 総レート制限リクエスト数の統計表示
- **Total Blocked**: 総ブロックリクエスト数の統計表示

### ダッシュボードのカスタマイズ

ダッシュボードはGrafanaのUIから直接編集できます。パネルの追加、削除、設定変更などが可能です。

#### よく使うクエリ例

- **リクエストレート（1分間）**: `rate(flm_proxy_requests_total[1m])`
- **エラー率**: `(rate(flm_proxy_requests_failed[5m]) / rate(flm_proxy_requests_total[5m])) * 100`
- **認証失敗率**: `(rate(flm_proxy_auth_failure[5m]) / (rate(flm_proxy_auth_success[5m]) + rate(flm_proxy_auth_failure[5m]))) * 100`

## アラート設定例

### 高エラー率のアラート

```yaml
groups:
  - name: flm_proxy_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(flm_proxy_requests_failed[5m]) / rate(flm_proxy_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "FLM Proxy high error rate"
          description: "Error rate is above 5% for 5 minutes"
```

### 高レート制限のアラート

```yaml
      - alert: HighRateLimit
        expr: rate(flm_proxy_requests_rate_limited[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "FLM Proxy high rate limiting"
          description: "Rate limiting is occurring frequently"
```

### セキュリティイベントのアラート

```yaml
      - alert: SecurityEventDetected
        expr: rate(flm_proxy_intrusions_detected[5m]) > 0 OR rate(flm_proxy_anomalies_detected[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "FLM Proxy security event detected"
          description: "Intrusion or anomaly detected"
```

## メトリクスの確認方法

### curlを使用

```bash
curl http://localhost:8080/metrics
```

### ブラウザで確認

ブラウザで `http://localhost:8080/metrics` にアクセスすると、Prometheus形式のメトリクスが表示されます。

## トラブルシューティング

### メトリクスが表示されない

1. プロキシが起動しているか確認
   ```bash
   flm proxy status
   ```

2. `/metrics`エンドポイントにアクセスできるか確認
   ```bash
   curl http://localhost:8080/metrics
   ```

3. Prometheusの設定を確認
   - `prometheus.yml`の`targets`が正しいか
   - `scrape_interval`が適切か

### Grafanaでデータが表示されない

1. Prometheusデータソースが正しく設定されているか確認
2. Prometheusでメトリクスが収集されているか確認
   - Prometheus UIで `flm_proxy_requests_total` を検索
3. ダッシュボードの時間範囲を確認
4. メトリクス名が正しいか確認（`flm_proxy_` プレフィックス）

## メトリクスの詳細

### メトリクス名の命名規則

すべてのメトリクスは `flm_proxy_` プレフィックスで始まります。これにより、他のアプリケーションのメトリクスと区別できます。

### メトリクスタイプ

- **Counter**: 単調増加する値（リクエスト数、認証数など）
- **Gauge**: 増減する値（アクティブ接続数など）

### メトリクスの計算例

#### リクエストレート（1秒あたり）

```promql
rate(flm_proxy_requests_total[5m])
```

#### エラー率（%）

```promql
(rate(flm_proxy_requests_failed[5m]) / rate(flm_proxy_requests_total[5m])) * 100
```

#### 成功率（%）

```promql
(rate(flm_proxy_requests_success[5m]) / rate(flm_proxy_requests_total[5m])) * 100
```

#### 認証失敗率（%）

```promql
(rate(flm_proxy_auth_failure[5m]) / (rate(flm_proxy_auth_success[5m]) + rate(flm_proxy_auth_failure[5m]))) * 100
```

## 実装状況

### メトリクスエンドポイント

- **パス**: `/metrics`
- **実装場所**: `crates/services/flm-proxy/src/metrics.rs`
- **コントローラー統合**: `crates/services/flm-proxy/src/controller.rs`
- **形式**: Prometheus Text Format (version 0.0.4)

### 利用可能なメトリクス一覧

| メトリクス名 | タイプ | 説明 |
|------------|--------|------|
| `flm_proxy_requests_total` | counter | 総リクエスト数 |
| `flm_proxy_requests_success` | counter | 成功リクエスト数（2xx） |
| `flm_proxy_requests_failed` | counter | 失敗リクエスト数（4xx, 5xx） |
| `flm_proxy_requests_rate_limited` | counter | レート制限されたリクエスト数 |
| `flm_proxy_requests_blocked` | counter | ブロックされたリクエスト数 |
| `flm_proxy_connections_active` | gauge | 現在のアクティブ接続数 |
| `flm_proxy_auth_success` | counter | 認証成功数 |
| `flm_proxy_auth_failure` | counter | 認証失敗数 |
| `flm_proxy_intrusions_detected` | counter | 侵入検知イベント数 |
| `flm_proxy_anomalies_detected` | counter | 異常検知イベント数 |

## 参考資料

- [Prometheus公式ドキュメント](https://prometheus.io/docs/)
- [Grafana公式ドキュメント](https://grafana.com/docs/)
- [FLM Proxy仕様書](../specs/PROXY_SPEC.md)
- [Prometheus Query Language (PromQL)](https://prometheus.io/docs/prometheus/latest/querying/basics/)

