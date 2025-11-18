# FLM Next Docs計画レビュー: 破綻リスク分析

**レビュー日**: 2025-11-18  
**レビュー対象**: `/workspace/docs/` 配下の全仕様書  
**前回失敗からの教訓**: `/workspace/archive/prototype/` のパフォーマンス監査レポートを参照

---

## 🔴 致命的な問題（Critical Issues）

### 1. **Domain層とAdapter層の責務境界が曖昧で、実装時に循環依存が発生するリスクが高い**

#### 問題の詳細

**CORE_API.md の定義**:
- Domain層 (`flm-core`) は「純粋ロジックと抽象ポート」のみ
- Application/Adapter層が HTTP/DB/FS 等の I/O 実装を提供
- Core からは trait 経由で依存し、実体は DI で注入

**矛盾点**:
1. **Migration実行の責務が不明確**  
   - `DB_SCHEMA.md` では「`EngineService::new()` で `sqlx::migrate!()` を呼ぶ」と記載
   - しかし「実際の DB 接続は Adapter 層が実装する」と記載
   - → **Domain層がDB接続を直接参照するのか、Adapter層から渡されるのかが不明確**

2. **ProxyService の実装場所の矛盾**  
   - `PLAN.md`: 「Proxy 実装も Rust (Axum/Hyper) で統一」
   - `CORE_API.md`: ProxyService は Domain 層に定義
   - `PROXY_SPEC.md`: Axum ベースの HTTP/S プロキシ
   - → **Axum (HTTP実装) が Domain 層に入るのは設計原則と矛盾**（Domain は純粋ロジックのはず）

3. **EngineService の HttpClient 依存**  
   - `CORE_API.md`: EngineService は `HttpClient` trait に依存
   - エンジン検出で API Ping を実行する必要がある
   - → **Domain層が HTTP 呼び出しを直接制御すると、テスタビリティと分離が低下**

#### 影響範囲
- Phase 0/1 でアーキテクチャ実装時に手戻りが発生
- CLI/UI/Proxy の 3 つのアダプタすべてに影響
- テストモック化が困難になり、CI が不安定化

#### 推奨対応
1. **ProxyService を Domain から Application 層へ移動**  
   - Domain: `ProxyController` trait のみ定義
   - Application (`flm-proxy` crate): Axum 実装と ProxyService 実体を配置

2. **Migration 実行をアプリケーション起動時に明確化**  
   - CLI/UI/Proxy それぞれの main 関数で Repository 初期化前に migration 実行
   - Domain の Service は Repository trait のみに依存

3. **EngineService は Repository 経由でキャッシュされたエンジン状態を取得**  
   - 実際のプロセス検出・API Ping は `EngineDetector` (Application層) が実行
   - Domain は検出結果の管理と状態遷移ロジックのみ担当

---

### 2. **SecurityPolicy の ID="default" 固定が将来の拡張を阻害し、Phase3 以降の破綻を招く**

#### 問題の詳細

**現在の設計**:
- Phase1/2 では SecurityPolicy の ID を `"default"` に固定
- `SecurityService::get_policy` / `set_policy` は ID 指定不要
- UI/CLI/Proxy は暗黙にこの ID を使用

**破綻リスク**:
1. **複数プロキシの同時起動に対応不可**  
   - 現状の設計では「1つのプロキシ = 1つのポリシー」を前提
   - しかし `ProxyService::status` は複数ハンドルを返却可能と記載
   - → **ポート8080とポート8081で異なるIPホワイトリストを適用できない**

2. **データベーススキーマとの不整合**  
   - `DB_SCHEMA.md`: `security_policies` テーブルには `id TEXT PRIMARY KEY` を定義
   - しかし API は ID 固定で単一レコード前提
   - → **複数レコードをサポートする DB 設計なのに、API は単一レコード前提**

3. **Wizard の設計と矛盾**  
   - `UI_MINIMAL.md`: Setup Wizard で Proxy モード/ポート/セキュリティポリシーを設定
   - しかし複数の Proxy を起動した場合、どのポリシーがどの Proxy に紐づくか不明
   - → **Wizard で作成した設定が他の Proxy に影響を与える可能性**

