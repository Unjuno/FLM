# FLM Next Plan レビュー: 問題点抽出レポート
> Status: Review | Audience: Architecture leads | Created: 2025-11-18

## 背景
前回プロトタイプの失敗（機能肥大化、保守困難、重複実装、責務逆転）を踏まえた再構築計画について、破綻リスクと設計上の問題点を抽出。

---

## 1. 前回失敗の再現リスク

### 1.1 責務境界の曖昧さ（高リスク）

**問題**: Domain層（`flm-core`）とAdapter層の責務境界が一部曖昧

**具体例**:
- `CORE_API.md` L395: `*_Service::new()` で `sqlx::migrate!()` を呼び出すと記載されているが、これは「Domain層がDB接続管理を直接行う」ことになり、Domain層の純粋性が損なわれる
- `DB_SCHEMA.md` L7: Domain層が `sqlx::migrate!()` を呼ぶと明記されているが、実際のDB接続はAdapter層が提供するという二重構造が不明確

**影響**: 
- Domain層がDB接続に依存し、テストが困難になる
- Adapter層とDomain層の責務が混在し、前回の「責務逆転」問題が再発する可能性

**推奨修正**:
- Migration実行はAdapter層（`flm-cli`/`flm-proxy`）の責務とし、Domain層はMigration結果（スキーマ）のみを前提とする
- または、Domain層は `MigrationRunner` trait を受け取り、実装はAdapter層が提供する

---

### 1.2 UI→CLI subprocess禁止の徹底度不足（中リスク）

**問題**: `UI_MINIMAL.md` では「CLI subprocess禁止」と明記されているが、実装時の誤解リスクがある

**具体例**:
- `UI_MINIMAL.md` L6: 「CLI subprocess の起動は禁止」と記載
- しかし、`UI_MINIMAL.md` L74: Chatテストは「Proxy の HTTP エンドポイントを直接呼び出す」とあるが、Proxy起動状態の確認方法が不明確
- `PLAN.md` L75: 「API作成フォームはコアサービスの API を直接呼び出す（CLI subprocess を廃止）」とあるが、Proxy起動コマンド（`flm proxy start`）をUIからどう呼ぶかが曖昧

**影響**:
- 実装者が誤って `flm proxy start` をsubprocessで呼び出す可能性
- UIとCLIの責務が再び混在する

**推奨修正**:
- `UI_MINIMAL.md` に「すべての操作はIPC経由でCore APIを呼び出す。CLIバイナリ（`flm`）をsubprocessで起動することは一切禁止」と明記
- `ProxyService::start` をIPC経由で呼ぶことを明示

---

### 1.3 エンジン検出の重複実装リスク（中リスク）

**問題**: エンジン検出ロジックが複数箇所に分散する可能性

**具体例**:
- `ENGINE_DETECT.md`: エンジン検出仕様を定義
- `CORE_API.md`: `EngineService::detect_engines` を定義
- `CLI_SPEC.md`: `flm engines detect` コマンドを定義
- しかし、Proxy起動時のエンジン検出（Forward先ホスト固定）とCLIの検出が同じロジックを使う保証がない

**影響**:
- ProxyとCLIで異なる検出ロジックが実装され、結果が不一致になる
- 前回の「重複実装」問題が再発

**推奨修正**:
- `PROXY_SPEC.md` L72: 「Forward 先ホストは EngineService が検出済みのホストのみ」とあるが、Proxy起動時に `EngineService::detect_engines` を呼ぶことを明記
- または、Proxy起動前にCLIで検出済みの結果をDBに保存し、Proxyはそれを参照する仕様を明確化

---

## 2. アーキテクチャの一貫性問題

### 2.1 Firewall Automation の責務境界（中リスク）

**問題**: Firewall操作がCore APIに含まれないが、UIとの連携が複雑

**具体例**:
- `UI_MINIMAL.md` L76-77: `system_firewall_preview/apply` はCore APIに含まれず、Tauri側（Adapter層）で実装
- しかし、`SECURITY_FIREWALL_GUIDE.md` L7: `ProxyService::status` と `SecurityService::get_policy` を呼ぶ必要がある
- この2つの情報をTauri側で取得する方法が不明確（IPC経由か、直接DBアクセスか）

**影響**:
- Tauri側がCore APIを呼ぶ必要があるが、それがFirewall操作の責務と混在する
- 実装時に責務が曖昧になり、前回の「責務逆転」が再発

**推奨修正**:
- `UI_MINIMAL.md` に「Firewall操作はTauri側で実装するが、Proxy/Policy情報はIPC経由でCore APIから取得する」と明記
- または、Firewall操作もCore APIに含め、Tauri側はIPC経由で呼ぶ仕様に統一

---

