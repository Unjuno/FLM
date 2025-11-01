# FLM - コントリビューションガイド

FLMプロジェクトへの貢献を歓迎します！

---

## 🎯 貢献の方法

以下の方法でFLMプロジェクトに貢献できます：

- バグレポート
- 機能リクエスト
- コードの改善
- ドキュメントの改善
- テストの追加

---

## 📋 コントリビューションの手順

### 1. バグレポート

バグを発見した場合は、以下の情報を含めて[GitHub Issues](https://github.com/flm/flm/issues)で報告してください：

- バグの説明
- 再現手順
- 期待される動作
- 実際の動作
- 環境情報（OS、バージョン等）
- スクリーンショット（該当する場合）

バグレポートのテンプレートは[bug-report-template.md](./tests/bug-tracking/bug-report-template.md)を参照してください。

### 2. 機能リクエスト

新しい機能の提案は、[GitHub Issues](https://github.com/flm/flm/issues)で作成してください：

- 機能の説明と目的
- 使用例
- 既存機能との関連性
- 実装の難易度（見積もり）

### 3. コードの貢献

#### 開発環境のセットアップ

1. リポジトリをクローン
   ```bash
   git clone https://github.com/flm/flm.git
   cd flm
   ```

2. 依存関係のインストール
   ```bash
   npm install
   ```

3. 開発環境のセットアップ
   
   詳細は[開発環境セットアップ](./docs/DEVELOPMENT_SETUP.md)を参照してください。

#### ブランチ戦略

- `main`: 安定版ブランチ
- `develop`: 開発ブランチ
- `feature/*`: 機能追加ブランチ
- `fix/*`: バグ修正ブランチ
- `docs/*`: ドキュメント更新ブランチ

#### プルリクエストの作成

1. ブランチを作成
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. 変更をコミット
   ```bash
   git add .
   git commit -m "feat: 機能の説明"
   ```

3. ブランチをプッシュ
   ```bash
   git push origin feature/your-feature-name
   ```

4. GitHubでプルリクエストを作成

#### コミットメッセージの形式

コミットメッセージは[Conventional Commits](https://www.conventionalcommits.org/)に従ってください：

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの動作に影響しない変更（フォーマット等）
- `refactor`: バグ修正でも機能追加でもないコードの変更
- `test`: テストの追加・変更
- `chore`: ビルドプロセスやツールの変更

例：
```
feat: API作成機能にモデル選択を追加
fix: API起動時のエラーハンドリングを修正
docs: ユーザーガイドにFAQを追加
```

---

## 🧪 テスト

### テストの実行

```bash
# 全テスト実行
npm test

# 単体テストのみ
npm run test:unit

# 統合テストのみ
npm run test:integration

# E2Eテストのみ
npm run test:e2e

# カバレッジレポート生成
npm run test:coverage
```

### テストの追加

新しい機能を追加する際は、必ずテストを追加してください：

- 単体テスト: 各関数・コンポーネントのテスト
- 統合テスト: モジュール間の統合テスト
- E2Eテスト: エンドツーエンドの動作テスト

---

## 📝 コードスタイル

### TypeScript/React

- ESLintルールに従う
- Prettierでフォーマット
- 型定義を必ず記述
- コメントを適切に追加

### Rust

- `cargo fmt`でフォーマット
- `cargo clippy`でチェック
- エラーハンドリングを適切に実装
- 非開発者向けのエラーメッセージ

詳細は[開発者ガイド](./docs/DEVELOPER_GUIDE.md)を参照してください。

---

## 📚 ドキュメント

### ドキュメントの更新

- コードを変更した場合は、関連するドキュメントも更新してください
- 新しい機能を追加した場合は、ユーザーガイドやAPIドキュメントに追加してください
- 変更履歴（CHANGELOG.md）に記録してください

### ドキュメントの構造

- **DOCKS/**: 設計・仕様・アーキテクチャドキュメント
- **docs/**: ユーザー向け・開発者向けドキュメント

詳細は[ドキュメントインデックス](./DOCKS/DOCUMENTATION_INDEX.md)を参照してください。

---

## 🔍 コードレビュー

プルリクエストは、以下の観点でレビューされます：

- コードの品質
- テストの有無
- ドキュメントの更新
- パフォーマンスへの影響
- セキュリティへの影響

レビューチェックリストは[review-checklist.md](./tests/code-review/review-checklist.md)を参照してください。

---

## 🐛 バグ修正の優先度

1. **Critical**: セキュリティ脆弱性、データ損失、アプリクラッシュ
2. **High**: 主要機能の動作不良
3. **Medium**: 軽微な機能の問題
4. **Low**: UIの問題、ドキュメントの誤り

---

## ✅ チェックリスト

プルリクエストを送信する前に、以下を確認してください：

- [ ] コードが動作することを確認
- [ ] テストが追加され、すべてパスすることを確認
- [ ] ドキュメントが更新されていることを確認
- [ ] コミットメッセージが適切であることを確認
- [ ] コードスタイルガイドラインに従っていることを確認
- [ ] CHANGELOG.mdに変更内容を記載（該当する場合）

---

## 💡 質問・相談

質問や相談がある場合は、以下でお気軽にご連絡ください：

- [GitHub Discussions](https://github.com/flm/flm/discussions)
- [GitHub Issues](https://github.com/flm/flm/issues)

---

## 📄 ライセンス

このプロジェクトはMIT Licenseで公開されています。コントリビューションにより、あなたの変更も同じライセンスの下で公開されることに同意するものとします。

---

**FLMプロジェクトへの貢献をありがとうございます！** 🙏