#### 影響範囲
- Phase 2 の UI 実装で混乱
- Phase 3 でのマルチプロキシサポート時に全面書き直し必要
- データマイグレーションの複雑化

#### 推奨対応
1. **SecurityPolicy を ProxyProfile に紐付け**  
   ```sql
   -- proxy_profiles テーブルに policy_id を追加
   ALTER TABLE proxy_profiles ADD COLUMN policy_id TEXT REFERENCES security_policies(id);
   ```

2. **API を最初から複数 ID サポートに設計**  
   - `SecurityService::get_policy(id: Option<&str>)` で ID 省略時はデフォルトを返却
   - Phase1/2 では UI が常に `"default"` を渡すだけで互換性維持

3. **Wizard Step 3 で生成したポリシーを明示的に ProxyConfig に紐付け**

---

### 3. **Firewall Automation の権限昇格処理が OS 依存の複雑なエッジケースを考慮していない**

#### 問題の詳細

**現在の設計**:
- `UI_MINIMAL.md`: Setup Wizard Step 4 で Firewall スクリプトを自動生成・適用
- `system_firewall_apply(script)` が UAC/sudo で昇格してスクリプト実行
- 失敗時は `SECURITY_FIREWALL_GUIDE.md` へのリンクを表示

**破綻リスク**:
1. **Windows の UAC キャンセル後の UX 問題**  
   - UAC ダイアログをキャンセルした場合、Wizard が失敗状態になる
   - しかしユーザーは「後で手動で設定する」意図かもしれない
   - → **Wizard 完了とファイアウォール設定を切り離せていない**

2. **macOS の `/etc/pf.conf` 編集権限**  
   - `SECURITY_FIREWALL_GUIDE.md`: `pfctl -f /etc/pf.conf` を実行
   - しかし多くの macOS ユーザーは SIP (System Integrity Protection) により編集不可
   - → **スクリプト適用が高確率で失敗するが、代替手段が明示されていない**

3. **Linux のディストリビューション判定の複雑性**  
   - ufw / firewalld / iptables のどれを使うべきかの判定ロジックが未定義
   - `systemctl list-units` で判定するのか、パッケージ存在確認するのかが不明
   - → **誤った Firewall コマンドを生成してしまうリスク**

4. **IPv6 対応の記載が曖昧**  
   - `SECURITY_FIREWALL_GUIDE.md`: 「`:` を含む値を検知」でテンプレート切替
   - しかし IPv4/IPv6 混在時のルール生成順序や、デュアルスタック環境での挙動が未定義
   - → **Windows では `New-NetFirewallRule -RemoteAddress` が IPv4/IPv6 両対応だが、Linux では `iptables` と `ip6tables` を別々に実行する必要がある**

#### 影響範囲
- Phase 2 の UI 実装で Wizard 成功率が低下
- サポート問い合わせの増加
- ユーザーが Setup Wizard を諦めて CLI で手動設定する流れになる

#### 推奨対応
1. **Wizard Step 4 を「Preview & Copy」モードと「Apply」モードに分離**  
   - デフォルトは Preview & Copy のみ（手動実行を推奨）
   - 「管理者権限で自動適用」は Advanced オプションとして折りたたむ

2. **OS 判定とコマンド選択のフローチャートを `SECURITY_FIREWALL_GUIDE.md` に追加**  
   ```
   Linux: 
     → systemctl is-active ufw → ufw コマンド
     → systemctl is-active firewalld → firewalld コマンド
     → else → iptables (警告付き)
   macOS:
     → /etc/pf.conf が書き込み可能 → pfctl
     → else → 「手動で Application Firewall を設定」ガイド表示
   Windows:
     → New-NetFirewallRule (常に利用可能)
   ```

3. **IPv4/IPv6 混在時のルール生成を明確化**  
   - Windows: 単一ルールで両対応（`-RemoteAddress` に両方指定可能）
   - Linux: IPv4 ルール生成 → IPv6 ルール生成の順序で実行
   - macOS: `pfctl` は両対応のため、`table <flm_allow>` に両方追加

---

## 🟡 重大な問題（High Priority Issues）

