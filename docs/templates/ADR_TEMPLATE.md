# Architecture Decision Record (ADR) Template
> Status: Template | Audience: All contributors

## 0. Metadata
- **ADR ID**: `ADR-YYYYMMDD-<slug>`
- **Status**: Proposed / Accepted / Rejected / Superseded (`ADR-????`)
- **Related Issues/PRs**: `#123`, `flm/456`
- **Owners**: `@example` (Engineering), `@example` (Security)
- **Last Updated**: `YYYY-MM-DD`

## 1. Context
- 現状の課題、制約、目標値を列挙
- 関連ドキュメント（`docs/CORE_API.md`、`docs/PLAN.md` 等）をリンク
- 影響範囲（CLI / Proxy / UI / DB / Ops）を明記

## 2. Decision
- 採用するアプローチを箇条書きで記述
- バージョン影響（例: `CORE_API` 1.0.0 → 1.1.0）やマイグレーション要否を記載
- フラグや設定キーの追加/変更を明記

## 3. Alternatives
| 選択肢 | 概要 | メリット | デメリット |
|--------|------|----------|------------|
| Option A | | | |
| Option B | | | |

## 4. Consequences
- 正の効果（例: セキュリティ向上、性能改善）
- 負の効果 / トレードオフ（例: 実装コスト、互換性リスク）
- オープンなフォローアップタスク

## 5. Rollout Plan
1. 段階（Phase 0/1/2/3）やマイルストーンと同期
2. 必要なテレメトリ・アラート
3. リスク低減策 / ロールバック手順

## 6. Validation
- 必須テスト（`docs/TEST_STRATEGY.md` 参照）の一覧
- 手動シナリオ（`tests/ui-scenarios.md` 等）の更新要否

## 7. Sign-off
| 役割 | 氏名/ハンドル | 署名日時 |
|------|---------------|----------|
| Tech Lead | | |
| Security | | |
| QA / Release | | |