### 2.2 証明書管理の責務（中リスク）

**問題**: ACME証明書の取得・更新がどの層の責務か不明確

**具体例**:
- `PROXY_SPEC.md` L102: 「ACME 証明書は `security.db` にパスと更新日時を保存」
- `CORE_API.md`: `ProxyService` に証明書管理のAPIが明示されていない
- `CLI_SPEC.md` L54: `--acme-email`, `--acme-domain` オプションがあるが、証明書更新の自動化が不明確

**影響**:
- Proxy起動時に証明書を取得するが、更新はどうするかが未定義
- 実装時に責務が分散し、保守が困難になる

**推奨修正**:
- `PROXY_SPEC.md` に証明書更新のタイミング（起動時チェック、定期更新）と責務（ProxyService vs 別サービス）を明記
- `CORE_API.md` に `ProxyService::renew_certificate` などのAPIを追加検討

---

### 2.3 エラーハンドリングの一貫性（低リスク）

**問題**: エラー形式が仕様書間で統一されていない

**具体例**:
- `CLI_SPEC.md` L128-137: CLIエラー形式を定義
- `PROXY_SPEC.md` L108: SSEストリーム中のエラー形式を定義
- `CORE_API.md`: Core APIのエラー型（`EngineError`, `ProxyError`, `RepoError`）を定義
- しかし、これらがどう変換されるかが不明確

**影響**:
- 実装時にエラー形式が不一致になり、デバッグが困難

**推奨修正**:
- `CORE_API.md` に「Core APIのエラー型はCLI/Proxy/UIで適切に変換される」と明記
- エラー変換のマッピング表を追加

---

## 3. 実装可能性とリスク

### 3.1 未決事項の多さ（中リスク）

**問題**: 複数の仕様書に「未決事項」「将来拡張」が散在

**具体例**:
- `CORE_API.md` L403: 「未確定事項: ProxyConfig の ACME 設定」
- `PROXY_SPEC.md` L136-140: 「未決事項: `/v1/audio/*` 等の将来 API」「ProxyService でのホットリロード」
- `UI_MINIMAL.md` L108-111: 「未決事項: UI コンポーネントライブラリ」「手動テストシナリオ」

**影響**:
- Phase1/2で実装が必要な機能が未定義のまま
- 実装中に仕様変更が発生し、計画が遅延

**推奨修正**:
- Phase1/2で必須の未決事項を優先的に確定（例: ACME設定の詳細）
- 「将来拡張」は `UI_EXTENSIONS.md` に集約し、Phase1/2の仕様書からは削除

---

### 3.2 テスト要件の具体性不足（低リスク）

**問題**: テスト要件が抽象的で、実装時の判断が困難

**具体例**:
- `PLAN.md` L125: 「エンジン検出成功率100%（対象エンジン4種×主要OSで3回以上）」とあるが、「主要OS」の定義が不明確
- `FEATURE_SPEC.md` L81: 「Rust コアの自動テストカバレッジ 80%以上」とあるが、統合テストの範囲が不明確

**影響**:
- CIでテストが失敗した際に、仕様違反か実装バグかの判断が困難

**推奨修正**:
- テスト要件に「主要OS = Windows 11, macOS 14, Ubuntu 22.04」など具体的な定義を追加
- 統合テストの範囲（CLI+Proxy+DB）を明記

---

### 3.3 セキュリティポリシーのバリデーション（中リスク）

**問題**: SecurityPolicy JSONのバリデーションがCore側で実施されるが、詳細が不明確

**具体例**:
- `CORE_API.md` L218-235: SecurityPolicy JSONの最小スキーマを定義
- `UI_MINIMAL.md` L72: 「保存前に Core でスキーマバリデーションを実施」とあるが、バリデーション失敗時のエラー形式が不明確
- `CLI_SPEC.md` L110: `flm security policy set --json ./policy.json` があるが、バリデーション失敗時の挙動が不明確

**影響**:
- UIとCLIで異なるバリデーションエラーメッセージが表示される可能性
- ユーザーが混乱する

**推奨修正**:
- `CORE_API.md` に `SecurityService::validate_policy` メソッドを追加し、バリデーション結果（成功/失敗+エラー詳細）を返す仕様を明記
- `CLI_SPEC.md` と `UI_MINIMAL.md` にバリデーション失敗時のエラー表示方法を統一

---

## 4. 前回失敗の再発防止策の評価

### 4.1 機能肥大化防止（評価: 良好）

**対策**: Phase1/2の機能範囲を明確に限定（`FEATURE_SPEC.md` L7: スコープ外を明記）

**懸念点**: 
- `UI_EXTENSIONS.md` に将来機能が多く定義されているが、Phase1/2完了前に実装圧力がかかる可能性