### 4. **エンジン検出の状態遷移が複雑で、エッジケースの考慮が不足している**

#### 問題の詳細

**ENGINE_DETECT.md の状態定義**:
- InstalledOnly / RunningHealthy / RunningDegraded / ErrorNetwork / ErrorApi

**CORE_API.md の遷移規則**:
- 連続3回失敗で ErrorNetwork
- レイテンシ >= 1500ms で RunningDegraded

**不明確な点**:
1. **ヘルスチェック失敗時の retry ロジック**  
   - 「連続3回失敗」とあるが、retry 間隔が未定義
   - 1秒間隔で3回 retry するのか、5秒間隔なのか
   - → **短すぎるとエンジン起動直後に誤判定、長すぎると CLI が遅い**

2. **キャッシュ TTL (30秒) との整合性**  
   - `ENGINE_DETECT.md`: キャッシュ TTL = 30秒
   - しかし状態遷移には「連続3回のヘルスチェック成功」が必要
   - → **TTL 内にキャッシュヒットした場合、状態遷移が更新されない**

3. **複数エンジンの並行検出時のタイムアウト**  
   - `flm engines detect` は Ollama/vLLM/LM Studio/llama.cpp を並行検出
   - 各エンジンのヘルスチェックに 3秒かかる場合、最大 12秒待たされる
   - → **Phase1 の合格基準「プロキシ再起動時間 < 3s」と矛盾**

#### 推奨対応
1. **ヘルスチェック retry 間隔を設定可能に**  
   ```rust
   pub struct EngineServiceConfig {
       pub health_check_retry_interval: Duration, // デフォルト 2秒
       pub max_network_failures: u32, // デフォルト 3
       pub health_latency_threshold_ms: u64, // デフォルト 1500
   }
   ```

2. **キャッシュ更新とヘルスチェックを分離**  
   - `detect_engines(use_cache: bool)` で明示的に制御
   - CLI は `--fresh` で `use_cache=false` を渡す

3. **並行検出のタイムアウトを Phase1 メトリクスに追加**  
   - 「エンジン検出時間（全エンジン並行） < 5秒」を合格基準に追加

---

### 5. **PROXY_SPEC.md のモデルID正規化ルールが CLI_SPEC.md と不整合**

#### 問題の詳細

**PROXY_SPEC.md**:
- `/v1/chat/completions` の `model` フィールドは `flm://{engine_id}/{model}` 形式を必須
- 欠落または異なる形式の場合は 400 `invalid_model`

**CLI_SPEC.md**:
- `flm chat --model flm://ollama/llama3:8b`
- 互換性のため `--engine` + `--raw-model` を指定した場合は内部で `flm://` に変換

**UI_MINIMAL.md**:
- Chat Tester は `/v1/models` で取得したモデル一覧から選択
- 「リクエスト送信時は `/v1/chat/completions` の `model` フィールドへ OpenAI互換の `id` をセットする」

**矛盾点**:
1. **OpenAI互換の `id` とは何か？**  
   - PROXY_SPEC では `flm://` 形式を必須と記載
   - UI_MINIMAL では「OpenAI互換の `id`」と記載
   - → **`flm://ollama/llama3:8b` なのか、`llama3:8b` なのか、`model-id-123` なのかが不明**

2. **CLI の `--engine` + `--raw-model` と Proxy の形式が不整合**  
   - CLI は内部変換するが、Proxy は変換しない
   - → **CLI 経由と UI 経由で挙動が異なる**

3. **`/v1/models` のレスポンス形式が未定義**  
   - PROXY_SPEC には「モデルIDを `flm://{engine_id}/{model}` 形式に正規化」とあるが、レスポンス JSON の具体例がない
   - → **UI が `response.data[0].id` を使うべきか、`response.models[0].name` を使うべきかが不明**

#### 推奨対応
1. **PROXY_SPEC.md に `/v1/models` のレスポンス例を追加**  
   ```json
   {
     "object": "list",
     "data": [
       {
         "id": "flm://ollama/llama3:8b",
         "object": "model",
         "owned_by": "ollama",
         "created": 1234567890
       }
     ]
   }
   ```

2. **UI_MINIMAL.md の記載を修正**  
   - 「`/v1/models` で取得した `data[].id` をそのまま使用」と明記

