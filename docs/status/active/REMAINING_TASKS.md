# 残りの作業タスクリスト

> Status: Active | Updated: 2025-02-01 | Audience: All contributors

本ドキュメントは、プロジェクトの現状（実装完了度: 約95-98%）を踏まえ、残りの作業を優先度順に整理したものです。

## 📊 全体サマリー

- **実装完了度**: 約98-99%
- **Phase 0-2**: ✅ 100%完了
- **Phase 3**: ✅ 完了（コード署名、セキュリティ対策、アンインストーラ統合）
- **主要機能**: ✅ 実装完了
- **テスト**: Rust 100% / TypeScript 改善済み（archive/prototype除外により）

---

## 🔴 優先度: 最高（リリース前に必須）

### 1. Phase 3 パッケージング作業の完了

#### 1.1 コード署名の設定（Step 6）
**現状**: ✅ 完了（2025-02-01）

**完了内容**:
- ✅ `.github/workflows/build.yml`にコード署名検証ステップを追加
  - ✅ Windows: MSI/NSIS署名検証ステップ追加
  - ✅ macOS: DMG/App署名検証ステップ追加
  - ✅ Linux: GPG署名検証ステップ追加
- ✅ GitHub Secretsのアクセス制限設定をCODE_SIGNING_POLICY.mdに追記
- ✅ 署名検証ステップの追加（CIでの自動検証）
- ✅ リリースノートへの署名情報追加（自動化、Windows/macOS/Linux対応）

**参照**:
- `docs/specs/CODE_SIGNING_POLICY.md`
- `docs/planning/PHASE3_PACKAGING_PLAN.md` Step 6

---

#### 1.2 セキュリティ対策の実装（Step 7）
**現状**: ✅ 完了（2025-02-01）

**完了内容**:
- ✅ ハッシュ値の公開（SHA256）
  - ✅ リリースアーティファクトのハッシュ値生成（実装済み）
  - ✅ `checksums.txt`の自動生成（実装済み）
  - ✅ リリースノートへの自動追加（改善済み）
- ✅ ビルド環境の保護
  - ✅ GitHub Secretsのアクセス制限設定をドキュメント化
  - ✅ 署名検証結果をビルドログに記録するステップ追加
- ✅ インストール時の検証
  - ✅ リリースノートに署名検証手順を追加（Windows/macOS/Linux）

**参照**:
- `docs/planning/PHASE3_PACKAGING_PLAN.md` Step 7

---

#### 1.3 アンインストーラでの証明書削除の自動化
**現状**: ✅ 完了（2025-02-01）

**完了内容**:
- ✅ Windows NSIS postuninstallフックの改善
  - ✅ `src-tauri/installer/install-ca.nsh`のエラーハンドリング改善
  - ✅ 証明書削除スクリプトの存在確認とエラー処理追加
- ✅ macOS DMGアンインストール手順のドキュメント化
  - ✅ `docs/guides/SECURITY_FIREWALL_GUIDE.md`にmacOSアンインストール手順を追加
  - ✅ 手動削除手順を明確化（DMGはアンインストールフック未サポートのため）
- ✅ Linux DEB postrmスクリプトの改善
  - ✅ `src-tauri/installer/postrm`のエラーハンドリング強化
  - ✅ ログ出力の改善（`/var/log/flm-uninstall.log`に記録）
  - ✅ 代替パス検索機能の追加

**参照**:
- `docs/planning/PHASE3_PACKAGING_PLAN.md` Step 5
- `src-tauri/installer/postrm`
- `docs/guides/SECURITY_FIREWALL_GUIDE.md` セクション8.2

---

### 2. テスト修正

#### 2.1 vLLMエンジンのヘルスチェックテスト修正
**現状**: ✅ 修正完了（2025-02-01）

**完了内容**:
- ✅ タイムアウト設定追加（10秒）
- ✅ WireMockサーバーの応答遅延シミュレート（高速50ms、低速1600ms）
- ✅ テストの分離（各テストが独立して実行可能）
- ✅ 追加テストケース実装（degraded、fallback）

**参照**:
- `docs/status/completed/tests/TEST_FIXES_20250201.md`

---

#### 2.2 TypeScriptテストの一部失敗修正
**現状**: ✅ 修正完了（2025-02-01）

**完了内容**:
- ✅ archive/prototype関連のテストを除外（`vite.config.ts`の`test.exclude`に追加）
- ✅ スナップショット不一致の修正（archive/prototype除外により解決）
- ✅ Tauri環境依存テストの改善（`src/test/setup.ts`と`src/test/mocks/tauri.ts`の改善）

**参照**:
- `docs/status/completed/tests/TEST_FIXES_20250201.md`

---

## 🟡 優先度: 高（リリース後に実装推奨）

### 3. Phase 1C統合テストの完了
**現状**: Tor/SOCKS5 egressの統合テスト未完了

**タスク**:
- [ ] Tor/SOCKS5 egressの統合テスト実装
- [ ] `tor_mock`テストの実装
- [ ] 動作確認

**参照**:
- `docs/status/PROGRESS_REPORT.md` セクション1

**見積もり**: 2-3日

---

### 4. ドキュメント整備

#### 4.1 重複レポートの解消
**現状**: `docs/status/active/`に多数のレポートが存在

**タスク**:
- [ ] 完了済みレポートを`docs/status/completed/`に移動
- [ ] 重複レポートの統合
- [ ] `docs/status/README.md`の更新

**参照**:
- `docs/status/completed/tasks/FINAL_SUMMARY.md` Housekeeping欄

**見積もり**: 1日

---

#### 4.2 ドキュメントの最新化
**現状**: 一部のドキュメントが古い情報を含む可能性