**推奨**: 
- Phase1/2完了までは `UI_EXTENSIONS.md` を参照禁止にするか、明確に「Phase3以降」とラベル付け

---

### 4.2 重複実装防止（評価: 要改善）

**対策**: CLI/UI/Proxyが同じCore APIを呼ぶ構造（`PLAN.md` L10）

**懸念点**:
- エンジン検出の重複リスク（2.3参照）
- Firewall操作の責務境界が曖昧（2.1参照）

**推奨**: 
- Core APIの呼び出し箇所を仕様書に明記（例: Proxy起動時は `EngineService::detect_engines` を呼ぶ）

---

### 4.3 責務逆転防止（評価: 要改善）

**対策**: Domain層とAdapter層の責務境界を明確化（`CORE_API.md` L17）

**懸念点**:
- Migration実行の責務が曖昧（1.1参照）
- Firewall操作の責務が曖昧（2.1参照）

**推奨**: 
- Domain層の責務を「純粋ロジックのみ」と厳密に定義し、I/O操作（DB接続、ファイル操作、ネットワーク）はすべてAdapter層の責務と明記

---

## 5. 優先度別の修正推奨事項

### 高優先度（Phase0で修正必須）

1. **Migration実行の責務明確化**（1.1）
   - `CORE_API.md` と `DB_SCHEMA.md` を修正し、MigrationはAdapter層の責務と明記

2. **UI→CLI subprocess禁止の徹底**（1.2）
   - `UI_MINIMAL.md` に「すべての操作はIPC経由」と明記し、例外を列挙

3. **エンジン検出の重複防止**（1.3）
   - `PROXY_SPEC.md` にProxy起動時のエンジン検出方法を明記

### 中優先度（Phase1開始前に修正推奨）

4. **Firewall操作の責務明確化**（2.1）
   - `UI_MINIMAL.md` にFirewall操作とCore API連携の方法を明記

5. **証明書管理の責務明確化**（2.2）
   - `PROXY_SPEC.md` に証明書更新のタイミングと責務を明記

6. **未決事項の確定**（3.1）
   - Phase1/2で必須の未決事項（ACME設定など）を優先的に確定

7. **セキュリティポリシーのバリデーション統一**（3.3）
   - `CORE_API.md` にバリデーションAPIを追加し、CLI/UIで統一

### 低優先度（Phase1中に修正可能）

8. **エラーハンドリングの一貫性**（2.3）
   - `CORE_API.md` にエラー変換のマッピング表を追加

9. **テスト要件の具体化**（3.2）
   - `PLAN.md` のテスト要件に具体的なOS/環境定義を追加

---

## 6. 総合評価

### 強み
- 前回の失敗（機能肥大化、重複実装、責務逆転）を認識し、対策を明記している
- Domain層とAdapter層の分離を明確に定義している
- Phase分けにより、段階的な実装を計画している

### 弱み
- 一部の責務境界が曖昧で、前回の失敗が再発するリスクがある
- 未決事項が多く、実装時に仕様変更が発生する可能性がある
- テスト要件が抽象的で、CIでの判断が困難

### 推奨アクション
1. **Phase0完了前に**: 高優先度の修正事項（1.1, 1.2, 1.3）を実施
2. **Phase1開始前に**: 中優先度の修正事項（4-7）を実施
3. **Phase1中**: 低優先度の修正事項（8-9）を実施しつつ、実装で発見した問題を仕様書に反映

---

## 7. 追加検討事項

### 7.1 ドキュメント間の整合性チェック

**問題**: 複数の仕様書に同じ概念が異なる表現で記載されている

**例**:
- `PLAN.md` L58: 「自己署名HTTPS (`dev-selfsigned` モード) を標準公開手段とする」
- `CLI_SPEC.md` L44: 「`dev-selfsigned`: 自己署名証明書で HTTPS を提供。ドメインを持たないユーザー向けの標準公開モード」
- `PROXY_SPEC.md` L96: 「`dev-selfsigned`: 自己署名証明書で HTTPS 提供。一般ユーザーがドメイン不要で外部公開する際の推奨モード」

**推奨**: 
- 用語集（Glossary）を作成し、各仕様書で参照する
- または、`PLAN.md` に用語定義セクションを追加

---

### 7.2 実装順序の明確化

**問題**: Phase1の実装順序が不明確

**例**:
- `PLAN.md` L93-99: Phase1のタスクを列挙しているが、依存関係が不明確
- エンジン検出→モデル一覧→プロキシ起動の順序は推測できるが、明示されていない

**推奨**: 
- `PLAN.md` にPhase1の実装順序（依存関係）を図またはリストで明記

---

このレビューは Phase0 完了時点で再実施し、修正状況を確認することを推奨する。