3. **CLI の内部変換ロジックを Proxy と統一**  
   - CLI は `--model` のみを正式サポート
   - `--engine` + `--raw-model` は deprecated として扱う

---

### 6. **Phase1 の合格基準が実装詳細に依存しすぎて、テスト不可能な項目がある**

#### 問題の詳細

**PLAN.md Phase1 合格基準**:
- ✅ エンジン検出成功率100%（対象エンジン4種×主要OSで3回以上）
- ✅ 状態判定（InstalledOnly/RunningHealthy等）が正確にレポートされる
- ✅ プロキシ再起動時間中央値<3s（初回除く）
- ✅ APIキーがDBに平文で残らないことをテストで証明
- ✅ ストリーミング負荷テスト（100 req/min）を成功させる
- ✅ OpenAI互換→各エンジン変換で fallback ルール（未対応パラメータのログ・無視）を実装
- ✅ `flm proxy status` が起動前後のハンドル変化を正しく返すことを CI で確認

**問題点**:
1. **「主要OS」の定義が不明確**  
   - Windows / macOS / Linux の3つか？
   - Linux は Ubuntu のみか、CentOS / Arch / Alpine も含むか？
   - macOS は Intel / M1 両方か？
   - → **CIマトリクスが膨大になり、Phase1 完了が遅延する**

2. **「プロキシ再起動時間中央値<3s」の測定方法が不明**  
   - 何回再起動して中央値を取るのか
   - DB初期化 / 証明書取得を含むのか含まないのか
   - → **テストごとに結果がブレる**

3. **「ストリーミング負荷テスト（100 req/min）」の成功条件が不明**  
   - すべてのリクエストが成功すればよいのか
   - レイテンシの上限は？
   - エラー率の許容範囲は？
   - → **何をもって「成功」とするかが不明確**

#### 推奨対応
1. **Phase1 合格基準を具体化**  
   ```markdown
   - エンジン検出成功率100%: Windows 10/11, macOS 12+, Ubuntu 22.04 の3環境で各3回実行
   - プロキシ再起動時間: 5回連続起動の中央値 < 3秒（local-http モード、証明書生成を除く）
   - ストリーミング負荷テスト: 100 req/min で10分間、エラー率 < 1%、95パーセンタイルレイテンシ < 10秒
   ```

2. **CI マトリクスを Phase1/2/3 で段階的に拡大**  
   - Phase1: Ubuntu 22.04 のみ
   - Phase2: + Windows 11, macOS 13
   - Phase3: + CentOS, Alpine (コンテナデプロイ向け)

---

## 🟢 中程度の問題（Medium Priority Issues）

### 7. **ACME 実装の複雑性が Phase1 のスコープを超えている**

#### 問題の詳細
- `https-acme` モードは ACME プロトコル実装が必要
- Let's Encrypt の DNS-01 / HTTP-01 チャレンジのどちらをサポートするか不明
- 証明書更新の自動化ロジックが `PROXY_SPEC.md` に記載なし

#### 推奨対応
- Phase1 では `local-http` と `dev-selfsigned` のみを実装
- `https-acme` は Phase3 に延期し、まず手動証明書配置をサポート

---

### 8. **DB マイグレーションのロールバック戦略が未定義**

#### 問題の詳細
- `sqlx::migrate!()` は forward migration のみサポート
- Phase2 → Phase1 へのダウングレード時にデータ損失の可能性

#### 推奨対応
- `docs/DB_SCHEMA.md` にバックアップ・リストア手順を追加
- 各 Phase で DB スキーマバージョンを明記

---

### 9. **UI_MINIMAL.md の IPC エラーハンドリングが不十分**

#### 問題の詳細
- IPC 呼び出しがタイムアウトした場合の UI 挙動が未定義
- Rust パニック時の UI フリーズ対策がない

#### 推奨対応
- すべての IPC 呼び出しに 30秒タイムアウトを設定
- `tauri::Result<T, String>` でエラーを統一し、UI でトースト通知表示

---

## 📊 前回の失敗が考慮されている点（Positive Findings）

### ✅ パフォーマンス監査レポートの教訓が反映されている

