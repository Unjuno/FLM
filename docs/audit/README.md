# FLM V2 監査ドキュメント
> Status: Active | Audience: All contributors | Updated: 2025-11-20

## 概要

このディレクトリには、FLM V2（再構築版）の監査レポートが含まれています。プロトタイプの監査経験を活かし、Phase別に体系的に監査を実施します。

## 監査計画

### Phase 1（CLI Core）完了時
- [ ] `CORE_API_AUDIT.md` - Core API監査レポート
- [ ] `CLI_AUDIT.md` - CLIコマンド監査レポート
- [ ] `SECURITY_AUDIT_PHASE1.md` - Phase 1セキュリティ監査

### Phase 2（UI実装）完了時
- [ ] `UI_DESIGN_AUDIT.md` - UI設計監査レポート
- [ ] `UI_IMPLEMENTATION_AUDIT.md` - UI実装監査レポート
- [ ] `UI_PAGES_AUDIT.md` - ページ単位監査レポート

### Phase 3（パッケージング）完了時
- [ ] `PACKAGING_SECURITY_AUDIT.md` - パッケージングセキュリティ監査
- [ ] `COMPREHENSIVE_AUDIT.md` - 包括的監査レポート

## 監査基準

各監査は以下の観点から実施します：

1. **コード品質**: 構造、設計、スタイル、エラーハンドリング
2. **パフォーマンス**: レンダリング最適化、データ取得、キャッシュ
3. **セキュリティ**: 入力検証、認証・認可、XSS/CSRF対策
4. **アクセシビリティ**: キーボード操作、スクリーンリーダー対応、ARIA属性
5. **ユーザビリティ**: UI/UX、国際化、レスポンシブデザイン
6. **テスト**: カバレッジ、品質、エッジケース

## 監査ステータス

- ⏳ **未監査**: 監査がまだ開始されていない
- 🔄 **進行中**: 監査が進行中
- ✅ **完了**: 監査が完了し、問題がない、または修正済み
- ⚠️ **要修正**: 重大な問題が発見され、修正が必要

## 参考資料

- プロトタイプの監査レポート: `archive/prototype/docs/audit/`
- 監査テンプレート: `docs/audit/templates/`

---

**最終更新**: 2025-11-20