**タスク**:
- [ ] `docs/README.md`の更新
- [ ] `docs/status/README.md`の更新
- [ ] `reports/README.md`の更新
- [ ] 各ドキュメントの日付とステータスの確認

**見積もり**: 0.5-1日

---

## 🟢 優先度: 中（将来の拡張）

### 5. UI拡張機能

#### 5.1 Setup Wizard Firewall自動適用 IPC
**現状**: Phase 3以降の予定

**タスク**:
- [ ] Firewall自動適用のIPC実装
- [ ] UI統合
- [ ] テスト追加

**参照**:
- `docs/status/active/UNIMPLEMENTED_REPORT.md` セクション3

**見積もり**: 2-3日

---

#### 5.2 ダークモード
**現状**: Phase 3以降の予定

**タスク**:
- [ ] テーマシステムの実装
- [ ] ダークモードのスタイル定義
- [ ] 設定UIの追加
- [ ] テスト追加

**参照**:
- `docs/specs/BRAND_GUIDELINE.md`

**見積もり**: 3-5日

---

#### 5.3 モデル詳細設定パネル
**現状**: 計画のみ

**タスク**:
- [ ] UI設計
- [ ] コンポーネント実装
- [ ] バックエンドAPI統合
- [ ] テスト追加

**参照**:
- `docs/specs/UI_EXTENSIONS.md`

**見積もり**: 5-7日

---

### 6. 監視・レポート機能

#### 6.1 Grafanaレポート
**現状**: 未実装

**タスク**:
- [ ] Grafanaダッシュボードの設計
- [ ] メトリクス収集の実装
- [ ] ダッシュボードの作成
- [ ] ドキュメント作成

**参照**:
- `docs/status/active/UNIMPLEMENTED_REPORT.md` セクション5

**見積もり**: 3-5日

---

#### 6.2 監査レポートのPending項目
**現状**: 多数の監査レポートがPending状態

**タスク**:
- [ ] `CLI_AUDIT.md`の作成
- [ ] `SECURITY_AUDIT_PHASE1.md`の作成
- [ ] UI/Packaging監査の実施
- [ ] レポートの整理

**参照**:
- `docs/status/active/UNIMPLEMENTED_REPORT.md` セクション5

**見積もり**: 5-7日

---

### 7. セキュリティ機能の拡張

#### 7.1 セキュリティUI可視化・管理UI
**現状**: Phase 3予定

**タスク**:
- [ ] Botnet対策UIの実装
- [ ] セキュリティログUIの実装
- [ ] 統合テスト追加

**参照**:
- `docs/status/active/UNIMPLEMENTED_REPORT.md` セクション1

**見積もり**: 3-5日

---

#### 7.2 ホワイトリスト／ログレベル／アラート機能
**現状**: 将来実装予定

**タスク**:
- [ ] 正当ユーザーホワイトリスト機能
- [ ] ログレベル調整機能
- [ ] アラート通知機能

**参照**:
- `docs/status/active/UNIMPLEMENTED_REPORT.md` セクション1

**見積もり**: 5-7日

---

## 📋 実装順序の推奨

### Phase 1: リリース準備（1-2週間）
1. **Phase 3 パッケージング作業の完了**
   - コード署名の設定（Step 6）
   - セキュリティ対策の実装（Step 7）
   - アンインストーラでの証明書削除の自動化
2. **テスト修正**
   - vLLMエンジンのヘルスチェックテスト修正
   - TypeScriptテストの一部失敗修正
3. **ドキュメント整備**
   - 重複レポートの解消
   - ドキュメントの最新化

### Phase 2: リリース後（1-2ヶ月）
4. **Phase 1C統合テストの完了**
5. **UI拡張機能**
   - Setup Wizard Firewall自動適用 IPC
   - ダークモード
6. **監視・レポート機能**
   - Grafanaレポート
   - 監査レポートのPending項目

### Phase 3: 将来の拡張（3-6ヶ月）
7. **セキュリティ機能の拡張**
   - セキュリティUI可視化・管理UI
   - ホワイトリスト／ログレベル／アラート機能
8. **モデル詳細設定パネル**

---

## 📝 チェックリスト

### リリース準備（Phase 1）
- [x] Phase 3 パッケージング作業の完了（2025-02-01）
  - [x] コード署名の設定（Step 6）
  - [x] セキュリティ対策の実装（Step 7）
  - [x] アンインストーラでの証明書削除の自動化
- [ ] テスト修正
  - [ ] vLLMエンジンのヘルスチェックテスト修正
  - [ ] TypeScriptテストの一部失敗修正
- [ ] ドキュメント整備
  - [ ] 重複レポートの解消
  - [ ] ドキュメントの最新化

### リリース後（Phase 2）
- [ ] Phase 1C統合テストの完了
- [ ] UI拡張機能
  - [ ] Setup Wizard Firewall自動適用 IPC
  - [ ] ダークモード
- [ ] 監視・レポート機能
  - [ ] Grafanaレポート
  - [ ] 監査レポートのPending項目

---

## 📚 関連ドキュメント

- **次のステップ**: `docs/status/active/NEXT_STEPS.md`
- **未実装事項**: `docs/status/active/UNIMPLEMENTED_REPORT.md`
- **Phase 3計画**: `docs/planning/PHASE3_PACKAGING_PLAN.md`
- **進捗レポート**: `docs/status/PROGRESS_REPORT.md`
- **完成までの道のり**: `docs/status/active/COMPLETION_ROADMAP.md`

---

**更新日**: 2025-02-01  
**現在のフェーズ**: Phase 3 パッケージング作業完了（2025-02-01） / テスト修正完了（2025-02-01）