1. **データベースインデックス**  
   - 前回: インデックス設計が未定義で、フルテーブルスキャン発生
   - 今回: `DB_SCHEMA.md` に各テーブルのインデックスを明記

2. **キュー管理システム**  
   - 前回: 同時リクエスト対応が不明確
   - 今回: Phase1 で 1リクエスト/秒の制限を明示、将来的な拡張を計画

3. **キャッシュ戦略**  
   - 前回: モデル一覧の不要な再取得
   - 今回: `ENGINE_DETECT.md` で 30秒 TTL のキャッシュを定義

4. **メモリリーク対策**  
   - 前回: 長時間実行時の監視機能なし
   - 今回: Phase2 でメモリ監視機能を計画（ただし具体的な実装は未記載）

5. **非同期ログ記録**  
   - 前回: ログ記録がボトルネック化
   - 今回: `audit_logs` テーブルに tamper-resistant 設計を導入（ただし非同期化の記載なし）

### ⚠️ 前回の教訓が部分的にしか反映されていない点

1. **UI応答性の最適化**  
   - 前回: 重い処理が UI をブロック
   - 今回: `UI_MINIMAL.md` に「IPC 経由で呼び出し」とあるが、長時間処理（モデルダウンロード等）の進捗表示が不明確

2. **起動時間の最適化**  
   - 前回: 並列初期化処理を推奨
   - 今回: Migration 実行タイミングは記載あるが、並列初期化の記載なし

---

## 🎯 総合評価

### 破綻リスクスコア: **6/10 (Medium-High)**

| カテゴリ | 評価 | コメント |
|---------|------|----------|
| アーキテクチャ整合性 | ⚠️ 4/10 | Domain/Adapter 境界が曖昧 |
| 前回教訓の反映 | ✅ 7/10 | DB/キャッシュは改善、UI は不足 |
| 実装可能性 | ⚠️ 6/10 | ACME/Firewall が複雑すぎる |
| 仕様の一貫性 | ⚠️ 5/10 | モデルID形式、SecurityPolicy設計に矛盾 |
| Phase分けの妥当性 | ⚠️ 6/10 | Phase1 の合格基準が厳しすぎる |

### 推奨アクション（優先度順）

1. **Critical Issues の修正（Phase0 開始前に必須）**
   - Domain/Adapter 境界の再定義
   - SecurityPolicy の設計見直し
   - Firewall Automation の簡略化

2. **High Priority Issues の修正（Phase0 と並行で対応可）**
   - エンジン検出の retry ロジック明確化
   - モデルID形式の統一
   - Phase1 合格基準の具体化

3. **Medium Issues の計画的対応（Phase1 開始前に対応）**
   - ACME を Phase3 に延期
   - DB ロールバック手順の追加
   - IPC エラーハンドリングの追加

---

## 📝 具体的な修正案

### 修正が必要なドキュメント

1. **docs/CORE_API.md**
   - ProxyService を削除し、`ProxyController` trait のみ残す
   - EngineService の責務を「状態管理」に限定
   - Migration 実行タイミングをコメントで明記

2. **docs/PROXY_SPEC.md**
   - `/v1/models` レスポンス例を追加
   - モデルID形式を全体で統一

3. **docs/CLI_SPEC.md**
   - `--engine` + `--raw-model` を deprecated に変更
   - `flm proxy status` の出力例を追加

4. **docs/DB_SCHEMA.md**
   - `proxy_profiles` に `policy_id` カラムを追加
   - バックアップ・リストア手順を追加

5. **docs/UI_MINIMAL.md**
   - IPC タイムアウト設定を追加
   - 長時間処理の進捗表示を明確化
   - Firewall Automation を「Advanced」オプション化

6. **docs/SECURITY_FIREWALL_GUIDE.md**
   - OS 判定フローチャートを追加
   - IPv4/IPv6 混在時のルール生成を明確化

7. **docs/PLAN.md**
   - Phase1 合格基準を具体化
   - ACME を Phase3 に移動

---

**分析完了日**: 2025-11-18  
**次のアクション**: 上記の Critical Issues を修正し、Phase0 開始前に再レビュー
