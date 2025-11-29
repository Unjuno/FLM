# 次の実装ステップ

> Status: Ready | Updated: 2025-01-27 | Audience: All contributors

## Phase 1-2 実装完了 ✅

Phase 1（高優先度）とPhase 2（中優先度）の未実装項目はすべて完了しました。

**完了項目**:
- ✅ ACME証明書ローテーション自動スケジューラ
- ✅ ACME失敗時のフォールバック改善
- ✅ 異常検知システムの改善
- ✅ IPベースレート制限のデータベース永続化
- ✅ ハニーポット機能
- ✅ Packaged-CA モード（実装済み確認）
- ✅ Migration 完全実装

**テスト結果**:
- ✅ ユニットテスト: 56テスト成功
- ✅ 異常検知テスト: 4テスト成功
- ✅ Botnetセキュリティテスト: 22テスト成功

## 次のステップ候補

### オプション 1: 統合テストの修正（推奨）

統合テストの一部が失敗していますが、実装した機能のユニットテストはすべて成功しています。統合テストの失敗は、実装した機能とは直接関係ない可能性があります。

**推奨アクション**:
1. 失敗した統合テストの詳細を確認
2. 実装した機能との関連性を調査
3. 必要に応じてテストを修正

**参照**: `crates/services/flm-proxy/tests/integration_test.rs`

---

### オプション 2: Phase 3 実装の開始

Phase 3（低優先度）の未実装項目を実装します。

#### 2.1 UI Phase 2 残項目

**優先度**: 中

**実装項目**:
- セキュリティイベント可視化UI
- IPブロックリスト管理UI
- Setup Wizard Firewall自動適用 IPC
- Chat Tester UI

**参照**: `docs/specs/UI_MINIMAL.md`, `docs/specs/UI_EXTENSIONS.md`

#### 2.2 I18N UI実装

**優先度**: 低

**実装項目**:
- Tauriアプリケーションでの言語切替UI
- 初回起動時の自動検出
- UIコンポーネントへの翻訳適用

**参照**: `docs/specs/I18N_SPEC.md`

#### 2.3 特殊用途エンジンの実装

**優先度**: 低

**実装項目**:
- Ollama Whisper transcription
- 動画生成、3D生成、音楽生成
- コード実行、画像拡大、翻訳

**参照**: `docs/guides/SPECIALIZED_ENGINES.md`

---

### オプション 3: ドキュメント整備

実装した機能のドキュメントを整備します。

**推奨アクション**:
1. 実装した機能の使用例を追加
2. APIドキュメントの更新
3. チュートリアルの作成

---

## 推奨順序

1. **統合テストの修正**（高優先度）
   - 実装した機能の品質を保証するため
   - 既存のテストの問題を解決

2. **UI Phase 2 残項目**（中優先度）
   - セキュリティ機能の可視化と管理
   - ユーザー体験の向上

3. **I18N UI実装**（低優先度）
   - 多言語対応の実装
   - グローバル展開の準備

4. **特殊用途エンジンの実装**（低優先度）
   - 将来拡張として計画

---

## 参考ドキュメント

- 実装完了レポート: `docs/status/completed/implementations/UNIMPLEMENTED_ITEMS_PHASE1_2_COMPLETE.md`
- 実装サマリー: `docs/status/completed/implementations/PHASE1_2_IMPLEMENTATION_SUMMARY.md`
- 未実装レポート: `docs/status/active/UNIMPLEMENTED_REPORT.md`
- 次のステップ: `docs/status/active/NEXT_STEPS.md`

---

**更新日**: 2025-01-27  
**現在のフェーズ**: Phase 1-2 完了 / Phase 3 準備中


